import { CollectionError, MAX_FILE, MAX_RECORDS, SCHEMA_VERSION, planImport, recordKey, validateDraft, validateRecord } from './schema.mjs';

export function emptyState() {
  return { storageVersion: 1, entries: [], outbox: [], cursor: null, syncLease: null };
}

export function createIndexedDBStore(indexedDB, name) {
  if (!indexedDB) throw new CollectionError('Browser storage is unavailable.');
  let opening;
  function open() {
    opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspace');
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new CollectionError('Close other collection tabs and try again.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); opening = undefined; };
        resolve(request.result);
      };
    }).catch((error) => { opening = undefined; throw error; });
    return opening;
  }

  async function transact(mutator, write) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('workspace', write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('workspace');
      const request = store.get('state');
      let result;
      let failure;
      request.onsuccess = () => {
        try {
          const state = request.result ?? emptyState();
          if (state.storageVersion !== 1 || !Array.isArray(state.entries) || !Array.isArray(state.outbox)) {
            throw new CollectionError('Collection database version is unsupported.');
          }
          result = mutator(state);
          if (write) {
            const bytes = new TextEncoder().encode(JSON.stringify(state)).byteLength;
            if (bytes > MAX_FILE) throw new CollectionError('Private collection storage limit reached. Export and remove items to free space.');
            store.put(state, 'state');
          }
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new CollectionError('Collection transaction aborted.'));
    });
  }
  return { read: () => transact((state) => state, false), update: (callback) => transact(callback, true) };
}

export function randomId() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function enqueue(state, entry, makeId) {
  const pending = state.outbox.filter((item) => item.id === entry.id);
  const latest = pending.at(-1);
  const task = {
    id: entry.id, mutationId: makeId(), revision: entry.revision,
    operation: entry.record ? 'upsert' : 'delete',
    attempts: 0, nextAt: 0, started: false, expectedVersion: null,
  };
  // The entry's latest record can be read at dispatch. A started job keeps its exact snapshot for idempotent retries.
  if (latest && !latest.started) state.outbox[state.outbox.indexOf(latest)] = task;
  else state.outbox.push(task);
}

export function createCollection(store, { now = () => new Date().toISOString(), makeId = randomId, inbox = false } = {}) {
  function add(state, record) {
    if (state.entries.length >= MAX_RECORDS) throw new CollectionError('Collection record limit reached.');
    const entry = {
      id: record.id, record, revision: 1, remoteVersion: null, conflict: null,
      review: inbox ? 'pending' : 'accepted',
    };
    state.entries.push(entry);
    if (!inbox) enqueue(state, entry, makeId);
    return entry;
  }

  const records = (state) => state.entries.flatMap((entry) => entry.record ? [entry.record] : []);
  function current(state, id, revision) {
    const entry = state.entries.find((value) => value.id === id && value.record);
    if (!entry) throw new CollectionError('The collection item is missing.');
    if (revision !== undefined && revision !== entry.revision) {
      throw new CollectionError('The item changed in another view. Reload it and try again.');
    }
    if (entry.conflict) throw new CollectionError('Resolve the sync conflict before making changes.');
    return entry;
  }

  return {
    async list() { return (await store.read()).entries.filter((entry) => entry.record || entry.conflict); },
    async save(draft) {
      const value = validateDraft(draft);
      return store.update((state) => {
        const identical = state.entries.find((entry) => entry.record && recordKey(entry.record) === recordKey(value));
        if (identical) return { entry: identical, duplicate: true };
        const timestamp = now();
        const record = validateRecord({
          ...value, id: makeId(), schemaVersion: SCHEMA_VERSION,
          createdAt: timestamp, updatedAt: timestamp, syncStatus: 'local-only',
        });
        return { entry: add(state, record), duplicate: false };
      });
    },
    async edit(id, revision, draft) {
      const value = validateDraft(draft);
      return store.update((state) => {
        const entry = current(state, id, revision);
        if (state.entries.some((other) => other.id !== id && other.record && recordKey(other.record) === recordKey(value))) {
          throw new CollectionError('Another collection item already has this content.');
        }
        entry.record = validateRecord({ ...entry.record, ...value, updatedAt: [entry.record.updatedAt, now()].sort().at(-1),
          syncStatus: entry.remoteVersion !== null || state.outbox.some((job) => job.id === id && job.started) ? 'pending' : 'local-only' });
        entry.revision += 1;
        if (!inbox) enqueue(state, entry, makeId);
        return entry;
      });
    },
    async accept(id, revision) {
      if (!inbox) throw new CollectionError('Review is available in the Collection Inbox.');
      return store.update((state) => { current(state, id, revision).review = 'accepted'; });
    },
    async remove(id, revision) {
      return store.update((state) => {
        const entry = current(state, id, revision);
        const remote = entry.remoteVersion !== null || state.outbox.some((job) => job.id === id && job.started);
        if (remote) {
          entry.record = null;
          entry.revision += 1;
          enqueue(state, entry, makeId);
        } else {
          state.entries = state.entries.filter((item) => item.id !== id);
          state.outbox = state.outbox.filter((job) => job.id !== id);
        }
      });
    },
    async preview(incoming) { return planImport(incoming, records(await store.read())); },
    async import(incoming) {
      const checked = incoming.map((record) => ({ ...validateRecord(record), syncStatus: 'local-only' }));
      return store.update((state) => {
        // Compare again inside the transaction so previews cannot overwrite newer local changes.
        const active = records(state);
        const hiddenIds = new Set(state.entries.filter((entry) => !entry.record).map((entry) => entry.id));
        const rows = planImport(checked, active).map((row) => hiddenIds.has(row.record.id) ? { ...row, action: 'conflict' } : row);
        for (const { record, action } of rows) if (action === 'add') add(state, record);
        return rows;
      });
    },
  };
}
