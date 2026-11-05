(() => {
 const accent=document.querySelector('#accent'), status=document.querySelector('#speech-status');
 const supported='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
 let active=null, serial=0;
 try {accent.value=localStorage.getItem('vocab-accent')==='en-GB'?'en-GB':'en-US';} catch {}
 function reset(){if(active){active.classList.remove('speaking');active.setAttribute('aria-pressed','false');active=null;}}
 function stop(){serial++;if(supported)window.speechSynthesis.cancel();reset();}
 accent.addEventListener('change',()=>{stop();try{localStorage.setItem('vocab-accent',accent.value);}catch{}status.textContent='已切换，点击单词旁的按钮试听。';});
 if(!supported){status.textContent='当前浏览器不支持朗读，请尝试 Safari、Chrome 或 Edge。';document.querySelectorAll('.speak').forEach(b=>b.disabled=true);return;}
 document.querySelector('#list').addEventListener('click',e=>{
  const button=e.target.closest('.speak');if(!button)return;
  if(active===button){stop();status.textContent='已停止朗读。';return;}
  stop();const current=serial;active=button;
  const word=button.dataset.word, utterance=new SpeechSynthesisUtterance(word==='vice'?'vice':word);
  utterance.lang=accent.value;utterance.rate=0.85;
  const voices=window.speechSynthesis.getVoices();
  const exact=voices.find(v=>v.lang.replace('_','-').toLowerCase()===accent.value.toLowerCase());
  const english=voices.find(v=>/^en[-_]/i.test(v.lang));
  if(exact||english)utterance.voice=exact||english;
  button.classList.add('speaking');button.setAttribute('aria-pressed','true');
  const hint=exact?'':(english?'（设备未提供所选口音，使用可用英语语音）':'（使用系统语音，口音取决于设备）');
  status.textContent='正在朗读 '+word+hint;
  utterance.onend=()=>{if(current!==serial)return;reset();status.textContent='已朗读 '+word+hint;};
  utterance.onerror=e=>{if(current!==serial)return;reset();status.textContent=e.error==='not-allowed'?'朗读未获允许，请再次点击按钮。':'朗读未成功，请检查设备英语语音设置后重试。';};
  window.speechSynthesis.speak(utterance);
 });
 window.addEventListener('pagehide',stop);
})();
