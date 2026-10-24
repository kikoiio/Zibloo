import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const server=spawn('python3',['-m','http.server','4326','--bind','127.0.0.1','--directory','output'],{stdio:'ignore'});
let browser;
try {
  browser=await chromium.launch({headless:true,channel:existsSync('/opt/google/chrome/chrome')?'chrome':undefined,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1100,height:1000},reducedMotion:'reduce'});
  page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  console.log('Loading standalone review page');
  await page.goto('http://127.0.0.1:4326/');
  await page.waitForFunction(()=>window.modelStudy?.clips.length===4,undefined,{timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('#motion').uncheck();
  const landmarks=JSON.parse(await readFile('output/blender-landmarks.json','utf8'));
  const parity=await page.evaluate(async reference=>{
    const {model,mixer,clips}=window.modelStudy;
    let body;model.traverse(obj=>{if(obj.isSkinnedMesh&&obj.geometry.attributes.position.count>5000)body=obj;});
    const source=await window.modelStudy.loadReference();
    let sourceBody;source.scene.traverse(obj=>{if(obj.isSkinnedMesh&&obj.geometry.attributes.position.count>5000)sourceBody=obj;});
    const boneName=body.skeleton.bones[0].name;
    const sourceBone=sourceBody.skeleton.bones.findIndex(bone=>bone.name===boneName);
    // Position quantization is folded into inverse-bind matrices for skins.
    // Recover that decoding transform before matching original rest points.
    const decode=sourceBody.skeleton.boneInverses[sourceBone].clone().invert().multiply(body.skeleton.boneInverses[0]);
    model.updateMatrixWorld(true);
    const positions=body.geometry.attributes.position;
    const mapping=reference.rest.map(point=>{
      let nearest=0,distance=Infinity;
      for(let i=0;i<positions.count;i++){
        const p=body.position.clone().fromBufferAttribute(positions,i).applyMatrix4(decode);
        const d=Math.hypot(...p.toArray().map((n,j)=>n-point[j]));
        if(d<distance){nearest=i;distance=d;}
      }
      return {index:nearest,error:distance};
    });
    const result={rest_match_max_error:Math.max(...mapping.map(p=>p.error)),clips:{}};
    for(const [name,expected] of Object.entries(reference.clips)){
      mixer.stopAllAction();mixer.clipAction(clips.find(c=>c.name===name)).reset().play();
      mixer.setTime(expected.time);model.updateMatrixWorld(true);body.skeleton.update();
      const distances=mapping.map(({index},j)=>{
        const p=body.position.clone().fromBufferAttribute(positions,index);
        body.applyBoneTransform(index,p);p.applyMatrix4(body.matrixWorld);
        return Math.hypot(...p.toArray().map((n,k)=>n-expected.points[j][k]));
      });
      result.clips[name]={max_error:Math.max(...distances),mean_error:distances.reduce((a,b)=>a+b)/distances.length};
    }
    window.modelStudy.select('Idle',0);
    return result;
  },landmarks);
  await writeFile('output/deformation-parity.json',JSON.stringify(parity,null,2)+'\n');
  assert(parity.rest_match_max_error<.005,JSON.stringify(parity));
  for(const result of Object.values(parity.clips))assert(result.max_error<.02,JSON.stringify(parity));
  console.log('Checking exported skins and animation loops');
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
        body.applyBoneTransform(i,point);point.applyMatrix4(body.matrixWorld);result.push(point.toArray());
      }
      return result;
    };
    window.expectedStudyPoses={};
    const result=clips.map(clip=>{
      const start=sample(clip,0),middle=sample(clip,clip.duration*.42),end=sample(clip,clip.duration-.00001);
      window.expectedStudyPoses[clip.name]=middle;
      const distance=(a,b)=>Math.max(...a.map((p,i)=>Math.hypot(...p.map((n,j)=>n-b[i][j]))));
      return {name:clip.name,duration:clip.duration,movement:distance(start,middle),loop_gap:distance(start,end),
              finite:middle.every(p=>p.every(Number.isFinite))};
    });
    window.modelStudy.select('Idle',0);
    return {clips:result,skins:skins.length,body_vertices:body.geometry.attributes.position.count,
      color_0:!!body.geometry.attributes.color,bones:body.skeleton.bones.length};
  });
  assert.equal(observations.clips.length,4);assert(observations.color_0);
  assert.equal(observations.bones,75,'Unexpected joint added for unweighted vertices');
  for(const clip of observations.clips){assert(clip.finite);assert(clip.movement>.015,JSON.stringify(clip));assert(clip.loop_gap<.025,JSON.stringify(clip));}
  observations.frozen_pose_max_error={};
  for(const name of ['Idle','Greeting','Focus','Celebrate']){
    console.log('Checking and capturing',name);
    await page.locator(`[data-clip="${name}"]`).click();
    await page.waitForTimeout(400);
    await page.screenshot({path:`output/browser-${name.toLowerCase()}.png`,timeout:15000});
    assert.equal(await page.locator(`[data-clip="${name}"]`).getAttribute('aria-pressed'),'true');
    const error=await page.evaluate(name=>{
      const {model}=window.modelStudy;model.updateMatrixWorld(true);
      let body;model.traverse(obj=>{if(obj.isSkinnedMesh&&obj.geometry.attributes.position.count>5000)body=obj;});
      body.skeleton.update();const actual=[];
      for(let i=0;i<body.geometry.attributes.position.count;i+=53){const p=body.position.clone().fromBufferAttribute(body.geometry.attributes.position,i);body.applyBoneTransform(i,p);p.applyMatrix4(body.matrixWorld);actual.push(p.toArray());}
      return Math.max(...actual.map((p,i)=>Math.hypot(...p.map((n,j)=>n-window.expectedStudyPoses[name][i][j]))));
    },name);
    assert(error<.001,`Frozen ${name} pose differs from requested clip: ${error}`);
    observations.frozen_pose_max_error[name]=error;
  }
  await page.locator('[data-clip="Focus"]').click();
  for(const view of ['front','side','back']){
    await page.locator(`[data-view="${view}"]`).click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'),'true');
    await page.screenshot({path:`output/browser-focus-${view}.png`,fullPage:true,timeout:15000});
  }
  await page.locator('[data-view="hero"]').click();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  observations.mobile_frame_bounds={};
  for(const name of ['Idle','Greeting','Focus','Celebrate']){
    await page.locator(`[data-clip="${name}"]`).click();
    await page.waitForTimeout(120);
    const extent=await page.evaluate(()=>{
      const {model}=window.modelStudy;
      model.updateMatrixWorld(true);
      let body;model.traverse(obj=>{if(obj.isSkinnedMesh&&obj.geometry.attributes.position.count>5000)body=obj;});
      body.skeleton.update();let x=0,y=0;
      const camera=window.modelStudy.camera;
      for(let i=0;i<body.geometry.attributes.position.count;i+=17){
        const p=body.position.clone().fromBufferAttribute(body.geometry.attributes.position,i);
        body.applyBoneTransform(i,p);p.applyMatrix4(body.matrixWorld).project(camera);
        x=Math.max(x,Math.abs(p.x));y=Math.max(y,Math.abs(p.y));
      }
      return {x,y};
    });
    assert(extent.x<.96&&extent.y<.96,`Mobile ${name} cropped: ${JSON.stringify(extent)}`);
    observations.mobile_frame_bounds[name]=extent;
  }
  await page.screenshot({path:'output/browser-mobile.png',fullPage:true,timeout:15000});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('#motion').checked);
  assert.equal(await page.locator('#motion').isChecked(),true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!document.querySelector('#motion').checked);
  assert.equal(await page.locator('#motion').isChecked(),false);
  assert.deepEqual(errors,[]);
  observations.browser_version=browser.version();
  await writeFile('output/browser-inspection.json',JSON.stringify(observations,null,2)+'\n');
  console.log(JSON.stringify(observations,null,2));
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
