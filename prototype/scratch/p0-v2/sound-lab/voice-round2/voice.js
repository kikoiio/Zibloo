const $=selector=>document.querySelector(selector);
const audio=$('#audio');
const key='zibloo-name-voice-round2';
let manifest,queue=[],generation=0,current=null;
let chosen={voices:[],textures:[]};
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.voices)&&Array.isArray(saved.textures))chosen=saved;}catch{/* Optional browser storage. */}
audio.volume=.65;
const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function announce(text){$('#player-status').textContent=text;}
function selection(){
  const voices=manifest.voices.filter(v=>chosen.voices.includes(v.id));
  const textures=manifest.textures.filter(t=>chosen.textures.includes(t.id));
  const descriptions=[];
  if(voices.length)descriptions.push('叫法：'+voices.map(v=>`${v.letter} ${v.name}`).join('、'));
  if(textures.length)descriptions.push('质感：'+textures.map(t=>`${t.number} ${t.name}`).join('、'));
  return descriptions;
}
function refreshSelection(){
  const descriptions=selection();
  $('#shortlist-text').textContent=descriptions.length?descriptions.join(' ／ '):'给喜欢的叫法加入候选，或再选一个声音质感。';
  document.querySelectorAll('[data-favorite]').forEach(button=>{
    const selected=chosen.voices.includes(button.dataset.favorite);
    button.setAttribute('aria-pressed',String(selected));button.textContent=selected?'✓ 已加入':'加入候选';
  });
  document.querySelectorAll('[data-texture-choice]').forEach(input=>{input.checked=chosen.textures.includes(input.dataset.textureChoice);});
}
function save(){try{localStorage.setItem(key,JSON.stringify(chosen));}catch{/* Optional persistence. */}refreshSelection();$('#copy-choice').textContent='复制我的选择';}
function stop(){
  generation++;queue=[];current=null;audio.pause();if(audio.src)audio.currentTime=0;
  document.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing'));
  $('.player').classList.remove('playing');$('.portrait').classList.remove('speaking');
}
async function play(item,token){
  if(token!==generation)return;
  current=item;
  document.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing'));
  let file,title,detail;
  if(item.type==='comparison'){
    file=manifest.comparison;title='A → B → C · 招牌叫声';detail='清楚叫名字 → 隐约像名字 → 只保留韵律';
    $('#character-call').textContent='Zi—bloo';
  }else if(item.type==='texture'){
    const texture=manifest.textures.find(t=>t.id===item.id);
    file=texture.file;title=`B + ${texture.number} ${texture.name}`;detail='同一句 zi～bluu · 比较声音质感';
    $(`#texture-${texture.id}`).classList.add('is-playing');$('#character-call').textContent='zi～bluu';
  }else{
    const voice=manifest.voices.find(v=>v.id===item.id);
    file=item.event==='sequence'?voice.sequence:voice.clips[item.event];
    title=`${voice.letter} ${voice.name}`;
    detail=item.event==='sequence'?'工作 → 休息 → 完成 → 日常提醒':manifest.events.find(e=>e.id===item.event).name;
    $(`#voice-${voice.id}`).classList.add('is-playing');
    $(`[data-voice="${voice.id}"][data-event="${item.event}"]`)?.classList.add('is-playing');
    $('#character-call').textContent=voice.spelling;
  }
  $('#now-title').textContent=title;$('#now-detail').textContent=detail+(queue.length?` · 后面还有 ${queue.length} 段`:'');
  audio.src=file;
  try{
    await audio.play();if(token!==generation)return;
    announce('正在试听 '+title+'，'+detail);
  }catch(error){
    if(token!==generation||error.name==='AbortError')return;
    queue=[];$('#now-detail').textContent='未能播放，请点击播放器重试。';announce('声音未能播放，请重试。');
  }
}
function start(items){if(!items.length)return;stop();queue=items.slice(1);void play(items[0],generation);}
audio.addEventListener('play',()=>{$('.player').classList.add('playing');$('.portrait').classList.add('speaking');});
audio.addEventListener('pause',()=>{$('.player').classList.remove('playing');$('.portrait').classList.remove('speaking');});
audio.addEventListener('ended',()=>{
  $('.player').classList.remove('playing');$('.portrait').classList.remove('speaking');
  if(queue.length)void play(queue.shift(),generation);
  else{document.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing'));announce('试听完成');}
});
audio.addEventListener('error',()=>{if(!current)return;queue=[];$('#now-detail').textContent='音频加载失败，请重新选择。';announce('音频加载失败');});
$('#stop').addEventListener('click',()=>{stop();$('#now-detail').textContent='已停止，可以继续选择';announce('已停止');});
$('#compare-names').addEventListener('click',()=>start([{type:'comparison'}]));
$('#compare-all').addEventListener('click',()=>start(manifest.voices.map(v=>({type:'voice',id:v.id,event:$('#event-select').value}))));
$('#copy-choice').addEventListener('click',async()=>{
  const selected=selection();
  if(!selected.length){$('#shortlist-text').textContent='先给喜欢的叫法加入候选，或勾选一种质感。';announce('请先选择一个候选');return;}
  const text='Zibloo 第二轮声音候选：'+selected.join('；');
  try{await navigator.clipboard.writeText(text);$('#copy-choice').textContent='已复制';announce('选择已复制');}
  catch{$('#shortlist-text').textContent=text;announce('请选中候选文字复制');}
});
document.addEventListener('click',event=>{
  const voice=event.target.closest('[data-voice]');
  if(voice)start([{type:'voice',id:voice.dataset.voice,event:voice.dataset.event}]);
  const texture=event.target.closest('[data-texture]');
  if(texture)start([{type:'texture',id:texture.dataset.texture}]);
  const favorite=event.target.closest('[data-favorite]');
  if(favorite){const id=favorite.dataset.favorite;chosen.voices=chosen.voices.includes(id)?chosen.voices.filter(v=>v!==id):[...chosen.voices,id];save();}
});
document.addEventListener('change',event=>{
  const id=event.target.dataset.textureChoice;if(!id)return;
  chosen.textures=event.target.checked?[...new Set([...chosen.textures,id])]:chosen.textures.filter(t=>t!==id);save();
});
async function init(){
  const response=await fetch('manifest.json');if(!response.ok)throw new Error('Manifest unavailable');
  manifest=await response.json();
  chosen.voices=chosen.voices.filter(id=>manifest.voices.some(v=>v.id===id));
  chosen.textures=chosen.textures.filter(id=>manifest.textures.some(t=>t.id===id));
  $('#voices').innerHTML=manifest.voices.map(v=>`<article id="voice-${v.id}" class="sound-card voice-card" style="--accent:${v.color}">
    <div class="card-head"><span class="voice-letter">${v.letter}</span><div><h3>${esc(v.name)}</h3><p class="spelling">${esc(v.spelling)}</p></div></div><p class="description">${esc(v.description)}</p><p class="voice-note">${esc(v.note)}</p>
    <div class="card-actions"><button class="sequence" data-voice="${v.id}" data-event="greet" aria-label="${v.letter} 招牌叫声">▷ 招牌叫声</button><button class="favorite" data-favorite="${v.id}" aria-label="收藏 ${v.letter} ${esc(v.name)}" aria-pressed="false">加入候选</button></div>
    <div class="event-buttons">${manifest.events.filter(e=>e.id!=='greet').map(e=>`<button data-voice="${v.id}" data-event="${e.id}" aria-label="${v.letter} ${e.name}">${e.name}</button>`).join('')}</div><button class="sequence-button" data-voice="${v.id}" data-event="sequence" aria-label="${v.letter} 四种语气">▷ 连听四种语气</button>
  </article>`).join('');
  $('#textures').innerHTML=manifest.textures.map(t=>`<div class="texture" id="texture-${t.id}"><label for="choice-${t.id}"><input id="choice-${t.id}" type="checkbox" data-texture-choice="${t.id}"><span>${t.number} ${esc(t.name)}</span></label><button data-texture="${t.id}" aria-label="试听 B 加 ${t.number} ${esc(t.name)}">▷ 试听</button></div>`).join('');
  refreshSelection();for(const id of ['compare-names','compare-all','copy-choice'])$('#'+id).disabled=false;
}
init().catch(()=>{$('#voices').textContent='声音列表未能载入，请刷新后重试。';});
