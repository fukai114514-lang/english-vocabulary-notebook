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
