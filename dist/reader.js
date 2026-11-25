(() => {
 'use strict';
 const audio=window.notebookSpeech;
 const contexts=JSON.parse(document.querySelector('#reading-context').textContent);
 const paragraphs=[...document.querySelectorAll('#nap-text .nap-paragraph,.reading-text .nap-paragraph')];
 const font=document.querySelector('#reader-size');
 const fontKey='vocab.reader.font-size';
 function applyFont(value){
  if(!['17','20','23'].includes(value))value='20';
  font.value=value;
  document.documentElement.style.setProperty('--reader-size',value+'px');
 }
 try{applyFont(localStorage.getItem(fontKey))}catch{}
 font.onchange=()=>{applyFont(font.value);try{localStorage.setItem(fontKey,font.value)}catch{}};
 for(const p of paragraphs){
  const translation=document.getElementById(p.id.replace(/-([A-Z])$/,'-zh-$1'));
  if(!translation)continue;
  const details=document.createElement('details'),summary=document.createElement('summary');
  details.className='para-translation';summary.textContent=window.notebookText.showTranslation;
  const copy=document.createElement('p');copy.lang='zh-CN';
  copy.textContent=translation.textContent.replace(/^\[[A-Z]\]\s*/,'');
  details.append(summary,copy);p.after(details);
  details.ontoggle=()=>{summary.textContent=details.open?window.notebookText.hideTranslation:window.notebookText.showTranslation};
 }

 function addText(parent,tag,value,style){
  if(!value)return;
  const el=document.createElement(tag);el.textContent=value;
  if(style)el.className=style;
  parent.append(el);return el;
 }
 async function fetchJSON(path){
  const response=await fetch(path);if(!response.ok)throw Error(path);
  return response.json();
 }
 Promise.all([window.notebook.loadSearchIndex(), fetchJSON('article-dictionary.json'), import('./dictionary-ui.mjs')])
  .then(([index,dictionary,presentation]) => setupLookup(index.records, dictionary, presentation))
  .catch(() => { document.querySelector('#reader-status').textContent = 'Could not load the dictionary. Please refresh the page.'; });

 function setupLookup(records, dictionary, presentation) {
  const candidates = new Map(Object.entries(dictionary).map(([word, fields]) => [word, [{ kind: '文章词典', fields }]]));
  for (const row of records) {
   if (!['词汇辨析', '多义词', '阅读词汇'].includes(row.kind) || !row.fields['英文释义'] || !/^[a-z]+$/i.test(row.title)) continue;
   const key = row.title.toLowerCase();
   candidates.set(key, [...(candidates.get(key) ?? []), row]);
  }
  const dialog = document.createElement('dialog');
  dialog.id = 'lookup-card';
  dialog.setAttribute('aria-labelledby', 'lookup-title');
  let trigger, current, mode, engineRequest, generation = 0;
  const historyStack = [];
  const storage = {
   read(key, fallback) { try { return JSON.parse(localStorage.getItem('vocab.lookup.' + key)) ?? fallback; } catch { return fallback; } },
   write(key, value) { try { localStorage.setItem('vocab.lookup.' + key, JSON.stringify(value)); return true; } catch { return false; } },
  };
  let aware = storage.read('awareness', false);
  let marks = [];
  let saved = storage.read('saved', []);
  if (!Array.isArray(saved)) saved = [];
  let markedCandidate;
  let engine;
  const ui = presentation.createDictionaryPanel(document, {
   close: () => dismiss(),
   resize: position,
   back() {
    if (!historyStack.length) return;
    audio.stopWithin(dialog);
    ({ current, mode } = historyStack.pop());
    render(true);
    ui.scroll.focus({ preventScroll: true });
   },
   lookup,
   mode(value) { audio.stopWithin(dialog); mode = value; render(); },
   speak: audio.supported ? playLocal : undefined,
   rate: audio.setRate,
   stop: () => audio.stopWithin(dialog),
   follow() {
    const paragraph = trigger?.closest('.nap-paragraph');
    if (paragraph) window.history.replaceState(null, '', '#' + paragraph.id);
   },
  });
  function playLocal(text, accent, owner) {
   if (accent) audio.setAccent(accent === 'GB' ? 'en-GB' : 'en-US');
   const locale = audio.getAccent().toLowerCase();
   const voice = speechSynthesis.getVoices().find(v => v.localService === true && v.lang.toLowerCase() === locale);
   if (!voice) { ui.speechStatus.textContent = 'No device voice for this accent is available.'; return; }
   const utterance = new SpeechSynthesisUtterance(text);
   utterance.voice = voice;
   utterance.lang = voice.lang;
   utterance.rate = audio.getRate();
   const job = audio.claim(owner, () => {
    utterance.onend = utterance.onerror = null;
    speechSynthesis.cancel();
    ui.speechStatus.textContent = '';
   });
   utterance.onend = () => { if (job.finish()) ui.speechStatus.textContent = ''; };
   utterance.onerror = () => { if (job.finish()) ui.speechStatus.textContent = 'Could not read aloud.'; };
   ui.speechStatus.textContent = 'Reading aloud…';
   try { speechSynthesis.speak(utterance); } catch { utterance.onerror(); }
  }
  ui.rate.value = String(audio.getRate());
  dialog.append(ui.panel);
  document.body.append(dialog);

  const utilities = document.createElement('details');
  const settingsTitle = addText(utilities, 'summary', 'Dictionary settings and saved entries');
  settingsTitle.className = 'lex-label';
  const awarenessLabel = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = aware;
  checkbox.onchange = () => { aware = checkbox.checked; storage.write('awareness', aware); paint(); };
  awarenessLabel.append(checkbox, ' Mark detected expressions');
  const save = addText(utilities, 'button', 'Save locally');
  save.type = 'button';
  const savedList = document.createElement('ul');
  const saveStatus = addText(utilities, 'p', ' ', 'lex-metadata');
  saveStatus.setAttribute('role', 'status');
  utilities.append(awarenessLabel, savedList, saveStatus);
  ui.extras.append(utilities);
  function savedEntries() {
   savedList.replaceChildren();
   for (const term of saved) {
    const li = document.createElement('li');
    const word = addText(li, 'button', term);
    word.type = 'button';
    word.onclick = () => lookup(term);
    savedList.append(li);
   }
  }
  save.onclick = () => {
   if (!current) return;
   const expression = current.expression;
   const term = expression && (mode === 'expression' || mode !== 'word' && expression.confidence === 'supported') ? expression.title : current.selected;
   const alreadySaved = saved.includes(term);
   const next = alreadySaved ? saved.filter(value => value !== term) : [term, ...saved].slice(0, 150);
   if (storage.write('saved', next)) { saved = next; savedEntries(); render(); saveStatus.textContent = alreadySaved ? 'Removed.' : 'Saved on this device.'; }
   else saveStatus.textContent = 'Local storage is unavailable.';
  };
  savedEntries();
  const help = addText(document.body, 'span', 'Use Left and Right arrows to choose a word, Enter to look up, and Escape to close.', 'sr-only');
  help.id = 'lookup-help';

  async function loadEngine() {
   const core = await import('./reader-dictionary/index.mjs');
   const manifest = await fetchJSON('./reader-dictionary/manifest.json');
   const parts = await Promise.all(manifest.parts.map(async part => {
    const response = await fetch('./reader-dictionary/' + part);
    if (!response.ok) throw Error('Dictionary asset unavailable');
    return new Uint8Array(await response.arrayBuffer());
   }));
   const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'));
   const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
   if (!crypto.subtle) return core.createLookupEngine(JSON.parse(new TextDecoder().decode(bytes)));
   const store = core.createDictionaryStore(async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    value => value.toString(16).padStart(2, '0')).join(''));
   return (await store.install(bytes, manifest)).engine;
  }
  function position() {
   if (!dialog.open || !trigger) return;
   const visual = window.visualViewport;
   const viewport = { left: visual?.offsetLeft, top: visual?.offsetTop, width: visual?.width ?? document.documentElement.clientWidth,
    height: visual?.height ?? innerHeight };
   const sidebar = document.querySelector('.sidebar');
   const edge = sidebar?.getBoundingClientRect().right ?? 0;
   const gutter = edge < 135 ? edge : 0;
   const box = presentation.geometry(trigger.getBoundingClientRect(), viewport, { expanded: ui.expanded, gutter, safe: ui.insets() });
   ui.setLayout(box.layout);
   for (const key of ['left', 'top', 'width', 'height']) dialog.style[key] = box[key] + 'px';
  }
  function clearMarks() { for (const button of marks) button.classList.remove('lex-aware'); marks = []; }
  function paint() {
   clearMarks();
   if (!aware || !markedCandidate || !dialog.open) return;
   const { spans, candidate } = markedCandidate;
   marks = spans.filter(row => candidate.components.some(component => row.start < component.end && row.end > component.start)).map(row => row.button);
   for (const button of marks) button.classList.add('lex-aware');
  }
  function dismiss(restore = true) {
   if (!dialog.open) return;
   generation++;
   audio.stopWithin(dialog);
   dialog.close();
   clearMarks();
   trigger?.removeAttribute('aria-expanded');
   if (restore) trigger?.focus({ preventScroll: true });
  }
  function render(reset) {
   if (!current) return;
   ui.render({ ...current, canBack: historyStack.length > 0 }, { reset, mode });
   const expression = current.expression;
   const term = expression && (mode === 'expression' || mode !== 'word' && expression.confidence === 'supported') ? expression.title : current.selected;
   save.textContent = saved.includes(term) ? 'Remove saved entry' : 'Save locally';
   position();
  }
  function basic(term, button) {
   const rows = candidates.get(term.toLowerCase()) ?? [];
   const primary = (button?.closest('#nap-text') && rows.find(row => row.kind === '阅读词汇')) ||
    rows.find(row => row.kind === '文章词典') || rows[0];
   const fields = primary?.fields ?? {};
   const entryLink = rows.find(row => row.target);
   const senses = rows.map(({ fields }) => ({ zh: fields['中文意思'] || fields['释义'], en: fields['英文释义'], part: fields['词性'] }));
   return { title: fields['词条'] || term, primary: { zh: fields['中文意思'] || fields['释义'], en: fields['英文释义'] },
    ipa: fields['音标'] || fields.IPA, others: senses.filter(row => row.en && row.en !== fields['英文释义']),
    href: entryLink && (entryLink.target.startsWith('nap-') ? 'nap.html#' : 'index.html#') + entryLink.target };
  }
  function modelFor(term) {
   const match = (engine?.lookupExpression(term).matches[0] ?? engine?.lookupWord(term).matches[0])?.entry;
   return { selected: term, word: presentation.fromEntry(match) ?? basic(term) };
  }
  function lookup(term) {
   if (!current || !term.trim() || term.length > 160) return;
   audio.stopWithin(dialog);
   generation++;
   historyStack.push({ current, mode });
   if (historyStack.length > 20) historyStack.shift();
   current = modelFor(term);
   mode = undefined;
   render(true);
   ui.scroll.focus({ preventScroll: true });
  }
  function readingBlock(button) {
   const block = button.parentElement;
   const allowed = node => node && (node.nodeType === 3 || node.matches?.('button.lookup-word'));
   let first = button;
   while (allowed(first.previousSibling)) first = first.previousSibling;
   let text = '';
   let anchor;
   const spans = [];
   for (let node = first; allowed(node); node = node.nextSibling) {
    const start = text.length;
    text += node.textContent;
    if (node.nodeType !== 3) {
     const span = { start, end: text.length };
     if (node === button) anchor = span;
     spans.push({ ...span, button: node });
    }
   }
   const paragraphId = block.id;
   return { text, anchor, spans, scope: { articleId: paragraphId.slice(0, paragraphId.lastIndexOf('-')), paragraphId } };
  }
  function activate(button, context, keyboard) {
   const serial = ++generation;
   audio.stop();
   clearMarks();
   markedCandidate = undefined;
   trigger?.removeAttribute('aria-expanded');
   trigger = button;
   trigger.setAttribute('aria-expanded', 'true');
   if (!dialog.open) { ui.resetSheet(); dialog.show(); }
   // Safari and Chromium may focus the first dialog control on show. Restore the anchor without scrolling.
   (keyboard ? ui.close : button).focus({ preventScroll: true });
   historyStack.length = 0;
   mode = undefined;
   const selected = button.textContent;
   const block = readingBlock(button);
   current = { selected, word: basic(selected, button) };
   if (context) current.expression = { title: context[0], primary: { zh: context[2], en: context[3] }, confidence: 'supported' };
   render(true);
   engineRequest ??= loadEngine().catch(() => undefined);
   void engineRequest.then(loaded => {
    if (!loaded || serial !== generation || !dialog.open) return;
    engine = loaded;
    const analysis = engine.analyzeContext(block);
    const smart = presentation.fromContext(analysis);
    current = { ...current, ...smart, expression: smart.expression ?? current.expression,
     word: { ...current.word, ...smart.word, href: smart.word?.href ?? current.word.href,
      contextual: smart.contextualWord }, selected };
    const preferred = analysis.candidates[0];
    if (presentation.canMark(preferred)) markedCandidate = { spans: block.spans, candidate: preferred };
    paint();
    render();
   });
  }
  document.addEventListener('pointerdown', event => {
   if (dialog.open && !dialog.contains(event.target) && !event.target.closest('.lookup-word')) dismiss(false);
  });
  for (const event of ['resize', 'scroll']) {
   window.addEventListener(event, position, { passive: true });
   window.visualViewport?.addEventListener(event, position, { passive: true });
  }
  window.addEventListener('hashchange', () => dismiss(false));
  document.addEventListener('notebook:search-open', () => dismiss());
  dialog.oncancel = event => { event.preventDefault(); dismiss(); };
  document.addEventListener('keydown', event => {
   if (event.key === 'Escape' && dialog.open) { event.preventDefault(); dismiss(); }
  });
  let selectionTimer;
  function nativeSelection() {
   clearTimeout(selectionTimer);
   selectionTimer = setTimeout(() => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
    const range = selection.getRangeAt(0);
    const button = range.startContainer.parentElement?.closest('.lookup-word');
    if (button && button !== trigger && button.contains(range.endContainer) &&
        selection.toString().trim() === button.textContent) activate(button, button.lexContext, false);
   }, 100);
  }
  document.addEventListener('pointerup', nativeSelection, { passive: true });
  document.addEventListener('selectionchange', nativeSelection);
  const headings=document.querySelectorAll('.reading-title,#reader > .part-heading h1');
  for(const p of [...paragraphs,...headings]){
   const entries=contexts[p.id]||[];
   for(const node of [...p.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE)){
    const text=node.textContent,fragment=document.createDocumentFragment();
    const spans=[];
    for(const entry of entries){
     const lower=text.toLowerCase(),phrase=entry[0].toLowerCase();
     let at=lower.indexOf(phrase);
     while(at!==-1){
      const end=at+phrase.length;
      if(!/[a-z]/i.test(text[at-1]||'')&&!/[a-z]/i.test(text[end]||''))spans.push({at,end,entry});
      at=lower.indexOf(phrase,end);
     }
    }
    spans.sort((a,b)=>(b.end-b.at)-(a.end-a.at));
    let start=0;
    for(const match of text.matchAll(/(?:[A-Za-z]\.){2,}|[A-Za-z]+(?:[-'’][A-Za-z]+)*/g)){
     fragment.append(document.createTextNode(text.slice(start,match.index)));
     const b=addText(fragment,'button',match[0],'lookup-word');
     b.type='button';b.dataset.lookup=match[0].toLowerCase().replace(/’/g,"'");
     const span=spans.find(s=>match.index>=s.at&&match.index+match[0].length<=s.end);
     b.setAttribute('aria-label','Look up '+(span?.entry[0]||match[0]));
     b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','lookup-card');b.setAttribute('aria-describedby','lookup-help');b.lexContext=span?.entry;b.onclick=ev=>activate(b,b.lexContext,ev.detail===0);
     start=match.index+match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(start)));node.replaceWith(fragment);
   }
   const words=[...p.querySelectorAll('.lookup-word')];
   words.forEach((word,i)=>{
    word.tabIndex=i===0?0:-1;
    word.addEventListener('focus',()=>words.forEach(w=>w.tabIndex=w===word?0:-1));
    word.addEventListener('keydown',ev=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)||ev.altKey||ev.ctrlKey||ev.metaKey)return;
     ev.preventDefault();const next=ev.key==='Home'?0:ev.key==='End'?words.length-1:Math.max(0,Math.min(words.length-1,i+(ev.key==='ArrowRight'?1:-1)));
     // Explicit word navigation must reveal its destination; opening lookup still preserves scroll.
     words[next].focus();
    });
   });
  }
 }
})();
