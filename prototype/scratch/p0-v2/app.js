const $ = (selector, root = document) => root.querySelector(selector);
const main = $('#main');
const shell = $('.app-shell');
const overlay = $('#overlay');
const paths = {
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-8h6v8"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.3 7"/><path d="M3 4v7h7M12 7v5l3 2"/>',
  settings: '<path d="m9 3-.6 3-2.7 1L3 6l-2 3 2.2 2v3L1 16l2 3 2.7-1 2.7 1 .6 3h4l.6-3 2.7-1 2.7 1 2-3-2.2-2v-3L22 9l-2-3-2.7 1-2.7-1L14 3z" transform="translate(1 -1) scale(.92)"/><circle cx="12" cy="12" r="3"/>',
  training: '<path d="m4 8 4-4m8 16 4-4M6 6l12 12M2 10l2 2 8-8-2-2m4 20-2-2 8-8 2 2"/>',
  focus: '<path d="M8 4c1-2 4-2 5 0m-1 2c-5-3-10 2-8 8 1 5 5 7 8 6 3 1 7-1 8-6 2-6-3-11-8-8z"/><path d="M12 6c3-1 4-3 4-4"/>',
  reminders: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  heart: '<path d="M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-4 4 2 10 8 15 6-5 12-11 8-15z"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  play: '<path d="m9 5 10 7-10 7z"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  skip: '<path d="m5 5 10 7L5 19zM19 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  water: '<path d="M12 2c0 0-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13zM8 15a4 4 0 0 0 4 4"/>',
  leaf: '<path d="M20 3C9 2 2 8 5 15s16 5 15-12zM5 20 16 8"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  export: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.reminders}</svg>`;
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copy = {
  '小窝':'Home','历史':'History','设置':'Settings','训练':'Train','专注':'Focus','记事':'Remind',
  '开始训练':'Start training','开始专注':'Start focus','返回小窝':'Back home','返回':'Back',
  '上午好':'Good morning','下午好':'Good afternoon','晚上好':'Good evening',
  '今天，想一起做点什么？':'What shall we do together?',
  '间歇与节奏':'Find your rhythm','留一点安静':'A little quiet','到点叫你':'Right on time',
  '点点 Zibloo，打个招呼':'Tap Zibloo to say hello',
  '只想计一小会儿':'Just a little timer','轻点即开始':'Tap to start','分钟':'min','秒':'sec','组':'rounds',
  '今天的陪伴':'Together today','一起度过了':'We’ve spent','看看我们的足迹':'Our little moments',
  '示例数据，用于预览界面':'Sample data for this prototype',
  '动起来，我陪你。':'Let’s move. I’m with you.', '不着急，专心一件事。':'One thing at a time.',
  '选一个节奏':'Pick a rhythm','经典间歇':'Classic intervals','力量训练':'Strength','耐力训练':'Endurance',
  '运动时间':'Work interval','休息时间':'Rest interval','循环组数':'Rounds','每一组的运动时长':'Time to move in each round',
  '两组之间喘口气':'A breath between rounds','按自己的节奏来':'Find your own pace','声音引导':'Audio guidance',
  '语音播报':'Voice','仅叫声':'Zibloo cues','关闭':'Off','预计':'About','不包含最后一组后的休息':'No break after the last round',
  '专注时长':'Focus duration','短休息':'Short break','这一段，留给':'Make time for','读书':'Reading','工作':'Work','学英语':'English','编程':'Coding',
  '自定义':'Custom','长休息循环':'Long-break cycle','保存':'Save','取消':'Cancel','任务名称':'Task name','每几个番茄后长休息':'Focus rounds before a long break','长休息时长（分钟）':'Long break (minutes)',
  '专注时间':'Focus time','休息一下':'Take a break','长休息':'Long break','快捷计时':'Quick timer','运动中':'Time to move','已暂停':'Paused',
  '接下来':'Up next','完成本次计时':'Finish this session','按自己的节奏，一点点就好。':'Your own pace is enough.',
  '安心专注，我在这里。':'Focus gently. I’m right here.','休息也是节奏的一部分。':'Rest is part of your rhythm.',
  '准备好了，再继续。':'Ready when you are.','暂停':'Pause','继续':'Resume','跳过这段':'Skip this phase','结束':'End',
  '结束这次计时？':'End this session?','这次已经度过的时间会保留在本次演示的历史中。':'Your time so far will stay in this demo’s history.',
  '继续计时':'Keep going','结束计时':'End session','完成啦，做得好！':'All done. Well done!',
  '这一点坚持，Zibloo 都记得。':'Zibloo was here for every moment.', '查看足迹':'View history',
  '有些小事，我帮你记着。':'I’ll remember the little things.', '我的提醒':'My reminders','新建提醒':'New reminder',
  '原型仅演示交互，不会设置系统闹钟。':'This prototype shows interactions and does not set system alarms.',
  '体验 Zibloo 来提醒你':'Preview a reminder','还没有提醒，先记下一件小事吧。':'Add a little thing to remember.',
  '编辑提醒':'Edit reminder','提醒名称':'Reminder name','提醒方式':'When to remind','稍后提醒':'After a while','指定时刻':'At a date and time','每天':'Every day','每周':'Every week','每隔几小时':'Every few hours',
  '多久以后（分钟）':'In how many minutes?','日期与时间':'Date and time','时间':'Time','间隔（小时）':'Interval (hours)','选择星期':'Days of the week',
  '响铃':'Sound','震动':'Vibration','删除提醒':'Delete reminder','保存提醒':'Save reminder','比如：喝口水':'For example: drink some water',
  '提醒已保存':'Reminder saved','提醒已删除':'Reminder deleted','请填写提醒名称':'Enter a reminder name',
  '请选择未来的时间':'Choose a future time','至少选择一天':'Select at least one day','请输入有效的间隔':'Enter a valid interval',
  '约好的时间到了。':'It’s time.', '知道啦':'Got it','每一点坚持，都有回响。':'Every little moment counts.',
  '本周专注':'Focus this week','比上周':'vs. last week','全部':'All','今日':'Today','完整完成':'Completed','提前结束':'Ended early',
  '还没有这类记录':'No records of this kind yet','让陪伴，更合心意。':'Make yourself comfortable.',
  '偏好':'Preferences','语言':'Language','提示音':'Timer sound','Zibloo 叫声':'Zibloo bubbles','清脆':'Soft chime','静音':'Silent',
  '震动强度':'Vibration strength','轻':'Light','标准':'Standard','强':'Strong','减少动态效果':'Reduce motion',
  '在原型中试听提示音':'Preview a timer sound','数据与关于':'Data & about','导出记录':'Export records',
  '导出本次原型中的示例与体验记录':'Export sample and session data from this prototype','版本':'Version','P0 交互原型':'P0 interactive prototype',
  '网页演示，不承诺后台提醒。安卓可靠性需后续真机验收。':'Web demo. Background reminders are not guaranteed. Android reliability needs device testing.',
  '今天也一起，慢慢来。':'A little time, together.', '你好呀，我是 Zibloo！':'Hello, I’m Zibloo!',
  '点一下，看看 Zibloo 的变化':'Tap to see Zibloo change',
  '点点我，打个招呼':'Tap me to say hello',
  '腕足会轻轻回应你':'A little wave, just for you',
  '一点时间，一起度过。':'A little time, together.',
  '慢慢来，Zibloo 在。':'Take your time. Zibloo is here.',
  '留一点时间，做喜欢的事。':'Make a little room for what you love.',
  '待机 · 自在悬游':'Idle · drifting gently',
  '训练 · 跟上你的节奏':'Training · at your pace',
  '专注 · 安静陪你':'Focus · quietly here',
  '提醒 · 轻轻叫你':'Reminder · a gentle nudge',
  '庆祝 · 为你开心':'Celebrate · happy for you',
  '待机 · 浅水绿':'Idle · seafoam','训练 · 珊瑚橙':'Training · coral','专注 · 沙金色':'Focus · sand',
  '提醒 · 天蓝色':'Reminder · sky','庆祝 · 草绿色':'Celebrate · green','暂停 · 安静等你':'Paused · waiting for you',
  '已减少动态效果':'Reduced motion is on',
  '阶段引导可关闭，完成提醒跟随设置中的提示音。':'Phase guidance can be turned off. Completion follows the timer sound setting.',
  '当前为静音，请先在设置中开启提示音。':'Sound is muted. Choose a timer sound in Settings first.',
  '声音未能启用，请点按声音试听后重试。':'Audio could not start. Tap the sound preview and try again.',
  '探索 Zibloo 的声音':'Explore Zibloo’s voice',
  '8 种音色，分别试听工作、休息与提醒':'8 voices for work, breaks, and reminders',
};
const state = {
  locale: 'zh-CN', page: 'home', speed: 1, guidance: 'cues', characterPreview: 'auto',
  training: { work: 30, rest: 15, rounds: 8, preset: 0 },
  focus: { work: 25, rest: 5, rounds: 4, longRest: 15, tag: '读书' },
  settings: { sound: 'zibloo', vibration: 'standard', voice: true, reduced: false },
  reminders: [
    { id:'demo-water', name:'喝口水', rule:'later', amount:30, time:'', days:[1,3,5], enabled:true, sound:true, vibration:true, voice:true, demo:true },
    { id:'demo-vitamin', name:'吃维生素', rule:'daily', amount:1, time:'08:30', days:[1,3,5], enabled:true, sound:true, vibration:true, voice:true, demo:true },
  ],
  history: [
    { id:'h1', kind:'focus', label:'读书', seconds:1500, time:'10:25', complete:true, demo:true },
    { id:'h2', kind:'training', label:'经典间歇', seconds:345, time:'09:30', complete:true, demo:true },
    { id:'h3', kind:'reminder', label:'喝口水', seconds:0, time:'09:00', complete:true, demo:true },
    { id:'h4', kind:'focus', label:'工作', seconds:1200, time:'08:40', complete:true, demo:true },
  ],
  filter: 'all', session: null, dialog: null,
};
const t = text => state.locale === 'en' ? copy[text] || text : text;
const unit = text => t(text);
const fmt = seconds => {const value=Math.ceil(Math.max(0,seconds));return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;};
const durationText = seconds => state.locale === 'en' ? `${Math.floor(seconds/60)} min ${Math.round(seconds%60)} sec` : `${Math.floor(seconds/60)} 分 ${Math.round(seconds%60)} 秒`;
const roundText = (round, count) => state.locale === 'en' ? `Round ${round} of ${count}` : `第 ${round} / ${count} 组`;
const moodNames = {idle:'待机 · 自在悬游', training:'训练 · 跟上你的节奏', focus:'专注 · 安静陪你', reminder:'提醒 · 轻轻叫你', celebrate:'庆祝 · 为你开心', paused:'暂停 · 安静等你'};
function characterMood(forced) {
  if (state.characterPreview !== 'auto') return state.characterPreview;
  if (forced) return forced;
  if (state.page === 'timer' && state.session) {
    if (state.session.paused) return 'paused';
    const phase = projection();
    if (phase?.phase !== 'work') return 'idle';
    return state.session.kind === 'training' ? 'training' : state.session.kind === 'focus' ? 'focus' : 'idle';
  }
  return state.page === 'training' ? 'training' : state.page === 'focus' ? 'focus' : state.page === 'reminders' ? 'reminder' : 'idle';
}
const image = (className='', alt='Zibloo', forced='') => `<span class="mascot live-zibloo ${className}" data-mood="${characterMood(forced)}" ${forced?`data-character-state="${forced}"`:''} role="img" aria-label="${escape(alt)} ${t(moodNames[characterMood(forced)])}">${Zibloo.svg().replace('role="img"','aria-hidden="true"')}</span>`;
const btn = (action, text, className='', attrs='') => `<button class="${className}" data-action="${action}" ${attrs}>${text}</button>`;
const toggle = (action, checked, label, attrs='') => btn(action, '', 'switch', `role="switch" aria-checked="${checked}" aria-label="${escape(label)}" ${attrs}`);
const header = (title, subtitle) => `<header class="page-header"><div><h1>${t(title)}</h1><p class="subtitle">${t(subtitle)}</p></div></header>`;
const backHeader = title => `<header class="back-header">${btn('home',icon('back'),'back-button',`aria-label="${t('返回小窝')}"`)}<div><h1>${t(title)}</h1></div></header>`;
const templates = [ ['经典间歇',30,15,8], ['Tabata',20,10,8], ['力量训练',40,20,6], ['耐力训练',60,30,4] ];
let toastHandle, audioContext, previousFocus, greetingHandle;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function updateCharacter() {
  document.querySelectorAll('.live-zibloo').forEach(el => {
    const mood=characterMood(el.dataset.characterState);
    el.dataset.mood=mood;
    el.setAttribute('aria-label',`Zibloo ${t(moodNames[mood])}`);
  });
  const caption=$('#character-state-label');
  if(caption)caption.textContent=t(state.settings.reduced||reducedMotion.matches?'已减少动态效果':moodNames[characterMood()]);
  Zibloo.refresh();
}

function nav() {
  document.querySelectorAll('.product-nav').forEach(el => {
    el.innerHTML = ['home','history','settings'].map((page,i) => `<a class="nav-item ${state.page===page?'active':''}" href="#${page}" data-page="${page}" ${state.page===page?'aria-current="page"':''}>${icon(page)}<span>${t(['小窝','历史','设置'][i])}</span></a>`).join('');
  });
}
function render(focus = true) {
  shell.classList.toggle('is-running', state.page === 'timer');
  shell.classList.toggle('reduced', state.settings.reduced);
  document.documentElement.classList.toggle('reduced-motion', state.settings.reduced);
  document.documentElement.lang = state.locale;
  document.title=state.locale==='en'?'Zibloo · A little time, together':'Zibloo · 一起，慢慢来';
  document.querySelectorAll('[data-copy]').forEach(el=>{el.textContent=t(el.dataset.copy);});
  nav();
  const pages = { home:homePage, training:trainingPage, focus:focusPage, reminders:remindersPage, timer:timerPage, history:historyPage, settings:settingsPage };
  main.innerHTML = (pages[state.page] || homePage)();
  Zibloo.refresh();
  if (focus) main.focus({preventScroll:true});
  if (state.page === 'timer') updateTimer();
}
function go(page) {
  if (state.session && page !== 'timer') return endDialog();
  state.page = page;
  render();
  window.scrollTo({top:0,behavior:'instant'});
}
function modeEntry(kind, title, subtitle) {
  return btn(`go-${kind}`, `<span class="mode-icon">${icon(kind)}</span><span><strong>${t(title)}</strong><small>${t(subtitle)}</small></span>`, `mode-entry mode-${kind}`);
}
function homePage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';
  return `${Zibloo.logo('mobile-brand')}<header class="page-header"><div><p class="greeting">${icon('sun')}${t(greeting)}</p><h1>${t('今天，想一起做点什么？')}</h1></div>${btn('go-settings',icon('settings'),'avatar-button',`aria-label="${t('设置')}"`)}</header><p class="home-intro">${t('留一点时间，做喜欢的事。')}</p>
    <section class="home-stage" aria-label="${t('小窝')}"><div class="ocean-floor"></div><span class="bubble one"></span><span class="bubble two"></span><span class="bubble three"></span><span class="bubble four"></span>
    <button class="mascot-main" data-action="hello" aria-label="${t('点点我，打个招呼')}">${image()}</button>
    ${modeEntry('training','训练','间歇与节奏')}${modeEntry('focus','专注','留一点安静')}${modeEntry('reminders','记事','到点叫你')}
    <p class="character-caption">${t('点点我，打个招呼')}<small class="character-status" id="character-state-label">${t(state.settings.reduced||reducedMotion.matches?'已减少动态效果':moodNames[characterMood()])}</small></p></section>
    <section class="quick-section"><div class="section-heading"><h2>${t('只想计一小会儿')}</h2><span class="muted">${t('轻点即开始')}</span></div><div class="quick-options">${[1,3,5,10].map(n=>btn(`quick-${n}`,`<strong>${n}</strong><span>${unit('分钟')}</span>`,'quick-button',`aria-label="${n} ${unit('分钟')}"`)).join('')}</div></section>
    <a href="#history" data-page="history" class="companion-card"><span class="companion-icon">${icon('heart')}</span><div class="companion-copy"><h2>${t('今天的陪伴')}</h2><p>${t('一起度过了')}<strong>${Math.floor(state.history.filter(h=>!h.demo&&h.kind!=='reminder').reduce((sum,h)=>sum+h.seconds,0)/60)}</strong>${unit('分钟')}</p></div>${icon('chevron')}</a>
    <p class="demo-note">${t('示例数据，用于预览界面')}</p>`;
}
function stepper(key, title, hint, value, suffix) {
  return `<div class="stepper-row"><div class="stepper-label">${t(title)}<small>${t(hint)}</small></div><div class="stepper">${btn(`step-${key}--`,'−','',`aria-label="${t(title)} −"`)}<output>${value}<small>${unit(suffix)}</small></output>${btn(`step-${key}-+`,'+','',`aria-label="${t(title)} +"`)}</div></div>`;
}
function trainingPage() {
  const p=state.training;
  return `${backHeader('训练')}<div class="mode-heading"><div><h2>${t('动起来，我陪你。')}</h2><p class="subtitle">${roundText(1,p.rounds)}</p></div>${image()}</div>
    <div class="field-heading">${t('选一个节奏')}</div><div class="preset-grid">${templates.map(([name,w,r,n],i)=>btn(`preset-${i}`,`<strong>${t(name)}</strong><span>${w} / ${r} ${unit('秒')} × ${n}</span>`,`preset ${p.preset===i?'selected':''}`,`aria-pressed="${p.preset===i}"`)).join('')}</div>
    <section class="panel">${stepper('work','运动时间','每一组的运动时长',p.work,'秒')}${stepper('rest','休息时间','两组之间喘口气',p.rest,'秒')}${stepper('rounds','循环组数','按自己的节奏来',p.rounds,'组')}</section>
    <div class="field-heading">${t('声音引导')}</div><div class="segmented">${[['voice','语音播报'],['cues','仅叫声'],['off','关闭']].map(([value,label])=>btn(`guidance-${value}`,t(label),state.guidance===value?'selected':'',`aria-pressed="${state.guidance===value}"`)).join('')}</div><p class="demo-note">${t('阶段引导可关闭，完成提醒跟随设置中的提示音。')}</p>
    <div class="start-footer"><p>${t('预计')} ${durationText(p.work*p.rounds+p.rest*(p.rounds-1))}</p>${btn('start-training',`${icon('play')}${t('开始训练')}`,'primary')}<p class="demo-note">${t('不包含最后一组后的休息')}</p></div>`;
}
function focusPage() {
  const p=state.focus;
  const choices=(key, values, current)=>`<div class="choice-row">${values.map(n=>btn(`focus-${key}-${n}`,`${n} ${unit('分钟')}`,`choice ${current===n?'selected':''}`,`aria-pressed="${current===n}"`)).join('')}</div>`;
  return `${backHeader('专注')}<div class="mode-heading"><div><h2>${t('不着急，专心一件事。')}</h2><p class="subtitle">${t('安心专注，我在这里。')}</p></div>${image()}</div>
    <section class="panel"><div class="field-heading">${t('专注时长')}</div>${choices('work',[15,20,25,50],p.work)}<div class="field-heading" style="margin-top:25px">${t('短休息')}</div>${choices('rest',[3,5,10],p.rest)}</section>
    <section class="panel"><div class="field-heading">${t('这一段，留给')}</div><div class="choice-row tags">${['读书','工作','学英语','编程'].map(tag=>btn(`tag-${tag}`,t(tag),`choice ${p.tag===tag?'selected':''}`,`aria-pressed="${p.tag===tag}"`)).join('')}${btn('custom-tag',`+ ${t('自定义')}`,'choice')}</div>${!['读书','工作','学英语','编程'].includes(p.tag)?`<p class="subtitle">${escape(p.tag)}</p>`:''}</section>
    <div class="focus-extra"><span>${state.locale==='en'?`Long break after ${p.rounds} focus rounds`:`每 ${p.rounds} 个番茄，长休息 ${p.longRest} 分钟`}</span>${btn('focus-options',t('长休息循环'))}</div>
    <div class="start-footer">${btn('start-focus',`${icon('play')}${t('开始专注')}`,'primary coral')}</div>`;
}
function reminderRule(r) {
  if(r.rule==='later') return state.locale==='en'?`In ${r.amount} min`:`${r.amount} 分钟后`;
  if(r.rule==='at') return new Date(r.time).toLocaleString(state.locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  if(r.rule==='daily') return `${t('每天')} ${r.time}`;
  if(r.rule==='weekly') return `${t('每周')} ${r.days.map(d=>state.locale==='en'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]:['日','一','二','三','四','五','六'][d]).join(' / ')} ${r.time}`;
  return state.locale==='en'?`Every ${r.amount} hours`:`每 ${r.amount} 小时`;
}
function reminderName(r) {
  return state.locale==='en'&&r.demo ? (r.id==='demo-water'?'Drink some water':'Take vitamins') : r.name;
}
function remindersPage() {
  return `${backHeader('记事')}<div class="mode-heading"><div><h2>${t('有些小事，我帮你记着。')}</h2></div>${image()}</div>
    <div class="reminder-toolbar"><span class="eyebrow">${t('我的提醒')} · ${state.reminders.length}</span>${btn('add-reminder',`${icon('plus')}${t('新建提醒')}`,'add-button')}</div>
    ${state.reminders.map(r=>`<div class="reminder-card"><span class="reminder-symbol">${icon(r.id==='demo-water'?'water':'reminders')}</span>${btn(`edit-${r.id}`,`<strong>${escape(reminderName(r))}</strong><small>${escape(reminderRule(r))}</small>`,'reminder-detail',`aria-label="${t('编辑提醒')} ${escape(reminderName(r))}"`)}${toggle(`enable-${r.id}`,r.enabled,reminderName(r))}</div>`).join('')||`<div class="empty-state">${icon('reminders')}${t('还没有提醒，先记下一件小事吧。')}</div>`}
    <p class="info-note">${icon('info')}<span>${t('原型仅演示交互，不会设置系统闹钟。')}</span></p>${btn('preview-reminder',t('体验 Zibloo 来提醒你'),'text-button')}`;
}
function buildSession(kind, minutes=1) {
  // Unlock on the actual Start click, including quick/focus timers without an opening cue.
  void ensureAudio().catch(audioProblem);
  const segments=[];
  if(kind==='training') {
    const p=state.training;
    for(let round=1;round<=p.rounds;round++) {
      segments.push({phase:'work',seconds:p.work,round});
      if(round<p.rounds&&p.rest>0) segments.push({phase:'rest',seconds:p.rest,round});
    }
  } else if(kind==='focus') {
    const p=state.focus;
    for(let round=1;round<=p.rounds;round++) {
      segments.push({phase:'work',seconds:p.work*60,round});
      segments.push({phase:round===p.rounds?'long-rest':'rest',seconds:(round===p.rounds?p.longRest:p.rest)*60,round});
    }
  } else segments.push({phase:'work',seconds:minutes*60,round:1});
  state.session={kind,segments,rounds:kind==='training'?state.training.rounds:kind==='focus'?state.focus.rounds:1,label:kind==='focus'?state.focus.tag:kind==='training'?(templates[state.training.preset]?.[0]||'训练'):'快捷计时',anchor:Date.now(),elapsed:0,skipped:0,paused:false,index:0,startedAt:new Date(),total:segments.reduce((sum,s)=>sum+s.seconds,0)};
  state.page='timer'; render();window.scrollTo({top:0,behavior:'instant'});playCue(kind==='training'?'rise2':null);
}
function elapsed() {
  const s=state.session;
  return s ? s.elapsed+(s.paused?0:(Date.now()-s.anchor)/1000*state.speed) : 0;
}
function projection() {
  const s=state.session;
  if(!s) return null;
  let rest=elapsed();
  for(let i=0;i<s.segments.length;i++) {
    const phase=s.segments[i];
    if(rest<phase.seconds) return {...phase,index:i,remaining:phase.seconds-rest,next:s.segments[i+1]||null};
    rest-=phase.seconds;
  }
  return null;
}
function phaseLabel(s,p) {
  return p.phase==='long-rest'?'长休息':p.phase==='rest'?'休息一下':s.kind==='focus'?'专注时间':s.kind==='training'?'运动中':'快捷计时';
}
function timerPage() {
  const s=state.session;
  if(!s) {state.page='home';return homePage();}
  const p=projection();
  if(!p) return '';
  return `<section class="timer-screen" data-color="${p.phase!=='work'?'mint':s.kind==='focus'?'coral':s.kind==='training'?'training':'brand'}"><div class="timer-top"><span class="timer-kind">${icon(s.kind==='quick'?'history':s.kind)}${t(s.kind==='training'?'训练':s.kind==='focus'?'专注':'快捷计时')}</span><span>${escape(t(s.label))}</span></div>
    <div class="phase-badge" id="phase-label" aria-live="polite">${t(s.paused?'已暂停':phaseLabel(s,p))}</div><div class="timer-orbit"><svg class="progress-svg" viewBox="0 0 310 310" aria-hidden="true"><circle class="progress-track" cx="155" cy="155" r="149"/><circle class="progress-value" cx="155" cy="155" r="149" stroke-dasharray="936.2" stroke-dashoffset="0"/></svg><div class="orbit-content">${image()}<div class="time-display" role="timer" aria-label="${t('时间')}">${fmt(p.remaining)}</div><div class="round-label">${roundText(p.round,s.rounds)}</div></div></div>
    <div class="next-phase"><span>${t('接下来')}</span><strong id="next-label">${p.next?`${t(phaseLabel(s,p.next))} ${fmt(p.next.seconds)}`:t('完成本次计时')}</strong></div>
    <p class="timer-message">${t(s.paused?'准备好了，再继续。':p.phase!=='work'?'休息也是节奏的一部分。':s.kind==='focus'?'安心专注，我在这里。':'按自己的节奏，一点点就好。')}</p>
    ${btn('pause-timer',icon(s.paused?'play':'pause'),'pause-button',`aria-label="${t(s.paused?'继续':'暂停')}"`)}<div class="timer-actions">${btn('skip-timer',`${icon('skip')}${t('跳过这段')}`)}${btn('end-timer',`${icon('stop')}${t('结束')}`)}</div></section>`;
}
function updateTimer() {
  const s=state.session;if(!s) return;
  const p=projection();if(!p)return finishSession(true);
  if(p.index!==s.index) {
    s.index=p.index;playCue(p.phase==='work'?'rise2':'fall2');
    if(state.page==='timer') render(false);
    return;
  }
  if(state.page!=='timer')return;
  const time=$('.time-display');if(time)time.textContent=fmt(p.remaining);
  const progress=$('.progress-value');if(progress)progress.style.strokeDashoffset=String(936.2*(1-p.remaining/p.seconds));
}
function addHistory(complete, seconds) {
  const s=state.session;if(!s)return;
  state.history.unshift({id:crypto.randomUUID(),kind:s.kind==='quick'?'focus':s.kind,label:s.label,seconds:Math.round(seconds),time:new Date().toLocaleTimeString(state.locale,{hour:'2-digit',minute:'2-digit'}),complete,demo:false});
}
function finishSession(complete) {
  const s=state.session;if(!s)return;
  const seconds=Math.max(0,Math.min(s.total,elapsed())-s.skipped);addHistory(complete,seconds);
  state.session=null;state.page='home';render();
  if(complete){playCue('cheer3',false,s.kind);openDialog(`<div class="completion">${image('','Zibloo','celebrate')}<h2>${t('完成啦，做得好！')}</h2><p>${t('这一点坚持，Zibloo 都记得。')}</p><div class="completion-stat">${durationText(seconds)}</div>${btn('completion-home',t('返回小窝'),'primary')}${btn('completion-history',t('查看足迹'),'text-button')}</div>`);}
}
function endDialog() {
  openDialog(`<div class="dialog-header"><h2>${t('结束这次计时？')}</h2>${btn('close-dialog',icon('close'),'close-button',`aria-label="${t('取消')}"`)}</div><p class="subtitle">${t('这次已经度过的时间会保留在本次演示的历史中。')}</p><div class="dialog-choices">${btn('close-dialog',t('继续计时'),'secondary')}${btn('confirm-end',t('结束计时'),'primary')}</div>`);
}
function historyPage() {
  const records=state.history.filter(h=>state.filter==='all'||h.kind===state.filter);
  return `${header('历史','每一点坚持，都有回响。')}<section class="panel"><div class="week-heading"><div><p>${t('本周专注')}</p><strong>3.5 <small>${state.locale==='en'?'hours':'小时'}</small></strong></div><span class="week-change">↗ 18% ${t('比上周')}</span></div><div class="chart" aria-label="${state.locale==='en'?'Example weekly focus chart':'示例周专注时长图'}">${[35,65,49,85,40,55,72].map((height,i)=>`<div class="chart-day ${i===6?'today':''}"><div class="chart-bar" style="height:${height}%" role="img" aria-label="${height} ${unit('分钟')}"></div><small>${state.locale==='en'?['M','T','W','T','F','S','S'][i]:['一','二','三','四','五','六','日'][i]}</small></div>`).join('')}</div><p class="demo-note">${t('示例数据，用于预览界面')}</p></section>
    <div class="history-filters">${[['all','全部'],['training','训练'],['focus','专注'],['reminder','记事']].map(([value,label])=>btn(`filter-${value}`,t(label),`filter ${state.filter===value?'selected':''}`,`aria-pressed="${state.filter===value}"`)).join('')}</div><div class="eyebrow">${t('今日')}</div>
    ${records.map(h=>`<article class="history-item"><span class="mode-icon ${h.kind}">${icon(h.kind==='reminder'?'reminders':h.kind)}</span><div><h3>${escape(t(h.label))}</h3><small>${escape(h.time)} · ${t(h.complete?'完整完成':'提前结束')}${h.demo?' · '+(state.locale==='en'?'Sample':'示例'):''}</small></div><span>${h.kind==='reminder'?'—':durationText(h.seconds)}</span></article>`).join('')||`<div class="empty-state">${t('还没有这类记录')}</div>`}`;
}
function settingsPage() {
  const p=state.settings;
  return `${header('设置','让陪伴，更合心意。')}<section class="settings-section"><h2>${t('偏好')}</h2><div class="settings-group">
    <label class="setting-row"><span>${t('语言')}</span><select id="language"><option value="zh-CN" ${state.locale==='zh-CN'?'selected':''}>简体中文</option><option value="en" ${state.locale==='en'?'selected':''}>English</option></select></label>
    <label class="setting-row"><span>${t('提示音')}</span><select id="sound">${[['zibloo','Zibloo 叫声'],['chime','清脆'],['silent','静音']].map(([v,l])=>`<option value="${v}" ${p.sound===v?'selected':''}>${t(l)}</option>`).join('')}</select></label>
    <label class="setting-row"><span>${t('震动强度')}</span><select id="vibration">${[['light','轻'],['standard','标准'],['strong','强']].map(([v,l])=>`<option value="${v}" ${p.vibration===v?'selected':''}>${t(l)}</option>`).join('')}</select></label>
    <div class="setting-row"><span>${t('语音播报')}</span>${toggle('toggle-voice',p.voice,t('语音播报'))}</div><div class="setting-row"><span>${t('减少动态效果')}</span>${toggle('toggle-reduced',p.reduced,t('减少动态效果'))}</div>
    <div class="setting-row">${btn('preview-sound',t('在原型中试听提示音'),'text-button')}</div><a class="setting-row" href="sound-lab/index.html"><span>${t('探索 Zibloo 的声音')}<small>${t('8 种音色，分别试听工作、休息与提醒')}</small></span>${icon('chevron')}</a></div></section>
    <section class="settings-section"><h2>${t('数据与关于')}</h2><div class="settings-group"><div class="setting-row"><span>${t('导出记录')}<small>${t('导出本次原型中的示例与体验记录')}</small></span>${btn('export',icon('export'),'setting-value',`aria-label="${t('导出记录')}"`)}</div><div class="setting-row"><span>${t('版本')}</span><span class="setting-value">${t('P0 交互原型')}</span></div></div></section>
    <p class="info-note">${icon('info')}<span>${t('网页演示，不承诺后台提醒。安卓可靠性需后续真机验收。')}</span></p><div class="brand-footer">${Zibloo.logo()}</div>`;
}
function openDialog(content) {
  if(!overlay.firstElementChild) previousFocus=document.activeElement;
  overlay.innerHTML=`<div class="overlay-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="${state.locale==='en'?'Dialog':'对话框'}">${content}</section></div>`;
  document.body.style.overflow='hidden';
  const first=$('input, select, button',overlay);first?.focus();
  Zibloo.refresh();
}
function closeDialog() {overlay.innerHTML='';document.body.style.overflow='';state.dialog=null;Zibloo.refresh();previousFocus?.isConnected&&previousFocus.focus();}
function reminderDialog(id) {
  const existing=state.reminders.find(r=>r.id===id);
  const r=existing?{...existing,days:[...existing.days]}:{id:crypto.randomUUID(),name:'',rule:'later',amount:30,time:'08:30',days:[1,3,5],enabled:true,sound:true,vibration:true,voice:true,demo:false};
  state.dialog={type:'reminder',reminder:r,editing:!!existing};
  drawReminderDialog();
}
function drawReminderDialog() {
  const {reminder:r,editing}=state.dialog;
  const choices=[['later','稍后提醒'],['at','指定时刻'],['daily','每天'],['weekly','每周'],['interval','每隔几小时']];
  openDialog(`<div class="dialog-header"><h2>${t(editing?'编辑提醒':'新建提醒')}</h2>${btn('close-dialog',icon('close'),'close-button',`aria-label="${t('取消')}"`)}</div><label class="input-group"><span>${t('提醒名称')}</span><input class="text-input" id="reminder-name" value="${escape(r.name)}" maxlength="40" placeholder="${t('比如：喝口水')}" required></label><label class="input-group"><span>${t('提醒方式')}</span><select id="reminder-rule">${choices.map(([v,l])=>`<option value="${v}" ${r.rule===v?'selected':''}>${t(l)}</option>`).join('')}</select></label>
    ${['later','interval'].includes(r.rule)?`<label class="input-group"><span>${t(r.rule==='later'?'多久以后（分钟）':'间隔（小时）')}</span><input id="reminder-amount" class="text-input" type="number" min="1" max="${r.rule==='later'?10080:168}" value="${r.amount}" required></label>`:`<label class="input-group"><span>${t(r.rule==='at'?'日期与时间':'时间')}</span><input id="reminder-time" class="text-input" type="${r.rule==='at'?'datetime-local':'time'}" value="${escape(r.time)}" required></label>`}
    ${r.rule==='weekly'?`<div class="input-group"><span>${t('选择星期')}</span><div class="weekdays">${[1,2,3,4,5,6,0].map(day=>btn(`day-${day}`,state.locale==='en'?['S','M','T','W','T','F','S'][day]:['日','一','二','三','四','五','六'][day],r.days.includes(day)?'selected':'',`aria-pressed="${r.days.includes(day)}"`)).join('')}</div></div>`:''}
    <div class="settings-group">${[['sound','响铃'],['vibration','震动'],['voice','语音播报']].map(([key,label])=>`<div class="setting-row"><span>${t(label)}</span>${toggle(`reminder-${key}`,r[key],t(label))}</div>`).join('')}</div>${btn('save-reminder',t('保存提醒'),'primary sky')}${editing?btn('delete-reminder',t('删除提醒'),'danger-link'):''}`);
}
function syncReminderForm() {
  if(state.dialog?.type!=='reminder')return;
  const r=state.dialog.reminder;
  r.name=$('#reminder-name').value.trim();
  if($('#reminder-amount'))r.amount=Number($('#reminder-amount').value);
  if($('#reminder-time'))r.time=$('#reminder-time').value;
}
function saveReminder() {
  syncReminderForm();const r=state.dialog.reminder;
  if(!r.name)return toast(t('请填写提醒名称'));
  if(['later','interval'].includes(r.rule)&&(!Number.isInteger(r.amount)||r.amount<1||r.amount>(r.rule==='later'?10080:168)))return toast(t('请输入有效的间隔'));
  if(r.rule==='at'&&(!r.time||new Date(r.time).getTime()<=Date.now()))return toast(t('请选择未来的时间'));
  if(['daily','weekly'].includes(r.rule)&&!/^\d{2}:\d{2}$/.test(r.time))return toast(t('请选择未来的时间'));
  if(r.rule==='weekly'&&!r.days.length)return toast(t('至少选择一天'));
  const index=state.reminders.findIndex(x=>x.id===r.id);
  r.demo=false;
  if(index===-1)state.reminders.push(r);else state.reminders[index]=r;
  closeDialog();render(false);toast(t('提醒已保存'));
}
function toast(text) {
  const el=$('.toast');clearTimeout(toastHandle);el.textContent=text;el.hidden=false;
  toastHandle=setTimeout(()=>{el.hidden=true;},2800);
}
async function ensureAudio() {
  if(state.settings.sound==='silent')return null;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)throw new Error('Web Audio unavailable');
  if(!audioContext||audioContext.state==='closed')audioContext=new Audio();
  if(audioContext.state!=='running')await audioContext.resume();
  return audioContext;
}
function audioProblem() { toast(t('声音未能启用，请点按声音试听后重试。')); }
async function playCue(cue, preview=false, kind=state.session?.kind) {
  if(!cue)return;
  if(state.settings.sound==='silent'){
    if(preview)toast(t('当前为静音，请先在设置中开启提示音。'));
    return;
  }
  // Training guidance controls phase cues only, never completion or other activities.
  if(!preview&&kind==='training'&&state.guidance==='off'&&['rise2','fall2'].includes(cue))return;
  try {
    const context=await ensureAudio();
    if(!context||state.settings.sound==='silent')return;
    const base=state.settings.sound==='chime'?900:430;
    const notes=cue==='rise2'?[1,1.4]:cue==='fall2'?[1.3,.9]:cue==='cheer3'?[1,1.25,1.6]:[1.1,1.4,1.1];
    notes.forEach((n,i)=>{const osc=context.createOscillator(),gain=context.createGain(),at=context.currentTime+.02+i*.21;osc.type='sine';osc.frequency.setValueAtTime(base*n,at);osc.frequency.exponentialRampToValueAtTime(base*n*.72,at+.19);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.16,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.21);osc.connect(gain);gain.connect(context.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+.23);});
    if(!preview&&kind==='training'&&state.guidance==='voice'&&state.settings.voice&&'speechSynthesis'in window){const speech=new SpeechSynthesisUtterance(t(cue==='rise2'?'运动时间':cue==='fall2'?'休息一下':cue==='cheer3'?'完成啦，做得好！':'约好的时间到了。'));speech.lang=state.locale;window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);}
  }catch{audioProblem();}
}
function previewReminder() {
  playCue('call',true);
  openDialog(`<div class="completion">${image('','Zibloo','reminder')}<h2>${state.locale==='en'?'Time for a sip of water':'喝口水吧'}</h2><p>${t('约好的时间到了。')}</p>${btn('close-dialog',t('知道啦'),'primary sky')}</div>`);
}
function handleAction(action) {
  if(action==='home')return go('home');
  if(action.startsWith('go-'))return go(action.slice(3));
  if(action==='hello'){
    state.characterPreview='auto';$('#character-preview').value='auto';updateCharacter();
    const el=$('.mascot-main .live-zibloo');
    Zibloo.greet(el);
    playCue('call',true);return toast(t('你好呀，我是 Zibloo！'));
  }
  if(action.startsWith('quick-'))return buildSession('quick',Number(action.slice(6)));
  if(action.startsWith('preset-')){const i=Number(action.slice(7)),[,work,rest,rounds]=templates[i];state.training={work,rest,rounds,preset:i};return render(false);}
  if(action.startsWith('step-')){const [,key,op]=action.split('-');const delta=key==='rounds'?1:5;const p=state.training;p[key]=Math.max(key==='rest'?0:1,Math.min(key==='rounds'?30:300,p[key]+(op==='+'?delta:-delta)));p.preset=-1;return render(false);}
  if(action.startsWith('guidance-')){state.guidance=action.slice(9);return render(false);}
  if(action==='start-training')return buildSession('training');
  if(action==='start-focus')return buildSession('focus');
  if(action.startsWith('focus-work-')||action.startsWith('focus-rest-')){const [,key,value]=action.split('-');state.focus[key]=Number(value);return render(false);}
  if(action.startsWith('tag-')){state.focus.tag=action.slice(4);return render(false);}
  if(action==='custom-tag'){state.dialog={type:'tag'};return openDialog(`<div class="dialog-header"><h2>${t('任务名称')}</h2>${btn('close-dialog',icon('close'),'close-button',`aria-label="${t('取消')}"`)}</div><input id="custom-tag" class="text-input" maxlength="24" value=""><div class="dialog-choices">${btn('close-dialog',t('取消'),'secondary')}${btn('save-tag',t('保存'),'primary coral')}</div>`);}
  if(action==='save-tag'){const value=$('#custom-tag').value.trim();if(!value)return $('#custom-tag').focus();state.focus.tag=value;closeDialog();return render(false);}
  if(action==='focus-options'){state.dialog={type:'focus'};return openDialog(`<div class="dialog-header"><h2>${t('长休息循环')}</h2>${btn('close-dialog',icon('close'),'close-button',`aria-label="${t('取消')}"`)}</div><label class="input-group"><span>${t('每几个番茄后长休息')}</span><input class="text-input" type="number" id="focus-rounds" min="1" max="12" value="${state.focus.rounds}"></label><label class="input-group"><span>${t('长休息时长（分钟）')}</span><input class="text-input" type="number" id="focus-long" min="1" max="60" value="${state.focus.longRest}"></label>${btn('save-focus',t('保存'),'primary coral')}`);}
  if(action==='save-focus'){const rounds=Number($('#focus-rounds').value),rest=Number($('#focus-long').value);if(!Number.isInteger(rounds)||rounds<1||rounds>12||!Number.isInteger(rest)||rest<1||rest>60)return toast(t('请输入有效的间隔'));state.focus.rounds=rounds;state.focus.longRest=rest;closeDialog();return render(false);}
  if(action==='pause-timer'){const s=state.session;if(!s)return;if(s.paused)void ensureAudio().catch(audioProblem);s.elapsed=elapsed();s.anchor=Date.now();s.paused=!s.paused;return render(false);}
  if(action==='skip-timer'){const s=state.session;if(!s)return;const p=projection();if(!p)return finishSession(true);s.skipped+=p.remaining;s.elapsed=elapsed()+p.remaining;s.anchor=Date.now();return updateTimer();}
  if(action==='end-timer')return endDialog();
  if(action==='confirm-end'){closeDialog();return finishSession(false);}
  if(action==='completion-home'){closeDialog();return go('home');}
  if(action==='completion-history'){closeDialog();return go('history');}
  if(action==='close-dialog')return closeDialog();
  if(action==='add-reminder')return reminderDialog();
  if(action.startsWith('edit-'))return reminderDialog(action.slice(5));
  if(action.startsWith('enable-')){const r=state.reminders.find(r=>r.id===action.slice(7));if(r)r.enabled=!r.enabled;return render(false);}
  if(action.startsWith('day-')){syncReminderForm();const r=state.dialog.reminder,day=Number(action.slice(4));r.days=r.days.includes(day)?r.days.filter(d=>d!==day):[...r.days,day];return drawReminderDialog();}
  if(['reminder-sound','reminder-vibration','reminder-voice'].includes(action)){syncReminderForm();const r=state.dialog.reminder,key=action.slice(9);r[key]=!r[key];return drawReminderDialog();}
  if(action==='save-reminder')return saveReminder();
  if(action==='delete-reminder'){state.reminders=state.reminders.filter(r=>r.id!==state.dialog.reminder.id);closeDialog();render(false);return toast(t('提醒已删除'));}
  if(action==='preview-reminder')return previewReminder();
  if(action.startsWith('filter-')){state.filter=action.slice(7);return render(false);}
  if(action==='toggle-voice'){state.settings.voice=!state.settings.voice;return render(false);}
  if(action==='toggle-reduced'){state.settings.reduced=!state.settings.reduced;return render(false);}
  if(action==='preview-sound')return playCue('cheer3',true);
  if(action==='export'){const blob=new Blob([JSON.stringify({prototype:true,history:state.history,reminders:state.reminders},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zibloo-prototype.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
document.addEventListener('click',event=>{
  if(event.target.closest('#speed-toggle')){if(state.session){state.session.elapsed=elapsed();state.session.anchor=Date.now();}state.speed=state.speed===1?30:1;$('#speed-toggle').setAttribute('aria-pressed',String(state.speed===30));$('#speed-toggle span').textContent=state.speed===30?'30×':'关';return;}
  const navLink=event.target.closest('[data-page]');if(navLink){event.preventDefault();return go(navLink.dataset.page);}
  const button=event.target.closest('[data-action]');if(button)handleAction(button.dataset.action);
  if(event.target.classList.contains('overlay-backdrop'))closeDialog();
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='character-preview'){state.characterPreview=el.value;updateCharacter();}
  if(el.id==='language'){state.locale=el.value;clearTimeout(toastHandle);$('.toast').hidden=true;render(false);}
  if(el.id==='sound')state.settings.sound=el.value;
  if(el.id==='vibration')state.settings.vibration=el.value;
  if(el.id==='reminder-rule'){syncReminderForm();const r=state.dialog.reminder;r.rule=el.value;r.time=el.value==='at'?'':r.time.includes(':')&&r.time.length===5?r.time:'08:30';r.amount=el.value==='interval'?2:30;drawReminderDialog();}
});
document.addEventListener('keydown',event=>{
  if(!overlay.firstElementChild)return;
  if(event.key==='Escape'){event.preventDefault();return closeDialog();}
  if(event.key!=='Tab')return;
  const items=[...overlay.querySelectorAll('button,input,select,a[href]')].filter(el=>!el.disabled),first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('document-hidden',document.hidden));
reducedMotion.addEventListener('change',()=>{if(state.page==='home')render(false);});
setInterval(()=>{if(state.session&&!state.session.paused)updateTimer();},500);
render(false);
