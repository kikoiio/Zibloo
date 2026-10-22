const $ = selector => document.querySelector(selector);
const audio = $('#audio');
let manifest, queue = [], generation = 0, current = null;
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem('zibloo-sound-shortlist') || '[]')); } catch { /* Browsing without storage still works. */ }
audio.volume = .65;
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyphs = [
  '<circle cx="11" cy="22" r="5"/><circle cx="25" cy="12" r="7"/><circle cx="27" cy="28" r="3"/>',
  '<path d="M4 20q4-20 8 0t8 0t8 0t8 0"/>',
  '<path d="m18 3 3 11 12 4-12 4-3 11-4-11-11-4 11-4z"/>',
  '<path d="M7 13v16m7-22v21m8-16v19m7-22v16"/>',
  '<circle cx="18" cy="18" r="4"/><ellipse cx="18" cy="18" rx="16" ry="9" transform="rotate(-30 18 18)"/>',
  '<path d="M3 12h21q10 0 8-6t-8 0M3 19h16q10 0 8 8t-8 0M3 26h9"/>',
  '<path d="m8 4 21 28M4 12l22 21M16 3l16 22M3 23q13-15 30-13"/>',
  '<path d="M3 19h7l4-13 7 25 5-15 3 3h4"/>',
];

function shortlist() {
  const chosen = manifest.styles.filter(s => favorites.has(s.id));
  $('#shortlist-text').textContent = chosen.length ? chosen.map(s => `${s.number} ${s.name}`).join(' ／ ') : '点选「加入候选」，保留你想继续打磨的方向。';
  document.querySelectorAll('[data-favorite]').forEach(button => {
    const selected = favorites.has(button.dataset.favorite);
    button.setAttribute('aria-pressed', String(selected));
    button.textContent = selected ? '✓ 已加入' : '加入候选';
  });
}
function save() {
  try { localStorage.setItem('zibloo-sound-shortlist', JSON.stringify([...favorites])); } catch { /* Optional persistence. */ }
  shortlist();
}
function status(text) { $('#player-status').textContent = text; }
function stop() {
  generation++;
  queue = [];
  audio.pause();
  if (audio.src) audio.currentTime = 0;
  current = null;
  document.querySelectorAll('.is-playing').forEach(el => el.classList.remove('is-playing'));
  $('.player').classList.remove('playing');
}
async function play(item, token) {
  if (token !== generation) return;
  const style = manifest.styles.find(s => s.id === item.style);
  const name = item.event === 'sequence' ? '工作 → 休息 → 完成 → 日常提醒' : manifest.events.find(e => e.id === item.event).name;
  current = item;
  document.querySelectorAll('.is-playing').forEach(el => el.classList.remove('is-playing'));
  $(`#style-${style.id}`).classList.add('is-playing');
  $(`[data-style="${style.id}"][data-event="${item.event}"]`)?.classList.add('is-playing');
  $('#now-title').textContent = `${style.number} ${style.name}`;
  $('#now-detail').textContent = `${name}${queue.length ? ` · 后面还有 ${queue.length} 段` : ''}`;
  audio.src = item.event === 'sequence' ? style.sequence : style.clips[item.event];
  try {
    await audio.play();
    if (token !== generation) return;
    status(`正在试听 ${style.name}，${name}`);
  } catch (error) {
    if (token !== generation || error.name === 'AbortError') return;
    queue = [];
    $('#now-detail').textContent = '未能播放，请点击播放器重试。';
    status('声音未能播放，请点击播放器重试。');
  }
}
function start(items) {
  stop();
  queue = items.slice(1);
  void play(items[0], generation);
}
audio.addEventListener('play', () => $('.player').classList.add('playing'));
audio.addEventListener('pause', () => $('.player').classList.remove('playing'));
audio.addEventListener('ended', () => {
  $('.player').classList.remove('playing');
  if (queue.length) void play(queue.shift(), generation);
  else {
    document.querySelectorAll('.is-playing').forEach(el => el.classList.remove('is-playing'));
    status('试听完成');
  }
});
audio.addEventListener('error', () => {
  if (!current) return;
  queue = [];
  $('#now-detail').textContent = '音频加载失败，请重新选择一段试听。';
  status('音频加载失败');
});
$('#stop').addEventListener('click', () => { stop(); $('#now-detail').textContent = '已停止，可以继续选择'; status('已停止'); });
$('#compare-all').addEventListener('click', () => start(manifest.styles.map(s => ({style:s.id,event:$('#event-select').value}))));
$('#copy-choice').addEventListener('click', async () => {
  const chosen = manifest.styles.filter(s => favorites.has(s.id));
  if (!chosen.length) { status('请先加入一个候选'); $('#shortlist-text').textContent='先选一两个喜欢的方向，再复制给我。'; return; }
  const text = `Zibloo 声音候选：${chosen.map(s => `${s.number} ${s.name}`).join('、')}`;
  try { await navigator.clipboard.writeText(text); status('候选已复制'); $('#copy-choice').textContent='已复制'; }
  catch { $('#shortlist-text').textContent = text; status('请选中候选文字复制'); }
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-style]');
  if (button) start([{style:button.dataset.style,event:button.dataset.event}]);
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    const id = favorite.dataset.favorite;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    $('#copy-choice').textContent='复制我的选择';
    save();
  }
});
async function init() {
  const response = await fetch('manifest.json');
  if (!response.ok) throw new Error('Manifest unavailable');
  manifest = await response.json();
  favorites = new Set([...favorites].filter(id => manifest.styles.some(s => s.id === id)));
  $('#event-guide').innerHTML = manifest.events.map(e => `<div><span class="event-name">${esc(e.name)}</span><span class="event-intent">${esc(e.intent)}</span></div>`).join('');
  $('#styles').innerHTML = manifest.styles.map((s,i) => `<article class="sound-card" id="style-${s.id}" style="--accent:${s.color}">
    <div class="card-head"><div class="sound-icon" aria-hidden="true"><svg viewBox="0 0 36 36">${glyphs[i]}</svg></div><div><div class="number">VOICE ${s.number}</div><h3>${esc(s.name)}</h3></div><span class="role">${esc(s.role)}</span></div>
    <p class="description">${esc(s.description)}</p><p class="tags">${esc(s.tags)}</p>
    <div class="card-actions"><button class="sequence" data-style="${s.id}" data-event="sequence" aria-label="完整试听 ${s.name}">▷ 完整试听</button><button class="favorite" data-favorite="${s.id}" aria-pressed="false" aria-label="收藏 ${s.name}">加入候选</button></div>
    <div class="event-buttons">${manifest.events.map(e=>`<button data-style="${s.id}" data-event="${e.id}" aria-label="${s.name} · ${e.name}">${e.name}</button>`).join('')}</div>
  </article>`).join('');
  shortlist();
}
init().catch(() => { $('#styles').textContent = '试听列表未能载入，请刷新页面重试。'; });
