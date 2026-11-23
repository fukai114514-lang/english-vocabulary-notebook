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

  // Keep one active utterance across word and sentence controls.
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
