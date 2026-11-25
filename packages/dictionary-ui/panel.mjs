// Shared presentation. Host adapters own the dictionary, storage, location and permissions.
export const speeds = [0.75, 1, 1.25];

export function geometry(anchor, viewport, { expanded = false, gutter = 0, safe = {} } = {}) {
  const left = (viewport.left ?? 0) + (safe.left ?? 0);
  const top = (viewport.top ?? 0) + (safe.top ?? 0);
  const width = viewport.width - (safe.left ?? 0) - (safe.right ?? 0);
  const height = viewport.height - (safe.top ?? 0) - (safe.bottom ?? 0);
  const margin = 10;
  const sheet = viewport.width <= 740 || (width <= 1000 && height <= 500);
  if (sheet) {
    const h = Math.min(height - 2 * margin, Math.round(height * (expanded ? 0.79 : 0.40)));
    return { layout: 'sheet', left: left + Math.max(0, gutter - (safe.left ?? 0)) + margin, top: top + height - h - margin,
      width: width - Math.max(0, gutter - (safe.left ?? 0)) - margin * 2, height: h };
  }
  const w = Math.min(468, width - margin * 2);
  const below = height + top - anchor.bottom - margin - 10;
  const above = anchor.top - top - margin - 10;
  const ideal = Math.min(535, height * .65);
  const down = below >= ideal || below >= above;
  const room = down ? below : above;
  const h = Math.min(ideal, Math.max(236, room), height - 2 * margin);
  return { layout: 'anchored', width: w, height: h,
    left: Math.max(left + margin, Math.min(anchor.left, left + width - margin - w)),
    top: Math.max(top + margin, Math.min(down ? anchor.bottom + 10 : anchor.top - h - 10, top + height - h - margin)) };
}

export function sourceGroups(entry, sense) {
  return {
    collocations: sense?.collocations ?? [],
    family: entry?.family ?? [],
    related: [...new Set([...(entry?.relatedWords ?? []), ...(sense?.relatedWords ?? [])])],
  };
}

export function canMark(candidate) {
  return candidate?.confidence === 'supported' && candidate.components?.length > 1;
}

export function createDictionaryPanel(doc, actions) {
  function make(tag, className, value) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (value) el.textContent = value;
    return el;
  }
  function button(label, name, callback, cls) {
    const el = make('button', cls, label);
    el.type = 'button';
    if (name) el.setAttribute('aria-label', name);
    el.onclick = callback;
    return el;
  }
  const panel = make('section', 'lex-panel');
  panel.setAttribute('aria-label', 'TAsLEXICON dictionary');
  const toolbar = make('header', 'lex-toolbar');
  const brand = make('span', 'lex-brand', 'TAsLEXICON');
  const controls = make('div', 'lex-toolbar-actions');
  const back = button('← Back', 'Back to previous lookup', () => actions.back());
  const close = button('Close', 'Close dictionary', () => actions.close());
  let expanded = false;
  const expand = button('Expand', 'Expand dictionary sheet', () => {
    expanded = !expanded;
    configureExpansion();
    actions.resize();
  });
  const key = make('span', 'lex-accessible');
  key.setAttribute('role', 'status');
  controls.append(back, expand, close);
  toolbar.append(brand, controls);
  const scroll = make('div', 'lex-scroll lookup-body');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Dictionary entry');
  const hero = make('header', 'lex-hero lookup-heading');
  const type = make('p', 'lex-label lex-type');
  const title = make('h2', 'lex-title word');
  title.id = 'lookup-title';
  const ipa = make('p', 'lex-ipa');
  hero.append(type, title, ipa);
  const main = make('div', 'lex-entry');
  const speech = make('div', 'lex-speech');
  const speechStatus = make('p', 'lex-metadata');
  speechStatus.setAttribute('role', 'status');
  const extras = make('div', 'lex-extras');
  const rate = make('select');
  rate.setAttribute('aria-label', 'Playback speed');
  for (const value of actions.rates ?? speeds) {
    const opt = make('option', '', value + '×');
    opt.value = String(value);
    rate.append(opt);
  }
  rate.value = '1';
  rate.onchange = () => actions.rate(Number(rate.value));
  const pronounce = accent => event => actions.speak(speechText, accent, event.currentTarget);
  speech.append(button('UK', 'Pronounce in British English', pronounce('GB'), 'lookup-speech'),
    button('US', 'Pronounce in American English', pronounce('US')),
    button('Stop', 'Stop speaking', () => actions.stop()), rate);
  const nested = make('details', 'lex-section lex-disclosure lex-lookup');
  nested.append(make('summary', 'lex-label', 'Look up another term'));
  const form = make('form', 'lex-terms');
  const input = make('input');
  input.type = 'search';
  input.required = true;
  input.maxLength = 160;
  input.setAttribute('aria-label', 'Word or expression');
  const submit = make('button', '', 'Look up');
  submit.type = 'submit';
  form.append(input, submit);
  form.onsubmit = event => { event.preventDefault(); if (input.value.trim()) actions.lookup(input.value.trim()); };
  nested.append(form);
  scroll.append(hero, main, speech, speechStatus, nested, extras);
  const safeArea = make('span', 'lex-insets');
  safeArea.setAttribute('aria-hidden', 'true');
  panel.append(toolbar, scroll, key, safeArea);
  let speechText = '';
  let model;
  let focusWord;

  function configureExpansion() {
    panel.dataset.expanded = String(expanded);
    expand.textContent = expanded ? 'Compact' : 'Expand';
    expand.setAttribute('aria-label', expanded ? 'Use compact dictionary sheet' : 'Expand dictionary sheet');
    expand.setAttribute('aria-expanded', String(expanded));
  }
  configureExpansion();

  function labelled(parent, label, value, className, lang) {
    if (!value) return;
    const group = make('section', 'lex-section ' + (className ?? ''));
    group.append(make('h3', 'lex-label', label));
    const text = make('p', '', value);
    if (lang) text.lang = lang;
    group.append(text);
    parent.append(group);
  }
  function details(label) {
    const el = make('details', 'lex-section lex-disclosure');
    el.append(make('summary', 'lex-label', label));
    return el;
  }
  function terms(label, list) {
    if (!list?.length) return;
    const group = details(label);
    const row = make('div', 'lex-terms');
    for (const value of [...new Set(list)].slice(0, 16)) {
      row.append(button(value, 'Look up ' + value, () => actions.lookup(value)));
    }
    group.append(row);
    main.append(group);
  }
  function render(next, { reset = false, mode } = {}) {
    if (reset) {
      scroll.scrollTop = 0;
      speechStatus.textContent = '';
      focusWord = undefined;
      nested.open = false;
      input.value = '';
    }
    const workingFocus = doc.activeElement === panel ? null : panel.getRootNode().activeElement;
    const restoreSwitch = workingFocus?.classList?.contains('lex-switch');
    const scrollY = scroll.scrollTop;
    model = next;
    const expression = model.expression;
    const showExpression = expression && mode !== 'word' && (expression.confidence === 'supported' || mode === 'expression');
    const item = showExpression ? expression : model.word;
    title.textContent = item?.title || model.selected;
    type.textContent = showExpression ? (expression.confidence === 'supported' ? 'Detected expression' : 'Possible expression') : 'Selected word';
    ipa.textContent = item?.ipa || '';
    ipa.hidden = !ipa.textContent;
    speechText = item?.speak || title.textContent;
    back.hidden = !model.canBack;
    speech.hidden = !actions.speak || !speechText;
    main.replaceChildren();
    if (model.pending) {
      main.append(make('p', 'lex-status', 'Looking up…'));
    } else {
      const sense = item?.primary;
      const contextual = showExpression || item?.contextual;
      labelled(main, contextual ? 'In this context' : 'Chinese meaning', sense?.zh, 'lex-primary', 'zh-Hans');
      labelled(main, 'English definition', sense?.en, 'lex-definition', 'en');
      if (!sense?.zh && !sense?.en) main.append(make('p', 'lex-status', model.status || 'No local definition is available.'));
      if (model.sentence) {
        const quote = details('Original sentence');
        quote.open = true;
        const text = make('blockquote', 'lex-sentence');
        const span = model.sentenceSpan;
        if (span && span.start >= 0 && span.end <= model.sentence.length) {
          text.append(model.sentence.slice(0, span.start), make('mark', '', model.sentence.slice(span.start, span.end)), model.sentence.slice(span.end));
        } else text.textContent = model.sentence;
        quote.append(text);
        main.append(quote);
      }
      if (expression) {
        const row = make('section', 'lex-section lex-switch-row');
        row.append(make('h3', 'lex-label', showExpression ? 'Selected word' : expression.confidence === 'supported' ? 'Detected expression' : 'Possible expression'));
        focusWord = button(showExpression ? model.selected : expression.title, showExpression ? 'Show selected word' : 'Show expression',
          () => actions.mode(showExpression ? 'word' : 'expression'), 'lex-switch');
        row.append(focusWord);
        main.append(row);
      }
      if (item?.others?.length || sense?.examples?.length) {
        const other = details('Other meanings');
        for (const meaning of [...(sense?.examples?.length ? [{ examples: sense.examples }] : []), ...(item.others ?? [])]) {
          const row = make('div', 'lex-sense');
          if (meaning.part) row.append(make('p', 'lex-metadata', meaning.part));
          if (meaning.zh) row.append(make('p', 'lex-gloss', meaning.zh));
          if (meaning.en) row.append(make('p', '', meaning.en));
          for (const example of (meaning.examples ?? []).slice(0, 2)) {
            row.append(make('p', 'lex-example', example));
            if (actions.speak) row.append(button('Play example', 'Pronounce example', event => actions.speak(example, undefined, event.currentTarget)));
          }
          other.append(row);
        }
        main.append(other);
      }
      terms('Collocations', item?.collocations);
      terms('Word families', item?.family);
      terms('Related words', item?.related);
      if (model.alternatives?.length) {
        const alt = details('Other possible expressions');
        for (const value of model.alternatives) alt.append(button(value, 'Look up ' + value, () => actions.lookup(value)));
        main.append(alt);
      }
      if (item?.href) {
        const link = make('a', 'lex-full', 'View full entry ↗');
        link.href = item.href;
        if (item.external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
        if (actions.follow) link.onclick = actions.follow;
        main.append(link);
      }
      if (item?.evidence?.length) {
        const why = details('Match evidence');
        why.append(make('p', 'lex-metadata', item.evidence.join(' · ')));
        main.append(why);
      }
    }
    if (reset) scroll.scrollTop = 0;
    else scroll.scrollTop = scrollY;
    if (restoreSwitch) focusWord?.focus({ preventScroll: true });
    key.textContent = model.pending ? '' : 'Dictionary entry for ' + title.textContent;
  }

  return { panel, toolbar, scroll, extras, close, render, rate, speechStatus,
    insets() {
      const style = doc.defaultView.getComputedStyle(safeArea);
      return Object.fromEntries(['top', 'right', 'bottom', 'left'].map(edge => [edge, parseFloat(style.getPropertyValue('padding-' + edge)) || 0]));
    },
    get expanded() { return expanded; },
    resetSheet() { expanded = false; configureExpansion(); },
    setLayout(value) { panel.dataset.layout = value; expand.hidden = value !== 'sheet'; },
  };
}

export function fromSense(sense) {
  if (!sense) return undefined;
  return { zh: sense.meaningZh, en: sense.definitionEn, part: sense.partOfSpeech,
    examples: (sense.examples ?? []).map(item => item.en) };
}

export function fromEntry(entry, primary = entry?.senses[0]) {
  if (!entry) return undefined;
  return { title: entry.lemma, primary: fromSense(primary), others: entry.senses.filter(s => s.id !== primary?.id).map(fromSense),
    ipa: (entry.ipa ?? []).map(({ value }) => value).join(' · '), href: entry.provenance.href,
    ...sourceGroups(entry, primary) };
}

export function fromContext(result) {
  const preferred = result?.candidates[0];
  const ranked = result?.senses[0];
  const wordEntry = result?.wordFallback?.matches[0]?.entry ?? result?.word?.matches[0]?.entry;
  const entry = ranked && (result?.wordFallback ?? result?.word)?.matches.find(m => m.entry.id === ranked.entryId)?.entry;
  const supported = ranked?.confidence === 'supported';
  return {
    word: fromEntry(supported ? entry ?? wordEntry : wordEntry, supported ? ranked.sense : undefined),
    expression: preferred && { ...fromEntry(preferred.entry), title: preferred.surface, speak: preferred.surface,
      confidence: preferred.confidence, evidence: preferred.evidence },
    alternatives: result?.candidates.slice(1).map(c => c.entry.lemma).filter(term => term !== preferred.entry.lemma) ?? [],
    contextualWord: supported,
    sentence: result?.sentence?.text,
    sentenceSpan: preferred && result?.sentence && {
      start: preferred.span.start - result.sentence.start, end: preferred.span.end - result.sentence.start,
    },
  };
}
