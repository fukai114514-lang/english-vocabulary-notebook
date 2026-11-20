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
