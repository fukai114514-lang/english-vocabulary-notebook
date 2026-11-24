import { websiteDraft } from './mapping.mjs';
import { MAX_FILE, SYNC_STATES, TARGETS, exportArchive, parseArchive, recordTitle } from './schema.mjs';
import { createCollection, createIndexedDBStore } from './store.mjs';
import { createSyncEngine } from './sync.mjs';

const inbox = document.documentElement.dataset.mode === 'inbox';
const browser = inbox ? null : (globalThis.browser ?? globalThis.chrome);
const query = new URLSearchParams(window.location.search);
const $ = (id) => document.getElementById(id);
const ui = (name, text, className) => {
  const node = document.createElement(name);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
let collection;
let sync;
let entries = [];
let importRows = [];
let clickedFile = 0;
let currentEdit = 0;

function button(text, listener) {
  const node = ui('button', text);
  node.type = 'button';
  node.addEventListener('click', async (event) => {
    if (!event.isTrusted) return;
    node.disabled = true;
    try { await listener(event); } catch (error) { feedback(error.message, true); }
    finally { node.disabled = false; }
  });
  return node;
}

function feedback(text = '', error = false) {
  $('message').textContent = error ? '' : text;
  $('error').textContent = error ? text : '';
  $('error').hidden = !error;
}

function field(name, value, onChange, { multiline = false, type = 'text' } = {}) {
  const label = ui('label', name);
  const input = ui(multiline ? 'textarea' : 'input');
  if (!multiline) input.type = type;
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  label.append(input);
  return label;
}

function targetChoices(node, type, filter = false) {
  for (const [value, name] of Object.entries(TARGETS)) {
    if (!filter && ((value === 'articles') !== (type === 'article')
      || (type === 'expression' && value === 'word-meanings'))) continue;
    const option = ui('option', name);
    option.value = value;
    node.append(option);
  }
}

function validTheme(value) {
  return ['system', 'light', 'dark'].includes(value) ? value : 'system';
}

function theme(value) {
  document.documentElement.dataset.theme = validTheme(value);
  $('theme').value = validTheme(value);
}

function visibleEntries() {
  const match = $('search').value.toLowerCase().trim();
  const target = $('filter').value;
  const direction = $('sort').value === 'new' ? -1 : 1;
  return entries.filter((entry) => {
    const item = entry.record ?? entry.conflict?.record;
    if (!item) return !match && !target;
    if (target && item.target !== target) return false;
    return !match || [recordTitle(item), item.tags.join(' '), JSON.stringify(item.content)].join(' ').toLowerCase().includes(match);
  }).sort((a, b) => direction * (a.record?.createdAt ?? '').localeCompare(b.record?.createdAt ?? ''));
}

async function refresh() {
  entries = await collection.list();
  renderList();
  const state = await sync.status();
  $('sync-label').textContent = state.enabled
    ? `${state.queued} queued · ${state.failed} failed · ${state.conflicts} conflicts`
    : inbox ? 'Local Only. This Inbox does not connect to a sync provider.'
      : `Local Only. Cloud sync is unavailable. ${state.queued} local changes queued.`;
}

function showRemoval(entry) {
  $('remove-title').textContent = entry.review === 'pending' ? 'Reject this item?' : 'Delete this item?';
  $('remove-label').textContent = recordTitle(entry.record);
  const dialog = $('remove-dialog');
  dialog.returnValue = '';
  dialog.showModal();
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'confirm') return;
    try {
      await collection.remove(entry.id, entry.revision);
      closeEditor();
      await refresh();
      feedback(entry.review === 'pending' ? 'Item rejected.' : 'Item deleted.');
    } catch (error) { feedback(error.message, true); }
  }, { once: true });
}

function renderList() {
  const list = $('entries');
  const fragment = document.createDocumentFragment();
  const visible = visibleEntries();
  for (const entry of visible) {
    const record = entry.record ?? entry.conflict?.record;
    const row = ui('li', '', 'row-item');
    const details = ui('div');
    details.append(ui('strong', record ? recordTitle(record) : 'Deleted item'));
    if (record) {
      const metadata = [TARGETS[record.target], record.createdAt.slice(0, 10),
        inbox ? (entry.review === 'pending' ? 'Needs review' : 'Accepted privately') : SYNC_STATES[record.syncStatus],
        ...record.tags];
      details.append(ui('p', metadata.join(' · '), 'meta'));
    }
    const actions = ui('div', '', 'actions');
    if (entry.conflict) {
      const local = entry.record ? recordTitle(entry.record) : 'Deleted on this device';
      const remote = entry.conflict.record ? recordTitle(entry.conflict.record) : 'Deleted by provider';
      details.append(ui('p', `Conflict · Local: ${local} · Remote: ${remote}`, 'meta'));
      const compare = ui('details');
      compare.append(ui('summary', 'Compare complete versions'));
      compare.append(ui('pre', JSON.stringify({ local: entry.record, remote: entry.conflict.record }, null, 2)));
      details.append(compare);
      for (const choice of ['local', 'remote']) {
        actions.append(button(choice === 'local' ? 'Keep local' : 'Use remote', async () => {
          if (!window.confirm(choice === 'local' ? 'Keep the local version?' : 'Replace the local version with the remote version?')) return;
          await sync.resolve(entry.id, choice, entry.conflict.version);
          await refresh();
        }));
      }
    } else {
      actions.append(button('Edit', () => showEditor(entry.record, entry)));
      if (inbox && entry.review === 'pending') {
        actions.append(button('Accept privately', async () => {
          await collection.accept(entry.id, entry.revision);
          await refresh();
          feedback('Accepted in this private Inbox.');
        }));
      }
      actions.append(button(inbox && entry.review === 'pending' ? 'Reject' : 'Delete', () => showRemoval(entry)));
    }
    row.append(details, actions);
    fragment.append(row);
  }
  list.replaceChildren(fragment);
  $('count').textContent = `${visible.length} of ${entries.length} items`;
}

function closeEditor() {
  currentEdit += 1;
  $('editor').hidden = true;
  $('editor').replaceChildren();
}

function editArticle(parent, data, redraw) {
  const content = data.content;
  const group = ui('div', '', 'fields');
  group.append(field('Title', content.title, (value) => { content.title = value; }),
    field('Author', content.author, (value) => { content.author = value; }),
    field('Publication date', content.published, (value) => { content.published = value; }));
  parent.append(group);
  if (data.metadata.sourceUrl) {
    const label = ui('label', '', 'check');
    const keep = ui('input');
    keep.type = 'checkbox';
    keep.checked = !data.dropSource;
    keep.addEventListener('change', () => { data.dropSource = !keep.checked; });
    label.append(keep, 'Keep source URL');
    parent.append(label, ui('p', data.metadata.sourceUrl, 'meta'));
  }
  content.blocks.forEach((block, index) => {
    const segment = ui('fieldset');
    segment.append(ui('legend', `${block.type} ${index + 1}`));
    segment.append(field('Text', block.text, (value) => { block.text = value; }, { multiline: true }));
    segment.append(button('Remove block', () => { content.blocks.splice(index, 1); redraw(); }));
    parent.append(segment);
  });
}

function editTerm(parent, data, redraw) {
  const content = data.content;
  const info = ui('div', '', 'fields');
  info.append(field('Expression', content.text, (value) => { content.text = value; }),
    field('Base form', content.lemma, (value) => { content.lemma = value; }),
    field('Page source URL', data.metadata.sourceUrl, (value) => { data.metadata.sourceUrl = value; }));
  parent.append(info, field('Page excerpt', data.metadata.excerpt,
    (value) => { data.metadata.excerpt = value; }, { multiline: true }),
  field('Private note', content.note, (value) => { content.note = value; }, { multiline: true }));
  parent.append(button('Add meaning', () => {
    content.meanings.push({ part: 'Unspecified', senses: [{ english: '', chinese: '', examples: [] }] });
    redraw();
    parent.querySelector('details').open = true;
  }));
  if (content.pronunciations.length || content.meanings.length) {
    const details = ui('details');
    details.append(ui('summary', 'Dictionary fields'));
    for (const item of content.pronunciations) {
      details.append(field(`IPA · ${item.accent || 'Unspecified accent'}`, item.ipa, (value) => { item.ipa = value; }));
    }
    for (const meaning of content.meanings) {
      const set = ui('fieldset');
      set.append(ui('legend', meaning.part),
        field('Part of speech', meaning.part, (value) => { meaning.part = value; }));
      for (const sense of meaning.senses) {
        set.append(field('English definition', sense.english, (value) => { sense.english = value; }, { multiline: true }),
          field('Chinese definition', sense.chinese, (value) => { sense.chinese = value; }, { multiline: true }));
        set.append(button('Add example', () => {
          sense.examples.push({ text: '', translation: '' });
          redraw();
          parent.querySelector('details').open = true;
        }));
        for (const example of sense.examples) {
          set.append(field('English example', example.text, (value) => { example.text = value; }),
            field('Example translation', example.translation, (value) => { example.translation = value; }));
        }
      }
      details.append(set);
    }
    parent.append(details);
  }
}

function showEditor(record, entry) {
  const serial = ++currentEdit;
  const data = structuredClone(record);
  const region = $('editor');
  region.hidden = false;
  function draw() {
    const title = ui('h2', data.type === 'article' && !entry ? 'Review article before saving' : 'Edit Collection');
    title.id = 'editor-title';
    title.tabIndex = -1;
    const bulk = ui('div', '', 'fields');
    const targetLabel = ui('label', 'Collection Type');
    const target = ui('select');
    targetChoices(target, data.type);
    target.value = data.target;
    target.addEventListener('change', () => { data.target = target.value; });
    targetLabel.append(target);
    bulk.append(targetLabel, field('Tags (comma-separated)', data.tags.join(', '),
      (value) => { data.tags = value.split(',').map((name) => name.trim()).filter(Boolean); }));
    region.replaceChildren(title, bulk);
    if (data.type === 'article') editArticle(region, data, draw);
    else editTerm(region, data, draw);
    if (inbox) {
      const mapping = ui('details');
      mapping.append(ui('summary', 'Private website mapping'));
      const output = ui('pre');
      mapping.append(output);
      mapping.addEventListener('toggle', () => {
        try { output.textContent = JSON.stringify(websiteDraft(data), null, 2); }
        catch (error) { output.textContent = error.message; }
      });
      region.append(mapping);
    }
    const actions = ui('div', '', 'actions');
    actions.append(button(entry ? 'Save changes' : 'Save privately', async () => {
      const draft = { ...data, metadata: { ...data.metadata, sourceUrl: data.dropSource ? '' : data.metadata.sourceUrl } };
      const status = entry ? (await collection.edit(entry.id, entry.revision, draft), false) : (await collection.save(draft)).duplicate;
      if (currentEdit === serial) closeEditor();
      await refresh();
      feedback(status ? 'This article is already in Collections.' : 'Saved privately.');
    }), button('Cancel edit', closeEditor));
    region.append(actions);
    return title;
  }
  draw().focus({ preventScroll: true });
  region.scrollIntoView({ block: 'start' });
}

function showPreview(rows) {
  const count = rows.filter(({ action }) => action === 'add').length;
  $('preview-count').textContent = `${count} new · ${rows.length - count} duplicates or conflicts`;
  $('preview-records').replaceChildren(...rows.slice(0, 200).map(({ record, action }) =>
    ui('li', `${recordTitle(record)} · ${TARGETS[record.target]} · ${action}`)));
  if (rows.length > 200) $('preview-records').append(ui('li', `And ${rows.length - 200} more records`));
  $('import-confirm').disabled = !count;
  $('preview').hidden = false;
}

function resetPreview() {
  clickedFile += 1;
  importRows = [];
  $('preview').hidden = true;
  $('file').value = '';
}

function download(subset) {
  const json = exportArchive(subset.flatMap((entry) => entry.record ? [entry.record] : []));
  const objectUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = ui('a');
  anchor.href = objectUrl;
  anchor.download = 'taslexicon-private-collections.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function initialize() {
  const db = createIndexedDBStore(globalThis.indexedDB, inbox ? 'taslexicon-website-collection-inbox' : 'taslexicon-extension-collections');
  collection = createCollection(db, { inbox });
  sync = createSyncEngine(db);
  sync.start(window);
  if (inbox) {
    $('title').textContent = 'Collection Inbox';
    $('home-link').href = '../index.html';
    $('privacy').textContent = 'Private review on this browser. Accepted records stay here.';
    theme(localStorage.getItem('taslexicon-inbox-theme'));
  } else {
    theme((await browser?.storage?.local.get('theme'))?.theme);
    browser?.storage?.onChanged?.addListener((changes, area) => {
      if (area === 'local' && changes.theme) theme(changes.theme.newValue);
    });
  }
  $('theme').addEventListener('change', () => {
    const picked = $('theme').value;
    theme(picked);
    if (inbox) localStorage.setItem('taslexicon-inbox-theme', picked);
    else browser?.storage?.local.set({ theme: picked }).catch((error) => feedback(error.message, true));
  });
  targetChoices($('filter'), null, true);
  for (const id of ['search', 'filter', 'sort']) $(id).addEventListener('input', renderList);
  $('file').addEventListener('change', async () => {
    const file = $('file').files[0];
    const serial = ++clickedFile;
    importRows = [];
    $('preview').hidden = true;
    feedback();
    if (!file) return;
    try {
      if (file.size > MAX_FILE) throw new Error('This archive is too large.');
      const incoming = parseArchive(await file.text());
      const rows = await collection.preview(incoming);
      if (serial !== clickedFile) return;
      importRows = incoming;
      showPreview(rows);
    } catch (error) { if (serial === clickedFile) feedback(error.message, true); }
  });
  $('import-confirm').addEventListener('click', async () => {
    $('import-confirm').disabled = true;
    try {
      const rows = await collection.import(importRows);
      resetPreview();
      await refresh();
      feedback(`Imported ${rows.filter(({ action }) => action === 'add').length} new items.`);
    } catch (error) { feedback(error.message, true); $('import-confirm').disabled = false; }
  });
  $('import-cancel').addEventListener('click', resetPreview);
  for (const [id, select] of [['export', () => entries], ['export-filtered', visibleEntries]]) {
    $(id).addEventListener('click', () => { try { download(select()); } catch (error) { feedback(error.message, true); } });
  }
  const capture = query.get('capture');
  if (!inbox && browser?.runtime && capture && /^[0-9a-f]{32}$/u.test(capture)) {
    $('capture').hidden = false;
    $('extract').addEventListener('click', async (event) => {
      if (!event.isTrusted) return;
      $('extract').disabled = true;
      try {
        const result = await browser.runtime.sendMessage({ type: 'taslexicon:article-extract', ticket: capture });
        if (!result?.draft) throw new Error(result?.error || 'No readable article was found.');
        $('capture').hidden = true;
        showEditor(result.draft);
      } catch (error) { feedback(error.message, true); }
      finally { $('extract').disabled = false; }
    });
  }
  await refresh();
  if (window.location.hash === '#search') $('search').focus();
  const edit = query.get('edit');
  const item = edit && entries.find((entry) => entry.id === edit && entry.record);
  if (item) showEditor(item.record, item);
}

void initialize().catch((error) => feedback(error.message || 'Could not open the private collection.', true));
