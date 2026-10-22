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
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
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
async function open(viewport, { touch = false, clock = false, reduced = false } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'zh-CN' });
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
    assert.equal(await art.locator('path').count(),0,'Character must display the approved original, not a redraw');
    assert.ok(await page.locator('[data-source="approved-C3"]').count()>0);
    assert.equal(await page.locator('[data-source="approved-C3"]').first().getAttribute('viewBox'),'180 70 1400 470');
    assert.equal(await page.locator('[data-source="approved-C3"]').first().locator('image').getAttribute('href'),'assets/reference-C3.png');
    const transform=()=>art.evaluate(node=>getComputedStyle(node).transform);
    const first = await transform();
    await page.waitForTimeout(550);
    assert.notEqual(await transform(), first, 'The approved character should drift gently');
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
    note('Approved B2 source displayed without redraw; C3 original logo displayed; gentle drift stops during focus/reduced motion; keyboard greeting works. Independent arm animation is deferred.');
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
