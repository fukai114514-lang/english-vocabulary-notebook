(() => {
 const accent=document.querySelector('#accent'), status=document.querySelector('#speech-status');
 const supported='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
 let active=null, serial=0;
 try {accent.value=localStorage.getItem('vocab-accent')==='en-GB'?'en-GB':'en-US';} catch {}
 function reset(){if(active){active.classList.remove('speaking');active.setAttribute('aria-pressed','false');active=null;}}
 function stop(){serial++;if(supported)window.speechSynthesis.cancel();reset();}
 accent.addEventListener('change',()=>{stop();try{localStorage.setItem('vocab-accent',accent.value);}catch{}status.textContent='Voice changed. Tap Listen next to a word to try it.';});
 if(!supported){status.textContent='Read aloud is unavailable in this browser. Try Safari, Chrome, or Edge.';document.querySelectorAll('.speak').forEach(b=>b.disabled=true);return;}
 document.querySelector('#list').addEventListener('click',e=>{
  const button=e.target.closest('.speak');if(!button)return;
  if(active===button){stop();status.textContent='Reading stopped.';return;}
  stop();const current=serial;active=button;
  const word=button.dataset.word, utterance=new SpeechSynthesisUtterance(word==='vice'?'vice':word);
  utterance.lang=accent.value;utterance.rate=0.85;
  const voices=window.speechSynthesis.getVoices();
  const exact=voices.find(v=>v.lang.replace('_','-').toLowerCase()===accent.value.toLowerCase());
  const english=voices.find(v=>/^en[-_]/i.test(v.lang));
  if(exact||english)utterance.voice=exact||english;
  button.classList.add('speaking');button.setAttribute('aria-pressed','true');
  const hint=exact?'':(english?' (Selected accent unavailable; using an available English voice.)':' (Using the system voice; accent depends on your device.)');
  status.textContent='Reading aloud: '+word+hint;
  utterance.onend=()=>{if(current!==serial)return;reset();status.textContent='Finished: '+word+hint;};
  utterance.onerror=e=>{if(current!==serial)return;reset();status.textContent=e.error==='not-allowed'?'Read aloud was blocked. Tap Listen again.':'Could not read aloud. Check your device’s English voice settings and try again.';};
  window.speechSynthesis.speak(utterance);
 });
 window.addEventListener('pagehide',stop);
})();
