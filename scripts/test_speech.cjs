const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const source = readFileSync(require.resolve('../content/speech.js'), 'utf8');

function setup({ voices = [], values = new Map(), supported = true } = {}) {
  const window = new EventTarget();
  const document = new EventTarget();
  const queued = [];
  let cancels = 0;
  if (supported) {
    window.speechSynthesis = {
      getVoices: () => voices,
      speak: utterance => { queued.push(utterance); },
      cancel: () => { cancels++; queued.length = 0; },
    };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  }
  window.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  runInNewContext(source, { window, document, Event });
  return { audio: window.notebookSpeech, window, values, queued, cancels: () => cancels };
}

test('one utterance, latest owner wins, and stale completion cannot stop it', () => {
  const { audio, queued, cancels } = setup();
  const states = [];
  const play = text => audio.play({}, text, { onState: state => states.push([text, state]) });
  play('First sentence.');
  const lateEnd = queued[0].onend;
  const lateError = queued[0].onerror;
  play('Second sentence.');
  play('Third sentence.');
  lateEnd();
  lateError({ error: 'interrupted' });
  assert.deepEqual(queued.map(item => item.text), ['Third sentence.']);
  assert.equal(cancels(), 2);
  assert.deepEqual(states, [
    ['First sentence.', 'playing'], ['First sentence.', 'stopped'],
    ['Second sentence.', 'playing'], ['Second sentence.', 'stopped'],
    ['Third sentence.', 'playing'],
  ]);
});

test('explicit stop, natural completion and browser errors each emit one terminal state', () => {
  const { audio, queued, cancels } = setup();
  const owner = {};
  const states = [];
  const play = () => audio.play(owner, 'Hello.', { onState: state => states.push(state) });
  play();
  const lateError = queued[0].onerror;
  audio.stop({});
  assert.equal(cancels(), 0);
  audio.stop(owner);
  lateError({ error: 'canceled' });
  audio.stop(owner);
  assert.equal(cancels(), 1);

  play();
  queued.shift().onend();
  play();
  queued.shift().onerror({ error: 'not-allowed' });
  play();
  queued.shift().onerror({ error: 'interrupted' });
  assert.deepEqual(states, ['playing', 'stopped', 'playing', 'finished', 'playing', 'error', 'playing', 'stopped']);
});

test('exact locale, English fallback and system fallback use supported voice preferences', () => {
  const american = { lang: 'en-US' };
  const british = { lang: 'en_GB' };
  const french = { lang: 'fr-FR' };
  const voices = [french, american, british];
  const { audio, queued } = setup({ voices });
  audio.setAccent('en-GB');
  let message;
  const play = () => audio.play({}, 'An example.', { onState: (_, text) => { message = text; } });
  play();
  assert.equal(queued[0].voice, british);
  assert.equal(queued[0].lang, 'en-GB');
  voices.pop();
  play();
  assert.equal(queued[0].voice, american);
  assert.match(message, /Selected accent unavailable/);
  voices.pop();
  play();
  assert.equal(queued[0].voice, undefined);
  assert.equal(queued[0].lang, 'en-GB');
  assert.match(message, /system voice/);
});

test('rate and accent persist, invalid preferences are ignored, and words retain their own rate', () => {
  const { audio, values, queued } = setup();
  assert.equal(audio.getRate(), 1);
  for (const rate of [0.75, 1, 1.25]) {
    audio.setRate(rate);
    audio.play({}, 'An example.');
    assert.equal(queued[0].rate, rate);
  }
  audio.setAccent('en-GB');
  audio.setAccent('fr-FR');
  audio.setRate(2);
  const reloaded = setup({ values });
  assert.equal(reloaded.audio.getRate(), 1.25);
  assert.equal(reloaded.audio.getAccent(), 'en-GB');
  const pressed = [];
  const button = { classList: { toggle() {} }, setAttribute: (_, value) => pressed.push(value) };
  const status = {};
  audio.toggleWord(button, status, 'word');
  assert.equal(queued[0].rate, 0.85);
  audio.toggleWord(button, status, 'word');
  assert.deepEqual(pressed, ['true', 'false']);
});

test('scope cleanup preserves outside audio and pagehide/hash navigation cancel active audio', () => {
  const { audio, window } = setup();
  let released = 0;
  const owner = {};
  const claim = () => audio.claim(owner, () => { released++; });
  const first = claim();
  audio.stopWithin({ contains: () => false });
  assert.equal(first.isCurrent(), true);
  audio.stopWithin({ contains: target => target === owner });
  assert.equal(released, 1);
  assert.equal(first.finish(), false);
  claim();
  window.dispatchEvent(new Event('hashchange'));
  claim();
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(released, 3);
});
