import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../scratch/p0-v2');
const output = resolve(here, 'artifacts');
await mkdir(output, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json', '.wav':'audio/wav' };
const observations = [], errors = [];
let browser;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + '/')) { response.writeHead(403).end(); return; }
    const file = await readFile(target);
    response.writeHead(200, { 'Content-Type': (types[extname(target)] || 'application/octet-stream') + '; charset=utf-8' });
    response.end(file);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const note = message => { observations.push(message); console.log(message); };

async function capture(page, name) {
  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
}
async function open(viewport, { touch = false, clock = false, reduced = false, audioProbe = false } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'zh-CN' });
  if(audioProbe)await context.addInitScript(()=>{
    const Native=window.AudioContext;
    window.__audio={contexts:[],starts:[],buffers:[]};
    window.AudioContext=class extends Native {
      constructor(...args){
        super(...args);
        this.meter=this.createAnalyser();this.meter.fftSize=2048;
        const silent=super.createGain();silent.gain.value=0;this.meter.connect(silent);silent.connect(this.destination);
        window.__audio.contexts.push(this);
      }
      createGain(){const node=super.createGain();node.connect(this.meter);return node;}
      createOscillator(){
        const node=super.createOscillator(),start=node.start.bind(node);
        node.start=(...args)=>{window.__audio.starts.push({state:this.state,at:this.currentTime});return start(...args);};
        return node;
      }
      createBufferSource(){
        const node=super.createBufferSource(),start=node.start.bind(node);node.connect(this.meter);
        node.start=(...args)=>{
          const samples=node.buffer.getChannelData(0);let peak=0;
          for(const value of samples)peak=Math.max(peak,Math.abs(value));
          window.__audio.buffers.push({state:this.state,duration:node.buffer.duration,peak});return start(...args);
        };
        return node;
      }
    };
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  if (clock) await page.clock.install({ time: new Date('2026-10-22T14:00:00Z') });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.mascot-main .zibloo-art image').waitFor();
  return { context, page };
}
async function action(page, name) { await page.locator(`[data-action="${name}"]:visible`).click(); }
async function nav(page, name) { await page.locator(`.product-nav [data-page="${name}"]:visible`).click(); }
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
}
async function clearCaption(page, label) {
  const bounds=await page.evaluate(()=>{
    const bottom=document.querySelector('.mascot-main .zibloo-art').getBoundingClientRect().bottom;
    return {bottom,caption:document.querySelector('.character-caption').getBoundingClientRect().top};
  });
  assert.ok(bounds.bottom<=bounds.caption+1,`${label}: character overlaps caption ${JSON.stringify(bounds)}`);
}

try {
  const approved=JSON.parse(await readFile(resolve(root,'assets/approved-art.json'),'utf8'));
  for(const [name,asset] of Object.entries(approved)) {
    const hash=createHash('sha256').update(await readFile(resolve(root,'assets',asset.file))).digest('hex');
    assert.equal(hash,asset.sha256,`${name}: approved artwork source changed`);
  }
  note('Saved B2/C3 original file hashes match the approved artwork manifest.');
  const selectedSounds=JSON.parse(await readFile(resolve(root,'assets/sounds/manifest.json'),'utf8'));
  assert.deepEqual(Object.keys(selectedSounds.presets),['chirrup','breeze']);
  for(const preset of Object.values(selectedSounds.presets))for(const event of Object.values(preset.events)){
    const bytes=await readFile(resolve(root,'assets/sounds',event.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),event.sha256);
    assert.ok(bytes.equals(await readFile(resolve(root,event.source))),'Selected voice must preserve the approved audio samples');
  }
  note('Selected E/G preset files exactly match round 3 originals (10 WAV hashes).');
  browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  for (const [name, viewport] of [['desktop',{width:1280,height:900}],['tablet',{width:768,height:1024}],['phone',{width:390,height:844}],['small-phone',{width:320,height:740}]]) {
    const { context, page } = await open(viewport, { touch: viewport.width < 600 });
    await noOverflow(page, name);
    await clearCaption(page,name);
    assert.equal(await page.locator('.mode-entry:visible').count(), 3);
    const entries = await page.locator('.mode-entry:visible').all();
    const boxes = await Promise.all(entries.map(entry => entry.boundingBox()));
    for (let i=0; i<boxes.length; i++) for (let j=i+1; j<boxes.length; j++) {
      const a=boxes[i], b=boxes[j];
      assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y, `${name}: mode targets overlap`);
    }
    await capture(page, name + '-home');
    note(`${name}: home fits width; three distinct mode targets visible`);
    await context.close();
  }

  {
    const { context, page } = await open({width:1280,height:900});
    const art = page.locator('.mascot-main .zibloo-art');
    assert.equal(await art.getAttribute('data-source'),'approved-B2');
    assert.equal(await art.getAttribute('viewBox'),'470 25 800 735');
    assert.equal(await art.locator('image').getAttribute('href'),'assets/reference-B2.png');
    assert.equal(await art.locator('image').count(),1,'Character should display a single unchanged B2 image');
    assert.equal(await art.locator('path').count(),0,'Character must display the approved original, not a redraw');
    assert.ok(await page.locator('[data-source="approved-C3"]').count()>0);
    assert.equal(await page.locator('[data-source="approved-C3"]').first().getAttribute('viewBox'),'180 70 1400 470');
    assert.equal(await page.locator('[data-source="approved-C3"]').first().locator('image').getAttribute('href'),'assets/reference-C3.png');
    const transform=()=>art.evaluate(node=>getComputedStyle(node).transform);
    const stage=page.locator('.mascot-main .live-zibloo');
    assert.equal(await page.locator('canvas').count(),0,'The 2D prototype should not create a WebGL canvas');
    const first = await transform();
    await page.waitForTimeout(550);
    assert.notEqual(await transform(), first, 'The approved B2 character should drift gently');
    const relaxed=await stage.evaluate(node=>getComputedStyle(node).transform);
    await stage.dispatchEvent('pointerdown',{pointerType:'mouse'});
    await page.waitForTimeout(250);
    assert.notEqual(await stage.evaluate(node=>getComputedStyle(node).transform),relaxed,'Press should give gentle 2D feedback');
    await stage.dispatchEvent('pointerleave',{pointerType:'mouse'});
    await page.waitForTimeout(250);
    assert.equal(await stage.evaluate(node=>getComputedStyle(node).transform),relaxed,'Cancelled press should reset feedback');
    await page.selectOption('#character-preview', 'focus');
    const quiet = await transform();
    await page.waitForTimeout(450);
    assert.equal(await transform(), quiet, 'Focus should stay quiet');
    await page.selectOption('#character-preview', 'auto');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#character-state-label')?.textContent.includes('已减少动态效果'));
    const still = await transform();
    await page.waitForTimeout(450);
    assert.equal(await transform(), still, 'System reduced motion should stop drifting');
    await clearCaption(page,'system reduced motion');
    await capture(page, 'reduced-motion-home');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForFunction(()=>document.querySelector('#character-state-label')?.textContent.includes('自在悬游'));
    await page.keyboard.press('Tab');
    await page.locator('.mascot-main').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('status').getByText('你好呀，我是 Zibloo！').waitFor();
    await capture(page, 'keyboard-greeting');
    note('Approved B2/C3 originals display without redraw; 2D drift, quiet focus, press cancellation, reduced motion, and keyboard greeting work.');
    await context.close();
  }

  for (const [name,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}],['small-phone',{width:320,height:740}]]) {
    const {context,page}=await open(viewport,{touch:viewport.width<600});
    const mover=page.locator('.mascot-main');
    const area=page.locator('.swim-area');
    const position=()=>mover.evaluate(el=>getComputedStyle(el).translate);
    const home=await position();
    // Hit the water near the stage edge, away from the character and mode buttons.
    const water=await area.boundingBox();
    const left={x:water.x+4,y:water.y+4},right={x:water.x+water.width-4,y:water.y+4};
    if(viewport.width<600)await page.touchscreen.tap(left.x,left.y);
    else await page.mouse.click(left.x,left.y);
    await page.waitForTimeout(70);
    const during=await position();
    assert.notEqual(during,home,`${name}: pointing at water should move the character`);
    await page.mouse.click(right.x,right.y);
    const retargeted=await position();
    const coords=value=>value.split(' ').map(parseFloat);
    assert.ok(Math.abs(coords(during)[0]-coords(retargeted)[0])<12,`${name}: changing destination should not jump to the old endpoint`);
    await page.waitForFunction(()=>!document.querySelector('.mascot-main').classList.contains('is-swimming'));
    await clearCaption(page,`${name} after swimming`);
    await noOverflow(page,`${name} after swimming`);
    const bounds=await mover.boundingBox(),scene=await page.locator('.home-stage').boundingBox();
    assert.ok(bounds.x>=scene.x&&bounds.x+bounds.width<=scene.x+scene.width+1,`${name}: swimming should stay inside the stage`);
    await page.locator('.swim-reset').click();
    await page.waitForFunction(()=>!document.querySelector('.mascot-main').classList.contains('is-swimming'));
    assert.equal(await position(),home,`${name}: recenter should return to the initial position`);
    await mover.focus();
    await page.keyboard.press('ArrowLeft');
    assert.notEqual(await position(),home,`${name}: keyboard movement should work`);
    await page.keyboard.press('Home');
    assert.equal(await position(),home,`${name}: keyboard Home should recenter`);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#character-state-label')?.textContent.includes('已减少动态效果'));
    await area.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await mover.evaluate(el=>el.classList.contains('is-swimming')),false);
    assert.equal(await mover.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    await clearCaption(page,`${name} reduced-motion movement`);
    await capture(page,`${name}-2d-swimming`);
    await nav(page,'settings');
    await nav(page,'home');
    await clearCaption(page,`${name} return home`);
    note(`${name}: pointer/touch swimming, interruption, bounds, recenter, arrows, reduced motion, and scene remount work.`);
    await context.close();
  }

  {
    const { context, page } = await open({width:390,height:844},{touch:true});
    await page.locator('.mascot-main').tap();
    await page.getByRole('status').waitFor();
    await page.click('#speed-toggle');
    await action(page, 'quick-1');
    await page.waitForTimeout(250);
    await action(page, 'pause-timer');
    const paused = await page.locator('.time-display').textContent();
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.time-display').textContent(), paused);
    await capture(page, 'phone-timer-paused');
    await action(page, 'pause-timer');
    await page.getByRole('dialog').waitFor({timeout:5000});
    await capture(page, 'phone-completion');
    await action(page, 'completion-history');
    assert.ok(await page.locator('.history-item').first().textContent().then(text=>text.includes('快捷计时')));
    await capture(page, 'phone-history');
    await nav(page, 'home');
    await action(page, 'go-training');
    await capture(page, 'phone-training-setup');
    await action(page, 'start-training');
    await page.waitForFunction(()=>document.querySelector('#phase-label')?.textContent.includes('休息一下'),{},{timeout:5000});
    await capture(page, 'phone-training-rest');
    await action(page, 'skip-timer');
    assert.ok((await page.locator('#phase-label').textContent()).includes('运动中'));
    await action(page, 'end-timer');
    await action(page, 'confirm-end');
    await nav(page, 'history');
    assert.ok((await page.locator('.history-item').first().textContent()).includes('提前结束'));
    note('Touch flow: greeting, quick timer, pause/resume, completion/history, training phase change, skip, early end');
    await context.close();
  }

  {
    const { context, page } = await open({width:390,height:844},{touch:true,clock:true});
    await action(page, 'go-focus');
    await action(page, 'focus-work-15');
    await action(page, 'focus-rest-3');
    await action(page, 'custom-tag');
    await page.fill('#custom-tag','写作 <慢慢来>');
    await action(page, 'save-tag');
    await action(page, 'focus-options');
    await page.fill('#focus-rounds','2');
    await page.fill('#focus-long','10');
    await action(page, 'save-focus');
    await capture(page, 'phone-focus-setup');
    await action(page, 'start-focus');
    await capture(page, 'phone-focus-running');
    await page.clock.fastForward(15*60*1000);
    assert.ok((await page.locator('#phase-label').textContent()).includes('休息一下'));
    await capture(page, 'phone-focus-short-break');
    await page.clock.fastForward(3*60*1000);
    assert.ok((await page.locator('#phase-label').textContent()).includes('专注时间'));
    await page.clock.fastForward(15*60*1000);
    assert.ok((await page.locator('#phase-label').textContent()).includes('长休息'));
    await capture(page, 'phone-focus-long-break');
    await page.clock.fastForward(10*60*1000);
    await page.getByRole('dialog').waitFor();
    note('Focus flow: escaped custom tag, two focus rounds, short break, long break, complete (browser clock advanced)');
    await context.close();
  }

  {
    const { context, page } = await open({width:390,height:844},{touch:true});
    await action(page, 'go-reminders');
    await action(page, 'add-reminder');
    await page.fill('#reminder-name','散步');
    await page.selectOption('#reminder-rule','weekly');
    await page.fill('#reminder-time','19:30');
    await action(page, 'day-3');
    await action(page, 'reminder-voice');
    assert.equal(await page.inputValue('#reminder-name'),'散步');
    assert.equal(await page.inputValue('#reminder-time'),'19:30');
    await capture(page, 'phone-weekly-reminder');
    await action(page, 'save-reminder');
    const row = page.locator('.reminder-card').filter({hasText:'散步'});
    assert.ok((await row.textContent()).includes('19:30'));
    await row.getByRole('switch').click();
    assert.equal(await row.getByRole('switch').getAttribute('aria-checked'),'false');
    await row.locator('.reminder-detail').click();
    await page.fill('#reminder-name','散步一下');
    await action(page, 'save-reminder');
    await page.locator('.reminder-card').filter({hasText:'散步一下'}).locator('.reminder-detail').click();
    await action(page, 'delete-reminder');
    assert.equal(await page.locator('.reminder-card').filter({hasText:'散步一下'}).count(),0);
    await action(page, 'preview-reminder');
    await capture(page, 'phone-reminder-call');
    await page.keyboard.press('Escape');
    await nav(page, 'settings');
    await action(page, 'toggle-reduced');
    await page.selectOption('#language','en');
    await capture(page, 'phone-settings-english');
    await nav(page, 'home');
    assert.ok((await page.locator('h1').textContent()).includes('What shall we do together'));
    const art = page.locator('.mascot-main .zibloo-art');
    const still = await art.evaluate(node=>getComputedStyle(node).transform);
    await page.waitForTimeout(450);
    assert.equal(await art.evaluate(node=>getComputedStyle(node).transform),still);
    await clearCaption(page,'English app reduced motion');
    await capture(page, 'phone-home-english');
    note('Reminders: weekly form survives redraw, create/edit/disable/delete/preview; English and app reduced motion work');
    await context.close();
  }
  // Actual browser audio processing, with default autoplay policy (no bypass flags).
  {
    const {context,page}=await open({width:390,height:844},{touch:true,clock:true,audioProbe:true});
    await action(page,'quick-1');
    await page.waitForFunction(()=>window.__audio.contexts[0]?.state==='running');
    assert.equal(await page.evaluate(()=>window.__audio.buffers.length),0,'Quick start should unlock without a cue');
    await page.clock.fastForward(61000);
    await page.waitForFunction(()=>window.__audio.buffers.length===1);
    let peak=0;
    for(let i=0;i<8;i++){
      await page.waitForTimeout(40);
      peak=Math.max(peak,await page.evaluate(()=>{
        const ctx=window.__audio.contexts[0],data=new Float32Array(2048);ctx.meter.getFloatTimeDomainData(data);
        return Math.max(...data.map(Math.abs));
      }));
    }
    assert.ok(peak>.005,`Completion must output a nonzero signal, got ${peak}`);
    assert.ok(await page.evaluate(()=>window.__audio.buffers.every(s=>s.state==='running')));
    await action(page,'completion-home');
    await action(page,'go-training');await action(page,'guidance-off');
    await action(page,'home');await action(page,'go-focus');await action(page,'start-focus');
    await page.waitForFunction(()=>window.__audio.buffers.length===2);
    const before=await page.evaluate(()=>window.__audio.buffers.length);
    await page.clock.fastForward(25*60000+1000);
    await page.waitForFunction(n=>window.__audio.buffers.length===n+1,before);
    assert.ok((await page.locator('#phase-label').textContent()).includes('休息'));
    await page.clock.fastForward(5*60000);
    await page.waitForFunction(n=>window.__audio.buffers.length===n+2,before);
    await action(page,'end-timer');await action(page,'confirm-end');
    await action(page,'go-training');await action(page,'start-training');
    const silentPhases=await page.evaluate(()=>window.__audio.buffers.length);
    await page.clock.fastForward(30*1000+1000);
    assert.equal(await page.evaluate(()=>window.__audio.buffers.length),silentPhases,'Training guide off suppresses phases');
    await page.clock.fastForward(400*1000);
    await page.waitForFunction(n=>window.__audio.buffers.length===n+1,silentPhases);
    await action(page,'completion-home');await nav(page,'settings');await page.selectOption('#sound','silent');
    await nav(page,'home');await action(page,'quick-1');
    const muted=await page.evaluate(()=>window.__audio.buffers.length);
    await page.clock.fastForward(61000);
    assert.equal(await page.evaluate(()=>window.__audio.buffers.length),muted,'Global mute suppresses completion');
    note(`Audio: quick Start unlocks audio; completion outputs signal (peak ${peak.toFixed(4)}); focus work/rest survives training guide off; guide off still permits training completion; global mute works.`);
    await context.close();
  }
  {
    const context=await browser.newContext({viewport:{width:1280,height:900},locale:'zh-CN'});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url+'/sound-lab/index.html');await page.locator('.sound-card').last().waitFor();
    assert.equal(await page.locator('.sound-card').count(),8);
    const files=await page.evaluate(async()=>{
      const manifest=await (await fetch('manifest.json')).json(),decoder=new OfflineAudioContext(1,44100,44100),results=[];
      for(const style of manifest.styles)for(const file of [...Object.values(style.clips),style.sequence]){
        const response=await fetch(file);if(!response.ok)throw new Error(file+' unavailable');
        const buffer=await decoder.decodeAudioData(await response.arrayBuffer()),samples=buffer.getChannelData(0);
        let peak=0,energy=0;for(const value of samples){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
        results.push({file,seconds:buffer.duration,peak,rms:Math.sqrt(energy/samples.length)});
      }
      return results;
    });
    assert.equal(files.length,40);
    for(const file of files){assert.ok(file.peak>.05&&file.peak<.75,JSON.stringify(file));assert.ok(file.rms>.02,JSON.stringify(file));}
    await writeFile(resolve(output,'sound-files.json'),JSON.stringify(files,null,2));
    await page.locator('[data-style="bubble"][data-event="complete"]').click();
    await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0);
    await page.locator('[data-style="wood"][data-event="rest"]').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.endsWith('wood-rest.wav')&&!document.querySelector('audio').paused);
    await page.locator('[data-favorite="bubble"]').click();await page.reload();
    await page.locator('[data-favorite="bubble"][aria-pressed="true"]').waitFor();
    await page.selectOption('#event-select','work');await page.locator('#compare-all').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.endsWith('murmur-work.wav')&&!document.querySelector('audio').paused);
    await page.locator('#stop').click();
    assert.ok(await page.locator('audio').evaluate(el=>el.paused));
    await page.waitForTimeout(1700);
    assert.ok(await page.locator('audio').evaluate(el=>el.paused),'Stop must cancel the remaining comparison queue');
    for(const [name,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}],['small-phone',{width:320,height:740}]]){
      await page.setViewportSize(viewport);await noOverflow(page,'sound-lab '+name);await capture(page,'sound-lab-'+name);
    }
    note('Sound lab: 8 styles × 4 events plus 8 sequences decode with nonzero unclipped signal; playback, switching, comparison queue, Stop, persisted shortlist and three responsive widths passed. Timbre/emotion still need human listening.');
    await context.close();
  }
  {
    const context=await browser.newContext({viewport:{width:1280,height:900},locale:'zh-CN'});
    await context.grantPermissions(['clipboard-read','clipboard-write']);
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url+'/sound-lab/index.html');
    const previous=['murmur','glass','wood','orbit','air','pluck','pulse'];
    await page.evaluate(previous=>localStorage.setItem('zibloo-sound-shortlist',JSON.stringify(previous)),previous);
    await page.goto(url+'/sound-lab/voice-round2/index.html');
    await page.locator('.voice-card').last().waitFor();
    assert.equal(await page.locator('.voice-card').count(),3);
    assert.equal(await page.locator('.portrait img').getAttribute('src'),'../../assets/zibloo-character.svg');
    const files=await page.evaluate(async()=>{
      const m=await(await fetch('manifest.json')).json(),decoder=new OfflineAudioContext(1,44100,44100);
      const files=[...m.voices.flatMap(v=>[...Object.values(v.clips),v.sequence]),m.comparison,...m.textures.map(t=>t.file)],results=[];
      for(const file of files){
        const response=await fetch(file);if(!response.ok)throw new Error(file+' unavailable');
        const buffer=await decoder.decodeAudioData(await response.arrayBuffer()),samples=buffer.getChannelData(0);
        let peak=0,energy=0;for(const value of samples){if(!Number.isFinite(value))throw new Error(file+' invalid samples');peak=Math.max(peak,Math.abs(value));energy+=value*value;}
        results.push({file,seconds:buffer.duration,peak,rms:Math.sqrt(energy/samples.length),endPeak:Math.max(...samples.slice(-128).map(Math.abs))});
      }
      return results;
    });
    assert.equal(files.length,26);
    for(const file of files){assert.ok(file.peak>.05&&file.peak<.7,JSON.stringify(file));assert.ok(file.rms>.02,JSON.stringify(file));assert.ok(file.endPeak<.001,JSON.stringify(file));}
    await writeFile(resolve(output,'name-voice-files.json'),JSON.stringify(files,null,2));
    await page.locator('[data-voice="clear"][data-event="greet"]').click();
    await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0);
    await page.locator('[data-voice="creature"][data-event="rest"]').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.endsWith('creature-rest.wav')&&!document.querySelector('audio').paused);
    await page.selectOption('#event-select','greet');await page.locator('#compare-all').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.endsWith('creature-greet.wav')&&!document.querySelector('audio').paused);
    await page.locator('#stop').click();await page.waitForTimeout(1800);
    assert.ok(await page.locator('audio').evaluate(el=>el.paused),'Stop cancels queued name calls');
    await page.locator('#compare-names').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.endsWith('compare-three.wav')&&!document.querySelector('audio').paused);
    await page.locator('#stop').click();
    await page.locator('[data-favorite="creature"]').click();
    await page.locator('#texture-section summary').click();await page.locator('[data-texture-choice="wood"]').check();
    await page.reload();await page.locator('[data-favorite="creature"][aria-pressed="true"]').waitFor();
    await page.locator('#texture-section summary').click();
    assert.ok(await page.locator('[data-texture-choice="wood"]').isChecked());
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('zibloo-sound-shortlist'))),previous,'Round 1 shortlist must survive');
    await page.locator('[data-texture="wood"]').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.endsWith('texture-wood.wav')&&!document.querySelector('audio').paused);
    assert.ok(await page.locator('#now-title').textContent().then(text=>text.includes('B + 04')));
    await page.locator('#stop').click();await page.locator('#copy-choice').click();
    const copied=await page.evaluate(()=>navigator.clipboard.readText());
    assert.ok(copied.includes('B 隐约像名字')&&copied.includes('04 海岸木音'),copied);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-voice="motif"][data-event="greet"]').click();
    await page.waitForFunction(()=>document.querySelector('.portrait').classList.contains('speaking'));
    assert.equal(await page.locator('.portrait img').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.locator('#stop').click();
    for(const [name,viewport] of [['desktop',{width:1280,height:900}],['tablet',{width:768,height:1024}],['phone',{width:390,height:844}],['small-phone',{width:320,height:740}]]){
      await page.setViewportSize(viewport);await page.evaluate(()=>window.scrollTo(0,0));
      await noOverflow(page,'name-voice '+name);
      const clipped=await page.locator('main button:visible').evaluateAll(buttons=>buttons.filter(el=>{const box=el.getBoundingClientRect();return box.left<0||box.right>innerWidth+1;}).map(el=>el.textContent));
      assert.deepEqual(clipped,[],name+': buttons must fit horizontally');
      await capture(page,'name-voice-'+name);
    }
    note('Name voice round 2: 3 articulation choices × 5 calls, 3 four-event sequences, A/B/C comparison and 7 shortlisted timbres (26 WAVs) decode with signal and quiet endings; playback/switching/queued Stop, texture auditions, independent persisted shortlist, copied selections, approved art reference, reduced motion and four widths passed. Name intelligibility and emotional quality require human listening.');
    await context.close();
  }
  {
    const {context,page}=await open({width:390,height:844},{touch:true,clock:true,audioProbe:true});
    await page.goto(url+'/sound-lab/voice-round3/index.html');await page.locator('.sound-card').last().waitFor();
    assert.equal(await page.locator('.sound-card').count(),4);
    const files=await page.evaluate(async()=>{
      const m=await(await fetch('manifest.json')).json(),decoder=new OfflineAudioContext(1,44100,44100),results=[];
      for(const file of [...m.styles.flatMap(s=>[s.greeting,...Object.values(s.clips),s.sequence]),m.comparison]){
        const response=await fetch(file);if(!response.ok)throw new Error(file+' unavailable');
        const b=await decoder.decodeAudioData(await response.arrayBuffer()),samples=b.getChannelData(0);
        let peak=0,energy=0;for(const v of samples){assertFinite(v);peak=Math.max(peak,Math.abs(v));energy+=v*v;}
        results.push({file,seconds:b.duration,peak,rms:Math.sqrt(energy/samples.length)});
      }
      function assertFinite(v){if(!Number.isFinite(v))throw new Error('Invalid audio sample');}
      return results;
    });
    assert.equal(files.length,25);
    for(const file of files){assert.ok(file.peak>.05&&file.peak<.7,JSON.stringify(file));assert.ok(file.rms>.02,JSON.stringify(file));}
    await writeFile(resolve(output,'temporary-voice-files.json'),JSON.stringify(files,null,2));
    await page.locator('[data-style="coo"][data-event="greet"]').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentTime>0&&!document.querySelector('audio').paused);
    await page.locator('#compare-all').click();
    await page.waitForFunction(()=>document.querySelector('audio').currentSrc.endsWith('chirrup-greet.wav')&&!document.querySelector('audio').paused);
    await page.locator('#stop').click();await page.waitForTimeout(1700);
    assert.ok(await page.locator('audio').evaluate(el=>el.paused));
    await page.locator('[data-favorite="coo"]').click();await page.reload();
    await page.locator('[data-favorite="coo"][aria-pressed="true"]').waitFor();
    for(const [name,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}],['small-phone',{width:320,height:740}]]){
      await page.setViewportSize(viewport);await noOverflow(page,'temporary voice '+name);await capture(page,'temporary-voice-'+name);
    }
    await page.locator('#style-chirrup .use-voice').click();
    await page.locator('#sound').waitFor();assert.equal(await page.inputValue('#sound'),'chirrup');
    assert.ok(!page.url().includes('voice='),'Apply URL must be consumed so future setting changes survive reload');
    await action(page,'preview-cue-cheer3');await page.waitForFunction(()=>window.__audio.buffers.length===1);
    await nav(page,'home');await action(page,'quick-1');
    await page.clock.fastForward(61000);await page.waitForFunction(()=>window.__audio.buffers.length===2);
    await action(page,'completion-home');await action(page,'go-training');await action(page,'start-training');
    await page.waitForFunction(()=>window.__audio.buffers.length===3);
    await page.clock.fastForward(31000);await page.waitForFunction(()=>window.__audio.buffers.length===4);
    const expected=file=>files.find(f=>f.file===file).seconds;
    const played=await page.evaluate(()=>window.__audio.buffers);
    assert.ok(Math.abs(played[2].duration-expected('audio/chirrup-work.wav'))<.001);
    assert.ok(Math.abs(played[3].duration-expected('audio/chirrup-rest.wav'))<.001);
    assert.ok(played.every(b=>b.state==='running'&&b.peak>.05));
    await action(page,'end-timer');await action(page,'confirm-end');await nav(page,'settings');
    await page.selectOption('#sound','silent');await page.reload();await nav(page,'settings');
    assert.equal(await page.inputValue('#sound'),'silent','Explicit mute survives reload after apply URL');
    await nav(page,'home');await action(page,'quick-1');await page.clock.fastForward(61000);
    assert.equal(await page.evaluate(()=>window.__audio.buffers.length),0,'Mute prevents decoded voice playback');
    await action(page,'completion-home');await nav(page,'settings');
    for(const voice of ['chirrup','breeze']){
      await page.selectOption('#sound',voice);const count=await page.evaluate(()=>window.__audio.buffers.length);
      await action(page,'preview-cue-cheer3');await page.waitForFunction(n=>window.__audio.buffers.length===n+1,count);
    }
    assert.deepEqual(await page.locator('#sound option').evaluateAll(options=>options.map(o=>o.value)),['chirrup','breeze','silent']);
    await capture(page,'selected-voice-settings');
    await page.reload();await nav(page,'settings');
    // A slow asset response must not speak after the user changes to mute.
    await page.route('**/assets/sounds/chirrup/*.wav',async route=>{await new Promise(resolve=>setTimeout(resolve,350));await route.continue();});
    await page.selectOption('#sound','chirrup');const beforeMutedLoad=await page.evaluate(()=>window.__audio.buffers.length);
    await action(page,'preview-cue-cheer3');await page.selectOption('#sound','silent');await page.waitForTimeout(700);
    assert.equal(await page.evaluate(()=>window.__audio.buffers.length),beforeMutedLoad,'Pending voice is canceled by mute');
    note('Selected round 3: 25 WAVs decode with nonzero unclipped signal; historical four-style playback/queue/Stop/shortlist and three widths pass. Apply-to-timer works; work/rest/complete play the mapped buffers in running AudioContext; both selected presets preview; preference and mute survive reload; slow pending voice is canceled by mute. Subjective emotion and timbre require user listening.');
    await context.close();
  }
  {
    const {context,page}=await open({width:390,height:844},{touch:true,audioProbe:true});
    await nav(page,'settings');assert.equal(await page.inputValue('#sound'),'chirrup','New visits default to E');
    const manifest=JSON.parse(await readFile(resolve(root,'assets/sounds/manifest.json'),'utf8'));
    const expected=await page.evaluate(async manifest=>{
      const decoder=new OfflineAudioContext(1,44100,44100),durations={};
      for(const [id,preset]of Object.entries(manifest.presets))for(const [event,asset]of Object.entries(preset.events)){
        const response=await fetch('assets/sounds/'+asset.file);const buffer=await decoder.decodeAudioData(await response.arrayBuffer());
        durations[id+'/'+event]=buffer.duration;
      }
      return durations;
    },manifest);
    for(const id of ['chirrup','breeze']){
      await page.selectOption('#sound',id);
      for(const [cue,event]of [['hello','greet'],['rise2','work'],['fall2','rest'],['cheer3','complete'],['call','reminder']]){
        const before=await page.evaluate(()=>window.__audio.buffers.length);
        await action(page,'preview-cue-'+cue);await page.waitForFunction(n=>window.__audio.buffers.length===n+1,before);
        const actual=await page.evaluate(()=>window.__audio.buffers.at(-1));
        assert.ok(Math.abs(actual.duration-expected[id+'/'+event])<.001,id+'/'+event+' maps to the selected clip');
        assert.equal(actual.state,'running');assert.ok(actual.peak>.05);
      }
    }
    await page.reload();await nav(page,'settings');assert.equal(await page.inputValue('#sound'),'breeze','G choice survives reload');
    await action(page,'preview-cue-hello');await page.waitForFunction(()=>window.__audio.buffers.length===1);
    await nav(page,'home');await action(page,'hello');await page.waitForFunction(()=>window.__audio.buffers.length===2);
    assert.ok(Math.abs((await page.evaluate(()=>window.__audio.buffers.at(-1).duration))-expected['breeze/greet'])<.001);
    await action(page,'go-reminders');await action(page,'preview-reminder');await page.waitForFunction(()=>window.__audio.buffers.length===3);
    assert.ok(Math.abs((await page.evaluate(()=>window.__audio.buffers.at(-1).duration))-expected['breeze/reminder'])<.001);
    await page.keyboard.press('Escape');await nav(page,'settings');await page.selectOption('#language','en');
    assert.ok((await page.locator('#voice-description').textContent()).includes('Airy'));
    await noOverflow(page,'selected voices phone settings');await capture(page,'selected-voices-phone-en');
    await page.setViewportSize({width:320,height:740});await page.selectOption('#language','zh-CN');
    await noOverflow(page,'selected voices 320 settings');await capture(page,'selected-voices-small-phone');
    await page.setViewportSize({width:1280,height:900});await capture(page,'selected-voices-desktop');
    assert.equal(await page.evaluate(()=>window.__audio.starts.length),0,'Chosen presets must not invoke the old oscillator cues');
    await context.close();
  }
  for(const [stored,expected]of [['temp-chirrup','chirrup'],['temp-breeze','breeze'],['silent','silent'],['temp-coo','chirrup'],['temp-hum','chirrup'],['zibloo','chirrup']]){
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(value=>localStorage.setItem('zibloo-prototype-sound',value),stored);
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url+'/#settings');await page.locator('#sound').waitFor();
    assert.equal(await page.inputValue('#sound'),expected,'Migrating '+stored);
    await context.close();
  }
  note('Selected presets: default E, all 10 scene previews map to original files, G persists, greeting/reminder use G, Chinese/English settings fit 1280/390/320 widths, no old oscillator playback, old preferences migrate and explicit mute is preserved.');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  note('No browser runtime errors observed.');
} catch (error) {
  note(`FAILED: ${error.stack}`);
  if(browser) for(const context of browser.contexts()) for(const page of context.pages()) {
    await capture(page, 'failure').catch(()=>{});
  }
  process.exitCode=1;
} finally {
  await writeFile(resolve(output,'observations.json'),JSON.stringify({observations,errors},null,2));
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
