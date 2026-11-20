const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const createPracticeRecording = require('../content/practice-recording.js');

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

function setupMedia(options = {}) {
  const { audio, window, queued } = setup({ supported: options.speechSupported });
  const updates = [];
  const tracks = [];
  const track = { stop: () => tracks.push('stop') };
  const stream = { getTracks: () => [track] };
  const requests = [];
  let recorder;
  let player;
  const urls = [];
  const environment = {
    Blob,
    navigator: { mediaDevices: { getUserMedia: constraints => {
      requests.push(constraints);
      return options.request ? options.request(stream) : Promise.resolve(stream);
    } } },
    MediaRecorder: class {
      state = 'inactive';
      mimeType = 'audio/webm';
      constructor() { recorder = this; }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; }
    },
    URL: {
      createObjectURL: blob => { urls.push(blob); return 'blob:practice'; },
      revokeObjectURL: url => urls.push(url),
    },
    Audio: class {
      constructor(url) { player = this; this.src = url; }
      play() { return options.rejectPlayback ? Promise.reject(Error('blocked')) : Promise.resolve(); }
      pause() { this.paused = true; }
      removeAttribute() { this.src = ''; }
      load() {}
    },
  };
  if (options.unavailable) delete environment.MediaRecorder;
  const control = createPracticeRecording(environment, audio, {}, (...state) => updates.push(state));
  return { control, audio, window, updates, tracks, requests, urls, queued,
    recorder: () => recorder, player: () => player };
}

test('microphone denial is explained and original sentence playback remains available', async () => {
  const h = setupMedia({ request: () => Promise.reject({ name: 'NotAllowedError' }) });
  assert.equal(h.requests.length, 0);
  await h.control.record();
  assert.deepEqual(h.requests, [{ audio: true }]);
  assert.match(h.updates.at(-1)[1], /Microphone access was denied/);
  assert.equal(h.recorder(), undefined);
  h.audio.play({}, 'Listen after denial.');
  assert.equal(h.queued[0].text, 'Listen after denial.');
});

test('recording uses the final data event and cleans tracks, handlers and playback URL', async () => {
  const h = setupMedia();
  await h.control.record();
  assert.equal(h.updates.at(-1)[0], 'recording');
  h.control.stopRecording();
  assert.equal(h.updates.at(-1)[0], 'saving');
  const recorder = h.recorder();
  recorder.ondataavailable({ data: new Blob(['last chunk'], { type: 'audio/webm' }) });
  recorder.onstop();
  assert.equal(h.control.hasClip(), true);
  assert.deepEqual(h.tracks, ['stop']);
  assert.equal(recorder.ondataavailable, null);
  assert.equal(recorder.onerror, null);

  h.control.playback();
  assert.equal(await h.urls[0].text(), 'last chunk');
  assert.equal(h.urls[0].type, 'audio/webm');
  const player = h.player();
  player.onended();
  assert.deepEqual(h.urls.slice(1), ['blob:practice']);
  assert.equal(player.src, '');
  assert.equal(player.paused, true);
  assert.equal(player.onended, null);
  h.control.clear();
  assert.equal(h.control.hasClip(), false);
});

test('a late permission grant after closing practice only releases the new stream', async () => {
  let grant;
  const h = setupMedia({ request: stream => new Promise(resolve => { grant = () => resolve(stream); }) });
  const pending = h.control.record();
  h.control.clear();
  grant();
  await pending;
  assert.equal(h.recorder(), undefined);
  assert.deepEqual(h.tracks, ['stop']);
  assert.deepEqual(h.updates.at(-1), ['idle', '']);
});

test('starting speech or leaving the page releases an in-progress capture', async () => {
  const h = setupMedia();
  await h.control.record();
  const ended = h.recorder().onstop;
  h.audio.play({}, 'Interrupt an active recording.');
  assert.equal(h.recorder().state, 'inactive');
  ended();
  assert.equal(h.control.hasClip(), false);
  assert.deepEqual(h.tracks, ['stop']);
  await h.control.record();
  h.window.dispatchEvent(new Event('pagehide'));
  assert.equal(h.recorder().state, 'inactive');
  assert.deepEqual(h.tracks, ['stop', 'stop']);
});

test('recorder errors release the microphone and playback rejection releases the object URL', async () => {
  const h = setupMedia({ rejectPlayback: true });
  await h.control.record();
  h.recorder().onerror({ error: { name: 'UnknownError' } });
  assert.match(h.updates.at(-1)[1], /Could not record audio/);
  assert.deepEqual(h.tracks, ['stop']);
  await h.control.record();
  h.control.stopRecording();
  h.recorder().ondataavailable({ data: new Blob(['audio']) });
  h.recorder().onstop();
  h.control.playback();
  await Promise.resolve();
  assert.match(h.updates.at(-1)[1], /Could not play the recording/);
  assert.equal(h.urls.at(-1), 'blob:practice');
  assert.equal(h.player().src, '');
});

test('missing recording APIs do not disable speech synthesis', async () => {
  const h = setupMedia({ unavailable: true });
  assert.equal(h.control.supported, false);
  await h.control.record();
  assert.equal(h.requests.length, 0);
  h.audio.play({}, 'Recording is optional.');
  assert.equal(h.queued[0].text, 'Recording is optional.');
});
