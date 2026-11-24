import { CollectionError, recordKey, validateRecord } from './schema.mjs';
import { enqueue, randomId } from './store.mjs';

const LEASE_MS = 25_000;
const TIMEOUT_MS = 9_000;
const MAX_ATTEMPTS = 5;

/**
 * @typedef {{
 *  id: string, version: string, record: object|null
 * }} RemoteChange Null records represent versioned deletions.
 * @typedef {{
 *   push(change: {
 *     id: string, mutationId: string, expectedVersion: string|null, record: object|null
 *   }, options: {signal: AbortSignal}): Promise<
 *     {status: 'accepted', version: string} | {status: 'conflict', remote: RemoteChange}
 *   >,
 *   pull(cursor: string|null, options: {signal: AbortSignal}):
 *     Promise<{cursor: string, changes: RemoteChange[]}>
 * }} SyncProvider The server enforces ownership, compare-and-swap and mutation-ID idempotency.
 */

function version(value) {
  if (typeof value !== 'string' || !value || value.length > 200) {
    throw new CollectionError('Invalid provider version.');
  }
  return value;
}

function verifiedChange(change) {
  if (!change || typeof change.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/u.test(change.id)) {
    throw new CollectionError('Invalid provider record ID.');
  }
  const record = change.record === null ? null : validateRecord(change.record);
  if (record && change.id !== record.id) throw new CollectionError('Provider record ID mismatch.');
  return { id: change.id, version: version(change.version), record };
}

function mark(entry, status) {
  if (entry?.record) entry.record.syncStatus = status;
}

function isDuplicate(state, change) {
  return change.record && state.entries.some((item) => item.id !== change.id
    && item.record && recordKey(item.record) === recordKey(change.record));
}

export function createSyncEngine(store, {
  provider = null, isOnline = () => globalThis.navigator?.onLine !== false, now = Date.now,
  makeId = randomId, timeoutMs = TIMEOUT_MS,
} = {}) {
  let running;
  let timer;
  let monitoring = false;

  async function status() {
    const state = await store.read();
    return {
      enabled: Boolean(provider), online: isOnline(), queued: state.outbox.length,
      pending: state.outbox.filter((job) => job.attempts < MAX_ATTEMPTS).length,
      failed: state.outbox.filter((job) => job.attempts >= MAX_ATTEMPTS).length,
      conflicts: state.entries.filter((entry) => entry.conflict).length,
    };
  }

  async function remote(operation) {
    const controller = new AbortController();
    let deadline;
    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise((_resolve, reject) => {
          deadline = setTimeout(() => {
            const error = new CollectionError('Sync request timed out.');
            controller.abort(error);
            reject(error);
          }, timeoutMs);
        }),
      ]);
    } finally { clearTimeout(deadline); }
  }

  function conflict(entry, change) {
    entry.conflict = change;
    mark(entry, 'conflict');
  }

  function applyRemote(state, change) {
    let entry = state.entries.find((item) => item.id === change.id);
    if (entry?.remoteVersion === change.version && !entry.conflict) return;
    const collision = isDuplicate(state, change);
    const edited = entry && state.outbox.some((job) => job.id === change.id);
    if (!entry) {
      if (!change.record) return;
      entry = { id: change.id, record: null, revision: 0, remoteVersion: null, conflict: null, review: 'accepted' };
      state.entries.push(entry);
    }
    if (edited || collision || entry.conflict) { conflict(entry, change); return; }
    entry.record = change.record;
    entry.remoteVersion = change.version;
    entry.revision += 1;
    mark(entry, 'synced');
  }

  async function claim(owner) {
    return store.update((state) => {
      if (state.syncLease?.owner !== owner) return;
      state.syncLease.until = now() + LEASE_MS;
      const seen = new Set();
      for (const job of state.outbox) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        const entry = state.entries.find((item) => item.id === job.id);
        if (!entry || entry.conflict || job.nextAt > now() || job.attempts >= MAX_ATTEMPTS) continue;
        if (!job.started) {
          job.expectedVersion = entry.remoteVersion;
          job.snapshot = entry.record ? { ...entry.record, syncStatus: 'local-only' } : null;
          job.started = true;
        }
        mark(entry, 'syncing');
        return { id: job.id, mutationId: job.mutationId, expectedVersion: job.expectedVersion, record: job.snapshot };
      }
    });
  }

  async function finish(owner, task, result, failure) {
    return store.update((state) => {
      const index = state.outbox.findIndex((job) => job.mutationId === task.mutationId);
      if (state.syncLease?.owner !== owner || index === -1) return;
      const job = state.outbox[index];
      const entry = state.entries.find((item) => item.id === task.id);
      if (failure) {
        job.attempts += 1;
        job.nextAt = now() + Math.min(60_000, 1000 * 2 ** (job.attempts - 1));
        mark(entry, 'failed');
      } else if (result.status === 'conflict') {
        conflict(entry, result.remote);
      } else {
        state.outbox.splice(index, 1);
        entry.remoteVersion = result.version;
        if (!entry.record && !state.outbox.some((item) => item.id === entry.id)) {
          // The server acknowledged the tombstone. Its cursor owns delete history.
          state.entries = state.entries.filter((item) => item !== entry);
        } else {
          mark(entry, state.outbox.some((item) => item.id === entry.id) ? 'pending' : 'synced');
        }
      }
    });
  }

  async function perform() {
    if (!provider || !isOnline()) return { status: provider ? 'offline' : 'disabled' };
    const owner = makeId();
    const acquired = await store.update((state) => {
      if (state.syncLease?.until > now()) return false;
      state.syncLease = { owner, until: now() + LEASE_MS };
      return true;
    });
    if (!acquired) return { status: 'busy' };

    try {
      let processed = 0;
      while (isOnline() && processed < 20) {
        const task = await claim(owner);
        if (!task) break;
        processed += 1;
        let result;
        try {
          const answer = await remote((signal) => provider.push(task, { signal }));
          if (answer?.status === 'accepted') result = { status: answer.status, version: version(answer.version) };
          else if (answer?.status === 'conflict') {
            const change = verifiedChange(answer.remote);
            if (change.id !== task.id) throw new CollectionError('Sync conflict ID mismatch.');
            result = { status: answer.status, remote: change };
          } else throw new CollectionError('Unexpected sync response.');
        } catch (error) {
          await finish(owner, task, null, error);
          continue;
        }
        await finish(owner, task, result);
      }

      if (!isOnline()) return { status: 'offline' };
      const { cursor } = await store.read();
      const batch = await remote((signal) => provider.pull(cursor, { signal }));
      const next = version(batch?.cursor);
      if (!Array.isArray(batch.changes) || batch.changes.length > 100) throw new CollectionError('Invalid sync batch.');
      const changes = batch.changes.map(verifiedChange);
      await store.update((state) => {
        if (state.syncLease?.owner !== owner || state.cursor !== cursor) return;
        for (const change of changes) applyRemote(state, change);
        state.cursor = next;
      });
      return { status: 'finished' };
    } catch {
      return { status: 'failed' };
    } finally {
      await store.update((state) => { if (state.syncLease?.owner === owner) state.syncLease = null; });
    }
  }

  async function scheduleNext(outcome) {
    clearTimeout(timer);
    if (!monitoring || !provider || !isOnline()) return;
    const state = await store.read();
    const seen = new Set();
    let next = Infinity;
    for (const job of state.outbox) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      const entry = state.entries.find((item) => item.id === job.id);
      if (entry && !entry.conflict && job.attempts < MAX_ATTEMPTS) next = Math.min(next, job.nextAt);
    }
    if (outcome === 'failed') next = Math.min(next, now() + TIMEOUT_MS);
    if (Number.isFinite(next)) timer = setTimeout(run, Math.max(500, next - now()));
  }

  function run() {
    running ??= perform().then(async (result) => { await scheduleNext(result.status); return result; })
      .finally(() => { running = undefined; });
    return running;
  }

  const onOnline = () => { void run().catch(() => {}); };
  return {
    status, run,
    start(events) {
      if (!provider || monitoring) return () => {};
      monitoring = true;
      events.addEventListener('online', onOnline);
      onOnline();
      return () => { monitoring = false; clearTimeout(timer); events.removeEventListener('online', onOnline); };
    },
    async retryFailed() {
      await store.update((state) => {
        for (const job of state.outbox) {
          if (job.attempts) { job.attempts = 0; job.nextAt = 0; }
        }
      });
      return run();
    },
    async resolve(id, choice, expectedVersion) {
      if (!['local', 'remote'].includes(choice)) throw new CollectionError('Choose a conflict resolution.');
      return store.update((state) => {
        const entry = state.entries.find((item) => item.id === id);
        if (!entry?.conflict || entry.conflict.version !== expectedVersion) throw new CollectionError('Conflict changed. Review it again.');
        const change = entry.conflict;
        if (choice === 'remote' && isDuplicate(state, change)) throw new CollectionError('Remote copy duplicates another item.');
        state.outbox = state.outbox.filter((job) => job.id !== id);
        entry.conflict = null;
        entry.remoteVersion = change.version;
        entry.revision += 1;
        if (choice === 'remote') {
          entry.record = change.record;
          mark(entry, 'synced');
        } else {
          mark(entry, 'pending');
          enqueue(state, entry, makeId);
        }
      });
    },
  };
}
