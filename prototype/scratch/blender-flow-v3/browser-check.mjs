import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const server=spawn('python3',['-m','http.server','4326','--bind','127.0.0.1','--directory','output'],{stdio:'ignore'});
let browser;
try {
  browser=await chromium.launch({headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1100,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4326/');
  await page.waitForFunction(()=>window.modelStudy?.clips.length===4,undefined,{timeout:60000});
  await page.locator('#motion').uncheck();
  const observations=await page.evaluate(()=>{
    const {model,mixer,clips}=window.modelStudy;
    const skins=[];model.traverse(obj=>{if(obj.isSkinnedMesh)skins.push(obj);});
    const body=skins.find(obj=>obj.geometry.attributes.position.count>5000);
    if(!body)throw Error('Missing skinned quad body');
    const sample=(clip,time)=>{
      mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().play();mixer.setTime(time);
      model.updateMatrixWorld(true);body.skeleton.update();
      const result=[];
      for(let i=0;i<body.geometry.attributes.position.count;i+=53){
        const point=body.position.clone().fromBufferAttribute(body.geometry.attributes.position,i);
        body.applyBoneTransform(i,point);result.push(point.toArray());
      }
      return result;
    };
    const result=clips.map(clip=>{
      const start=sample(clip,0),middle=sample(clip,clip.duration*.42),end=sample(clip,clip.duration-.00001);
      const distance=(a,b)=>Math.max(...a.map((p,i)=>Math.hypot(...p.map((n,j)=>n-b[i][j]))));
      return {name:clip.name,duration:clip.duration,movement:distance(start,middle),loop_gap:distance(start,end),
              finite:middle.every(p=>p.every(Number.isFinite))};
    });
    window.modelStudy.select('Idle',0);
    return {clips:result,skins:skins.length,body_vertices:body.geometry.attributes.position.count,
      color_0:!!body.geometry.attributes.color,bones:body.skeleton.bones.length};
  });
  assert.equal(observations.clips.length,4);assert(observations.color_0);
  for(const clip of observations.clips){assert(clip.finite);assert(clip.movement>.015,JSON.stringify(clip));assert(clip.loop_gap<.025,JSON.stringify(clip));}
  for(const name of ['Idle','Greeting','Focus','Celebrate']){
    await page.locator(`[data-clip="${name}"]`).click();
    await page.waitForTimeout(400);
    await page.screenshot({path:`output/browser-${name.toLowerCase()}.png`});
    assert.equal(await page.locator(`[data-clip="${name}"]`).getAttribute('aria-pressed'),'true');
  }
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'output/browser-mobile.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#motion').isChecked(),false);
  assert.deepEqual(errors,[]);
  await writeFile('output/browser-inspection.json',JSON.stringify(observations,null,2)+'\n');
  console.log(JSON.stringify(observations,null,2));
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
