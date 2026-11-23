window.notebookText = {"comparisonFull": "Full comparison", "comparisonCards": "Word cards", "searchHint": "Search words, examples, and articles", "searchError": "Could not load search. Close and try again.", "searchLoading": "Loading search…", "searchEmpty": "No matches. Try another spelling or a Chinese keyword.", "showTranslation": "Show translation", "hideTranslation": "Hide translation", "dictionaryTitle": "English and Chinese definitions", "close": "Close", "closeDictionary": "Close definitions and return to the article", "commonMeaning": "Common meaning", "articleMeaning": "Meaning in this article", "listen": "▷ Listen", "articleStats": "Original · {0}–{1} · {2} vocabulary items · {3} phrases", "match": " match", "matches": " matches"};
(() => {
  'use strict';

  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const accentKey = 'vocab-accent';
  const rateKey = 'vocab.example.rate';
  const accents = ['en-US', 'en-GB'];
  const rates = [0.75, 1, 1.25];
  let active;

  function read(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function save(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch {}
  }

  let accent = read(accentKey) === 'en-GB' ? 'en-GB' : 'en-US';
  const savedRate = Number(read(rateKey));
  let rate = rates.includes(savedRate) ? savedRate : 1;

  function stop(owner) {
    if (!active || (owner && active.owner !== owner)) return;
    const task = active;
    active = null;
    task.interrupt();
  }

  function stopWithin(container) {
    if (active && container.contains(active.owner)) stop();
  }

  // Speech, microphone capture, and recorded audio share one active operation.
  function claim(owner, interrupt) {
    stop();
    const task = { owner, interrupt };
    active = task;
    return {
      isCurrent: () => active === task,
      finish() {
        if (active !== task) return false;
        active = null;
        return true;
      },
    };
  }

  function setAccent(value) {
    if (!accents.includes(value) || value === accent) return;
    accent = value;
    save(accentKey, accent);
    document.dispatchEvent(new Event('notebook:accent-change'));
  }

  function setRate(value) {
    if (!rates.includes(value)) return;
    rate = value;
    save(rateKey, rate);
  }

  function play(owner, text, { rate: speed = rate, onState = () => {} } = {}) {
    if (!supported || !text) return;
    let utterance;
    const detach = () => {
      if (utterance) utterance.onend = utterance.onerror = null;
    };
    const job = claim(owner, () => {
      detach();
      synth.cancel();
      onState('stopped', 'Reading stopped.');
    });
    const complete = (phase, message) => {
      if (!job.finish()) return;
      detach();
      onState(phase, message);
    };

    try {
      utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = accent;
      utterance.rate = speed;
      const voices = synth.getVoices();
      const locale = voice => voice.lang.replace(/_/g, '-').toLowerCase();
      const exact = voices.find(voice => locale(voice) === accent.toLowerCase());
      const english = exact || voices.find(voice => /^en(?:-|$)/.test(locale(voice)));
      if (english) utterance.voice = english;
      const hint = exact ? '' : english
        ? ' Selected accent unavailable. Using an available English voice.'
        : ' Using the system voice. Accent depends on your device.';
      utterance.onend = () => complete('finished', 'Finished reading.');
      utterance.onerror = ({ error }) => {
        if (error === 'canceled' || error === 'interrupted') {
          complete('stopped', 'Reading stopped.');
          return;
        }
        complete('error', error === 'not-allowed'
          ? 'Read aloud was blocked. Tap Listen again.'
          : 'Could not read aloud. Check your device’s English voice settings and try again.');
      };
      onState('playing', 'Reading aloud.' + hint);
      synth.speak(utterance);
    } catch {
      complete('error', 'Could not start read aloud. Tap Listen to try again.');
    }
  }

  function toggleWord(button, status, text) {
    if (active?.owner === button) {
      stop(button);
      return;
    }
    play(button, text, {
      rate: 0.85,
      onState(phase, message) {
        const playing = phase === 'playing';
        button.classList.toggle('speaking', playing);
        button.setAttribute('aria-pressed', String(playing));
        status.hidden = false;
        status.textContent = playing || phase === 'finished' ? text + ' · ' + message : message;
      },
    });
  }

  function bindReferenceWords() {
    const picker = document.querySelector('#accent');
    const status = document.querySelector('#speech-status');
    const list = document.querySelector('#list');
    if (!supported) {
      status.textContent = 'Read aloud is unavailable in this browser.';
      list.querySelectorAll('.speak').forEach(button => { button.disabled = true; });
      return;
    }
    picker.value = accent;
    picker.addEventListener('change', () => {
      if (active && list.contains(active.owner)) stop();
      setAccent(picker.value);
      status.textContent = 'Voice changed. Tap Listen next to a word to try it.';
    });
    document.addEventListener('notebook:accent-change', () => { picker.value = accent; });
    list.addEventListener('click', event => {
      const button = event.target.closest('.speak');
      if (button) toggleWord(button, status, button.dataset.word);
    });
  }

  window.notebookSpeech = {
    supported, claim, stop, stopWithin, play, toggleWord, bindReferenceWords,
    getAccent: () => accent, getRate: () => rate, setAccent, setRate,
  };

  window.addEventListener('pagehide', () => stop());
  window.addEventListener('hashchange', () => stop());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  document.addEventListener('toggle', event => {
    if (event.target.tagName === 'DETAILS' && !event.target.open) stopWithin(event.target);
  }, true);
})();

(() => {
  'use strict';

  function createPracticeRecording(environment, audio, owner, update) {
    const devices = environment.navigator.mediaDevices;
    const supported = typeof environment.MediaRecorder === 'function' &&
      typeof devices?.getUserMedia === 'function';
    let capture;
    let clip;

    function releaseStream(stream) {
      stream?.getTracks().forEach(track => track.stop());
    }

    function releaseCapture(session, cancel) {
      capture = null;
      const { recorder, stream } = session;
      if (recorder) {
        recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        if (cancel && recorder.state !== 'inactive') {
          try { recorder.stop(); } catch {}
        }
      }
      releaseStream(stream);
      session.chunks.length = 0;
    }

    function recordError(error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
        return 'Microphone access was denied. Allow it in your browser’s site settings and try again.';
      }
      if (error?.name === 'NotFoundError') return 'No microphone was found.';
      return 'Could not record audio. Check your microphone and try again.';
    }

    async function record() {
      if (!supported) return;
      const session = { chunks: [] };
      const job = audio.claim(owner, () => {
        releaseCapture(session, true);
        update('idle', 'Recording canceled.');
      });
      capture = session;
      session.fail = error => {
        if (!job.finish()) return;
        releaseCapture(session, true);
        update('idle', recordError(error));
      };
      update('requesting', 'Waiting for microphone permission…');
      try {
        const stream = await devices.getUserMedia({ audio: true });
        if (!job.isCurrent()) {
          releaseStream(stream);
          return;
        }
        session.stream = stream;
        const recorder = new environment.MediaRecorder(stream);
        session.recorder = recorder;
        recorder.ondataavailable = ({ data }) => {
          if (job.isCurrent() && data.size) session.chunks.push(data);
        };
        recorder.onstop = () => {
          if (!job.finish()) return;
          const chunks = session.chunks;
          const blob = new environment.Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' });
          releaseCapture(session, false);
          if (blob.size) clip = blob;
          update('idle', blob.size ? 'Recording ready. Tap Playback to hear it.' : 'No audio was captured. Try recording again.');
        };
        recorder.onerror = event => session.fail(event.error);
        recorder.start();
        update('recording', 'Recording… Tap Stop when finished.');
      } catch (error) {
        session.fail(error);
      }
    }

    function stopRecording() {
      if (!capture?.recorder) {
        audio.stop(owner);
        return;
      }
      const { recorder, fail } = capture;
      update('saving', 'Preparing your recording…');
      // The final dataavailable event precedes stop. Release the stream when it arrives.
      try { recorder.stop(); } catch (error) { fail(error); }
    }

    function playback() {
      if (!clip) return;
      let url;
      let player;
      const cleanup = () => {
        if (player) {
          player.onended = player.onerror = null;
          player.pause();
          player.removeAttribute('src');
          player.load();
        }
        if (url) environment.URL.revokeObjectURL(url);
      };
      const job = audio.claim(owner, () => {
        cleanup();
        update('idle', 'Playback stopped.');
      });
      const complete = message => {
        if (!job.finish()) return;
        cleanup();
        update('idle', message);
      };
      const failed = () => complete('Could not play the recording. Try Playback again.');
      try {
        url = environment.URL.createObjectURL(clip);
        player = new environment.Audio(url);
        player.onended = () => complete('Playback finished.');
        player.onerror = failed;
        update('playback', 'Playing your recording…');
        player.play().catch(failed);
      } catch {
        failed();
      }
    }

    return {
      supported, record, stopRecording, playback,
      hasClip: () => !!clip,
      clear() {
        audio.stop(owner);
        clip = null;
        update('idle', '');
      },
    };
  }

  if (typeof module === 'object' && module.exports) module.exports = createPracticeRecording;
  else window.createPracticeRecording = createPracticeRecording;
})();

(() => {
  'use strict';

  const audio = window.notebookSpeech;
  const list = document.querySelector('#list');
  const paragraphs = document.querySelectorAll('#nap-text .nap-paragraph, .reading-text .nap-paragraph');
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', { granularity: 'sentence' })
    : null;

  function splitSentences(text) {
    if (segmenter) return Array.from(segmenter.segment(text), part => part.segment.trim()).filter(Boolean);
    const sentences = [];
    let start = 0;
    for (const boundary of text.matchAll(/[.!?]+[”’"')\]]*(?=\s|$)/g)) {
      const end = boundary.index + boundary[0].length;
      const sentence = text.slice(start, end).trim();
      if (/\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|e\.g|i\.e|[A-Z])\.$/.test(sentence) && end < text.length) continue;
      if (sentence) sentences.push(sentence);
      start = end;
    }
    if (text.slice(start).trim()) sentences.push(text.slice(start).trim());
    return sentences;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(text, action) {
    const control = element('button', '', text);
    control.type = 'button';
    control.addEventListener('click', () => {
      if (control.getAttribute('aria-disabled') !== 'true') action(control);
    });
    return control;
  }

  function picker(label, options = []) {
    const wrap = element('label', 'practice-picker', label);
    const select = element('select');
    select.setAttribute('aria-label', label);
    wrap.append(select);
    for (const [value, name] of options) select.add(new Option(name, value));
    return { wrap, select };
  }

  const panel = element('div', 'practice-panel');
  panel.id = 'sentence-practice';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Sentence practice');
  const sentencePicker = picker('Sentence');
  const quote = element('p', 'practice-quote');
  quote.lang = 'en';
  const settings = element('div', 'practice-settings');
  const accent = picker('Voice', [['en-US', 'American · US'], ['en-GB', 'British · UK']]);
  const rate = picker('Speed', [['0.75', '0.75×'], ['1', '1.0×'], ['1.25', '1.25×']]);
  settings.append(accent.wrap, rate.wrap);
  const actions = element('div', 'practice-actions');
  const status = element('p', 'practice-status');
  status.setAttribute('role', 'status');
  const availability = element('p', 'practice-availability');
  const media = window.createPracticeRecording(window, audio, panel, render);

  let active;
  let phase = 'idle';
  let listened = false;
  function speaking() {
    listened = true;
    audio.play(panel, active.sentences[sentencePicker.select.selectedIndex], {
      onState: (state, message) => render(state === 'playing' ? 'speaking' : 'idle', message),
    });
  }

  const listen = button('Listen', speaking);
  const repeat = button('Repeat', speaking);
  const record = button('Record', media.record);
  const stop = button('Stop', () => {
    if (phase === 'recording') media.stopRecording();
    else audio.stop(panel);
  });
  const playback = button('Playback', media.playback);
  listen.setAttribute('aria-label', 'Listen to the sentence');
  repeat.setAttribute('aria-label', 'Repeat the sentence');
  record.setAttribute('aria-label', 'Record your voice');
  stop.setAttribute('aria-label', 'Stop audio or recording');
  playback.setAttribute('aria-label', 'Playback your recording');
  actions.append(listen, repeat, record, stop, playback);
  panel.append(sentencePicker.wrap, quote, actions, settings, status, availability);

  function render(next, message) {
    phase = next;
    const recording = phase === 'requesting' || phase === 'recording' || phase === 'saving';
    const enabled = [
      [listen, audio.supported && !recording],
      [repeat, audio.supported && listened && !recording],
      [record, media.supported && !recording],
      [stop, phase !== 'idle' && phase !== 'saving'],
      [playback, media.hasClip() && !recording],
    ];
    for (const [control, allow] of enabled) control.setAttribute('aria-disabled', String(!allow));
    status.textContent = message;
  }

  function chooseSentence() {
    listened = false;
    media.clear();
    quote.textContent = active.sentences[sentencePicker.select.selectedIndex];
  }

  sentencePicker.select.addEventListener('change', chooseSentence);
  accent.select.addEventListener('change', () => audio.setAccent(accent.select.value));
  rate.select.addEventListener('change', () => audio.setRate(Number(rate.select.value)));
  document.addEventListener('notebook:accent-change', () => { accent.select.value = audio.getAccent(); });

  function close() {
    if (!active) return;
    active.trigger.setAttribute('aria-expanded', 'false');
    active.trigger.removeAttribute('aria-controls');
    media.clear();
    panel.remove();
    active = undefined;
  }

  function toggle(trigger, sentences, fromReader) {
    const wasOpen = active?.trigger === trigger;
    close();
    if (wasOpen) return;
    audio.stop();
    active = { trigger, sentences };
    sentencePicker.select.replaceChildren(...sentences.map((_, index) => new Option(String(index + 1), String(index))));
    sentencePicker.select.selectedIndex = 0;
    sentencePicker.wrap.hidden = sentences.length < 2;
    quote.hidden = !fromReader && sentences.length === 1;
    accent.select.value = audio.getAccent();
    rate.select.value = String(audio.getRate());
    settings.hidden = !audio.supported;
    availability.textContent = [
      audio.supported ? '' : 'Read aloud is unavailable in this browser.',
      media.supported ? '' : 'Recording is unavailable. Use a supported browser over HTTPS or localhost.',
    ].filter(Boolean).join(' ');
    availability.hidden = !availability.textContent;
    chooseSentence();
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', panel.id);
    trigger.after(panel);
  }

  function addTrigger(source, sentences, fromReader = false) {
    if (!sentences.length) return;
    const trigger = button(fromReader ? 'Practice sentences' : 'Listen & practice', control => {
      toggle(control, sentences, fromReader);
    });
    trigger.className = 'practice-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    source.after(trigger);
  }

  const prepared = new WeakSet();
  function prepareExamples(section) {
    if (prepared.has(section)) return;
    prepared.add(section);
    for (const example of section.querySelectorAll('.table-en, .example > .en')) {
      const translation = example.nextElementSibling;
      const anchor = translation?.classList.contains('zh') ? translation : example;
      addTrigger(anchor, splitSentences(example.textContent.trim()));
    }
  }

  list?.querySelectorAll(':scope > details[open]').forEach(prepareExamples);
  document.addEventListener('toggle', ({ target }) => {
    if (!target.matches('#list > details')) return;
    if (target.open) prepareExamples(target);
    else if (active && target.contains(active.trigger)) close();
  }, true);

  // Capture only the original English paragraph before the dictionary wraps words.
  for (const paragraph of paragraphs) {
    const english = paragraph.textContent.replace(/^\[[A-Z]\]\s*/, '').trim();
    addTrigger(paragraph, splitSentences(english), true);
  }

  document.addEventListener('notebook:search-open', () => audio.stop());
  document.addEventListener('notebook:navigate', () => {
    audio.stop();
    close();
  });
  window.addEventListener('hashchange', close);
  window.addEventListener('pagehide', close);
})();

(() => {
 'use strict';
 const $=s=>document.querySelector(s),root=document.documentElement;
 const pickers=[...document.querySelectorAll('.theme-picker')];
 pickers.forEach(p=>{p.value=root.dataset.theme||'system';p.addEventListener('change',()=>{root.dataset.theme=p.value;pickers.forEach(o=>o.value=p.value);try{localStorage.setItem('vocab.theme',p.value)}catch{}})});
 const indexPage=!!$('#home'),positions=new Map();let current='home';
 const items=[...document.querySelectorAll('#list>details')],keys={home:'home',original:'original-heading',poly:'poly-heading',nap:'nap-part',phrases:'phrases-heading',all:'list'};
 function viewFor(id){if(id==='list')return'all';if(id.startsWith('phrase-')||id==='phrases-heading')return'phrases';if(id.startsWith('group-')||id==='original-heading')return'original';if(id.startsWith('sense-')||id.startsWith('poly-'))return'poly';return id==='nap-part'?'nap':'home'}
 function show(view,{restore=true,historyMode='push'}={}){
  if(!indexPage)return;
  if(view===current&&historyMode==='push'){
   if(view==='home'&&location.hash==='#library-title'){
    history.pushState({view},'','#'+keys.home);
    window.scrollTo({top:0,behavior:'instant'});
   }
   return;
  }
  document.dispatchEvent(new Event('notebook:navigate'));
  positions.set(current,scrollY);current=view;
  $('#home').hidden=view!=='home';$('#reference').hidden=!['all','original','poly','phrases'].includes(view);$('#nap-part').hidden=view!=='nap';
  items.forEach(d=>d.hidden=view==='original'?d.classList.contains('poly-entry')||d.classList.contains('phrase-entry'):view==='poly'?!d.classList.contains('poly-entry'):view==='phrases'?!d.classList.contains('phrase-entry'):false);
  $('#original-heading').hidden=['poly','phrases'].includes(view);$('#poly-heading').hidden=['original','phrases'].includes(view);$('#phrases-heading').hidden=['original','poly'].includes(view);
  $('#view-title').textContent=view==='phrases'?'Phrases':view==='poly'?'Word Meanings':view==='all'?'All vocabulary':'Word Comparisons';
  $('#count').textContent=items.filter(d=>!d.hidden).length+(view==='phrases'?(items.filter(d=>!d.hidden).length===1?' phrase':' phrases')+' · meaning, usage, and bilingual examples':view==='poly'?' words · common meanings and extended uses':' comparisons · meanings, collocations, and bilingual examples');
  document.querySelectorAll('.primary-nav [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(historyMode==='push')history.pushState({view},'','#'+keys[view]);
  if(restore)window.scrollTo({top:positions.get(view)||0,behavior:'instant'});
 }
 function reveal(id){if(!indexPage)return;show(viewFor(id),{restore:false,historyMode:'none'});const target=document.getElementById(id);if(!target)return;for(let n=target;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;if(!Object.values(keys).includes(id)){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'instant'}))}}
 // The dictionary and Spotlight use the same search index within a page.
 let indexRequest;
 function loadSearchIndex(){
  if(!indexRequest){
   indexRequest=fetch('./search-index.json').then(response=>{
    if(!response.ok)throw Error('Could not load the search index');
    return response.json();
   }).then(index=>{
    if(index.schemaVersion!==1)throw Error('Unsupported search index');
    return index;
   }).catch(error=>{indexRequest=undefined;throw error});
  }
  return indexRequest;
 }
 window.notebook={show,reveal,viewFor,loadSearchIndex};
 if(indexPage){document.addEventListener('click',ev=>{const a=ev.target.closest('[data-view]');if(!a||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;ev.preventDefault();show(a.dataset.view)});$('#expand').onclick=()=>items.filter(d=>!d.hidden).forEach(d=>d.open=true);$('#collapse').onclick=()=>items.forEach(d=>d.open=false);
 const route=event=>{
  let id;
  try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
  if(id==='main')return;
  if(id==='home'&&event?.oldURL.endsWith('#library-title')){
   show('home',{restore:false,historyMode:'none'});
   requestAnimationFrame(()=>{
    if(location.hash==='#home')window.scrollTo({top:0,behavior:'instant'});
   });
  }else if(!id||Object.values(keys).includes(id)){
   show(viewFor(id||'home'),{restore:true,historyMode:'none'});
  }else reveal(id);
 };
 // pushState navigation does not emit hashchange; native Back/Forward does.
 // One handler avoids saving the destination position twice.
 history.scrollRestoration='manual';addEventListener('hashchange',route);route();}
 document.addEventListener('toggle',ev=>{if(ev.target.matches('details.poly-entry')&&ev.target.open){for(const other of document.querySelectorAll('details.poly-entry[open]'))if(other!==ev.target)other.open=false}},true);
 document.addEventListener('toggle',ev=>{if(ev.target.tagName!=='DETAILS'||!ev.target.open||matchMedia('(prefers-reduced-motion: reduce)').matches)return;ev.target.querySelector(':scope>.body')?.animate([{opacity:.25},{opacity:1}],{duration:160,easing:'ease-out'})},true);

 // Keep destinations separate from actions, while retaining every existing route.
 document.querySelectorAll('.primary-nav a').forEach(a=>a.setAttribute('aria-label',a.textContent.trim()));
 const nav=$('.primary-nav');
 const searchAction=nav.querySelector('[data-search]');
 searchAction.classList.add('sidebar-search');
 nav.after(searchAction);
 nav.id='primary-navigation';

 const navToggle=document.createElement('button');
 navToggle.type='button';
 navToggle.className='nav-toggle';
 navToggle.setAttribute('aria-controls',nav.id);
 function setNavigationExpanded(expanded){
  root.classList.toggle('navigation-expanded',expanded);
  navToggle.setAttribute('aria-expanded',String(expanded));
  navToggle.setAttribute('aria-label',expanded?'Collapse navigation':'Expand navigation');
 }
 setNavigationExpanded(false);
 navToggle.onclick=()=>setNavigationExpanded(navToggle.getAttribute('aria-expanded')!=='true');
 nav.before(navToggle);
 // Reuse table cells verbatim. Only presentation labels and a view control are added.
 for(const scroller of document.querySelectorAll('.table-scroll')){
  const table=scroller.querySelector('table');if(!table)continue;
  const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent);
  table.setAttribute('role','table');
  table.querySelectorAll('thead,tbody').forEach(n=>n.setAttribute('role','rowgroup'));
  table.querySelectorAll('tr').forEach(n=>n.setAttribute('role','row'));
  table.querySelectorAll('thead th').forEach(n=>n.setAttribute('role','columnheader'));
  table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,i)=>{
   cell.setAttribute('role',i?'cell':'rowheader');if(i)cell.dataset.label=labels[i];
  }));
  const toggle=document.createElement('button');toggle.type='button';toggle.className='comparison-view';
  toggle.textContent=window.notebookText.comparisonFull;toggle.setAttribute('aria-pressed','false');
  toggle.onclick=()=>{
   const top=toggle.getBoundingClientRect().top;
   const full=scroller.classList.toggle('full-comparison');
   toggle.textContent=full?window.notebookText.comparisonCards:window.notebookText.comparisonFull;toggle.setAttribute('aria-pressed',String(full));
   window.scrollBy({top:toggle.getBoundingClientRect().top-top,behavior:'instant'});
  };
  scroller.classList.add('comparison-ready');
  scroller.before(toggle);
 }
 // Native details already keep their summary in place. Do not scroll or focus on toggle.
 // Measure real chrome rather than guessing Safari's changing toolbar height.
 const topbar=document.querySelector('.topbar');
 const updateInsets=()=>{
  root.style.setProperty('--topbar-height',topbar.getBoundingClientRect().height+'px');
  const vv=window.visualViewport;
  root.style.setProperty('--visual-top',(vv?.offsetTop||0)+'px');
  root.style.setProperty('--visual-height',(vv?.height||innerHeight)+'px');
 };
 new ResizeObserver(updateInsets).observe(topbar);
 window.visualViewport?.addEventListener('resize',updateInsets);
 window.visualViewport?.addEventListener('scroll',updateInsets);
 window.addEventListener('resize',updateInsets);
 updateInsets();

 const paragraphJump=$('#paragraph-jump');
 if(paragraphJump)paragraphJump.onchange=ev=>{if(ev.target.value)location.hash=ev.target.value};
})();
