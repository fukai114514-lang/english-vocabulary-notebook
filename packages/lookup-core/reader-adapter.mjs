// Optional host for the candidate. Reuse the site's open card and native selection.
import { createDictionaryStore } from './index.mjs';

const store = createDictionaryStore(async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(n => n.toString(16).padStart(2, '0')).join(''));
async function resource(name) {
  const response = await fetch(new URL(name, import.meta.url), { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Lookup resources unavailable');
  return response;
}
const ready = Promise.all([resource('lookup-dictionary.json').then(r => r.arrayBuffer()),
  resource('lookup-manifest.json').then(r => r.json())])
  .then(([bytes, manifest]) => store.install(new Uint8Array(bytes), manifest)).catch(() => null);
let turn = 0;
let marked = [];
function clear() {
  turn++;
  for (const button of marked) button.classList.remove('context-expression');
  marked = [];
  document.querySelector('#smart-lookup-result')?.remove();
}
const css = document.createElement('style');
css.textContent = '.context-expression{background:var(--surface-raised,rgba(128,128,128,.18));border-radius:.15em}#smart-lookup-result{border-bottom:1px solid currentColor;margin-bottom:.6em;padding-bottom:.5em}#smart-lookup-result p{margin:.3em 0}';
document.head.append(css);

function readingBlock(button) {
  // The existing reader supplies individual word buttons and literal text siblings.
  // Other elements are content boundaries, including links and editable controls.
  const block = button.parentElement;
  if (!block?.matches('.nap-paragraph,.reading-title,#reader > .part-heading h1') || block.closest('[contenteditable]')) return null;
  const eligible = node => node.nodeType === Node.TEXT_NODE || node.matches?.('button.lookup-word:not([hidden])');
  let first = button;
  while (first.previousSibling && eligible(first.previousSibling)) first = first.previousSibling;
  let text = '';
  let anchor;
  const words = [];
  for (let node = first; node && eligible(node); node = node.nextSibling) {
    const start = text.length;
    text += node.textContent;
    if (node.nodeType === Node.TEXT_NODE) continue;
    const span = { start, end: text.length };
    words.push({ node, ...span });
    if (node === button) anchor = span;
  }
  const articleId = block.id.slice(0, block.id.lastIndexOf('-'));
  return { text, anchor, words, scope: { articleId, paragraphId: block.id } };
}

async function render(button) {
  clear();
  const request = turn;
  await ready;
  const body = document.querySelector('#lookup-card[open] .lookup-body');
  if (!store.current || request !== turn || !body || button.getAttribute('aria-expanded') !== 'true') return;
  const block = readingBlock(button);
  if (!block) return;
  const { candidates, senses, wordFallback } = store.current.analyzeContext(block);
  if (!candidates.length && !wordFallback.query) return;
  const section = document.createElement('section');
  section.id = 'smart-lookup-result';
  section.setAttribute('aria-label', 'Contextual lookup');
  const line = (parent, tag, value) => {
    const el = document.createElement(tag);
    el.textContent = value;
    parent.append(el);
    return el;
  };
  const preferred = candidates[0];
  if (preferred) {
    line(section, 'strong', (preferred.confidence === 'supported' ? 'Expression · ' : 'Possible expression · ') + preferred.surface);
    for (const c of candidates.slice(0, 3)) {
      const sense = c.entry.senses[0];
      line(section, 'p', [c.entry.lemma, sense.meaningZh || sense.definitionEn].filter(Boolean).join(' · '));
    }
    if (preferred.confidence === 'supported') {
      marked = block.words.filter(w => w.start >= preferred.span.start && w.end <= preferred.span.end).map(w => w.node);
      for (const node of marked) node.classList.add('context-expression');
    }
  }
  if (senses.length) {
    const label = senses[0].confidence === 'supported' ? 'Word in context' : 'Word meanings';
    line(section, 'p', label + ' · ' + wordFallback.query);
    for (const { sense } of senses.slice(0, 3)) line(section, 'p', sense.meaningZh || sense.definitionEn);
  } else line(section, 'p', 'Word · ' + wordFallback.query + ' · No entry in the local dictionary.');
  const why = document.createElement('details');
  line(why, 'summary', 'Match evidence');
  for (const item of [preferred, senses[0]].filter(Boolean)) {
    line(why, 'p', [item.confidence, ...item.evidence].join(' · '));
  }
  section.append(why);
  body.prepend(section);
}

document.addEventListener('click', event => {
  const word = event.target.closest?.('.lookup-word');
  if (word) void render(word);
  else if (!event.target.closest?.('#lookup-card')) clear();
});
function lookupSelection() {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
  const range = selection.getRangeAt(0);
  const word = range.startContainer.parentElement?.closest('.lookup-word');
  if (!word || !word.contains(range.endContainer) || selection.toString().trim() !== word.textContent) return;
  word.click();
}
document.addEventListener('pointerup', lookupSelection);
document.addEventListener('keyup', e => { if (e.shiftKey) lookupSelection(); });
document.addEventListener('selectionchange', () => {
  // Touch selection handles can settle after pointerup on mobile.
  if (!document.getSelection()?.isCollapsed && document.activeElement?.tagName !== 'INPUT') {
    const selection = document.getSelection();
    const word = selection.anchorNode?.parentElement?.closest('.lookup-word');
    if (word && word.getAttribute('aria-expanded') !== 'true') lookupSelection();
  }
});
document.addEventListener('toggle', event => {
  if (event.target.id === 'lookup-card' && !event.target.open) clear();
}, true);
