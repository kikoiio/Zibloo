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
  assert.equal(observations.bones,103,'Unexpected joint count for twelve-segment tentacles');
  for(const clip of observations.clips){assert(clip.finite);assert(clip.movement>({Idle:.30,Greeting:1.0,Focus:.10,Celebrate:.85}[clip.name]),JSON.stringify(clip));assert(clip.loop_gap<.025,JSON.stringify(clip));}
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
  console.log('Checking real exported eye deformation and closeups');
  observations.eye_poses=await page.evaluate(()=>{
    const {model,mixer,clips}=window.modelStudy;
    const eyes=[];model.traverse(obj=>{if(obj.isSkinnedMesh&&/^Eye(?:[._]?\d+)?$/i.test(obj.name))eyes.push(obj);});
    if(eyes.length!==2)throw Error(`Expected two open eye meshes, found ${eyes.length}`);
    const result={};
    for(const clip of clips){
      result[clip.name]=[];
      for(const phase of [0,.21,.42,.5,.78]){
        mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.setTime(clip.duration*phase);model.updateMatrixWorld(true);
        result[clip.name].push({phase,eyes:eyes.map(eye=>{
          eye.skeleton.update();const points=[];
          for(let i=0;i<eye.geometry.attributes.position.count;i++){
            const p=eye.position.clone().fromBufferAttribute(eye.geometry.attributes.position,i);
            eye.applyBoneTransform(i,p);p.applyMatrix4(eye.matrixWorld);points.push(p.toArray());
          }
          return [0,1,2].map(axis=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis])));
        })});
      }
    }
    window.modelStudy.select('Celebrate',0);
    return result;
  });
  for(const [name,states] of Object.entries(observations.eye_poses)){
    const heights=states.flatMap(state=>state.eyes.map(span=>span[1]));
    assert(Math.max(...heights)-Math.min(...heights)>.025,`${name}: eye shape is static`);
  }
  await page.locator('[data-view="eyes"]').click();
  for(const name of ['Idle','Greeting','Focus','Celebrate']){
    await page.locator(`[data-clip="${name}"]`).click();
    await page.waitForTimeout(100);
    await page.screenshot({path:`output/browser-eyes-${name.toLowerCase()}.png`,timeout:15000});
  }
  await page.locator('[data-view="hero"]').click();
  await page.locator('[data-clip="Focus"]').click();
  console.log('Checking body-only color palettes and transitions');
  const readColors=()=>page.evaluate(()=>{
    const {model,currentColor,colorState}=window.modelStudy;
    let body;const eyes=[];
    model.traverse(object=>{
      if(object.isSkinnedMesh&&object.geometry.attributes.position.count>5000)body=object;
      if(object.isMesh&&/^eye(?:[._]?\d+)?$/i.test(object.name)){
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const vertexColors=object.geometry.attributes.color;
        eyes.push({name:object.name,colors:materials.map(material=>material.color?.toArray()||null),
          vertexColors:vertexColors?Array.from(vertexColors.array):null});
      }
    });
    const attribute=body.geometry.attributes.color;
    const step=Math.max(1,Math.floor(attribute.count/36)),samples=[];
    for(let i=0;i<attribute.count;i+=step){
      samples.push([attribute.getX(i),attribute.getY(i),attribute.getZ(i)]);
    }
    return {currentColor,colorState,body:{count:attribute.count,samples},eyes};
  });
  const paletteNames=['teal','sand','rust','ink'];
  assert.equal(await page.locator('[data-color]').count(),4);
  assert.equal(await page.locator('[data-color-demo]').isDisabled(),true,'Demo should be disabled for reduced motion');
  const initialColors=await readColors();
  assert.equal(initialColors.currentColor,'teal');
  assert.equal(initialColors.colorState.transitioning,false,'Reduced motion should apply colors immediately');
  assert(initialColors.eyes.length>=2,'Expected both eye meshes to remain separate from body vertex colors');
  await page.screenshot({path:'output/browser-color-teal.png',fullPage:true,timeout:15000});
  let previousBody=initialColors.body.samples;
  const paletteSamples={teal:initialColors.body.samples};
  observations.color_palettes={};
  for(const name of paletteNames.slice(1)){
    await page.locator(`[data-color="${name}"]`).click();
    const colors=await readColors();
    assert.equal(colors.currentColor,name);
    assert.equal(colors.colorState.transitioning,false,'Reduced-motion color change was animated');
    assert.notDeepEqual(colors.body.samples,previousBody,`${name} did not update body COLOR values`);
    assert.deepEqual(colors.eyes,initialColors.eyes,`${name} changed eye materials`);
    assert.equal(await page.locator(`[data-color="${name}"]`).getAttribute('aria-pressed'),'true');
    await page.screenshot({path:`output/browser-color-${name}.png`,fullPage:true,timeout:15000});
    observations.color_palettes[name]={body_vertices:colors.body.count,changed:true,eyes_unchanged:true};
    paletteSamples[name]=colors.body.samples;
    previousBody=colors.body.samples;
  }
  await page.locator('[data-color="teal"]').click();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('#motion').checked);
  await page.locator('#motion').uncheck();
  await page.clock.install({time:new Date()});
  await page.clock.pauseAt(new Date(Date.now()+50));
  await page.locator('[data-color="rust"]').click();
  await page.clock.runFor(620);
  const middleColors=await readColors();
  assert.equal(await page.locator('#motion').isChecked(),false,'Color transition should work while action playback is paused');
  assert.equal(middleColors.colorState.transitioning,true);
  assert(middleColors.colorState.progress>.1&&middleColors.colorState.progress<.9,JSON.stringify(middleColors.colorState));
  assert.notDeepEqual(middleColors.body.samples,initialColors.body.samples,'Intermediate frame did not change body COLOR values');
  const spatialFractions=middleColors.body.samples.map((point,i)=>{
    const from=paletteSamples.teal[i],to=paletteSamples.rust[i];
    const delta=to.map((value,j)=>value-from[j]);
    const denominator=delta.reduce((sum,value)=>sum+value*value,0);
    return denominator>1e-8?point.reduce((sum,value,j)=>sum+(value-from[j])*delta[j],0)/denominator:0;
  });
  const spatialSpread=Math.max(...spatialFractions)-Math.min(...spatialFractions);
  assert(spatialSpread>.25,`Color wave applied uniformly instead of spreading: ${spatialSpread}`);
  await page.screenshot({path:'output/browser-color-gradient.png',fullPage:true,timeout:15000});
  await page.clock.resume();
  await page.waitForFunction(()=>!window.modelStudy.colorState.transitioning);
  assert.equal(await page.evaluate(()=>window.modelStudy.currentColor),'rust');
  observations.color_transition={progress:middleColors.colorState.progress,paused_action:true,intermediate_body_update:true,spatial_fraction_spread:spatialSpread};
  await page.locator('[data-color-demo]').click();
  await page.waitForFunction(()=>window.modelStudy.colorState.demoRunning);
  const demoTargets=[];let demoDeadline=Date.now()+12000;
  while(await page.evaluate(()=>window.modelStudy.colorState.demoRunning)){
    const state=await page.evaluate(()=>window.modelStudy.colorState);
    if(demoTargets.at(-1)!==state.target)demoTargets.push(state.target);
    assert(Date.now()<demoDeadline,'Color demo did not finish');
    await page.waitForTimeout(70);
  }
  assert.deepEqual(demoTargets,['teal','sand','rust','ink','rust']);
  assert.equal(await page.evaluate(()=>window.modelStudy.currentColor),'rust','Demo should return to the color active before it started');
  assert.equal(await page.locator('[data-color-demo]').getAttribute('aria-pressed'),'false');
  observations.color_demo={targets:demoTargets,returned_to:'rust',finished:true};
  await page.locator('[data-color-demo]').click();
  await page.waitForFunction(()=>window.modelStudy.colorState.demoRunning);
  await page.waitForTimeout(160);
  const stoppedTarget=await page.evaluate(()=>window.modelStudy.colorState.target);
  await page.locator('[data-color-demo]').click();
  await page.waitForFunction(()=>!window.modelStudy.colorState.demoRunning);
  await page.waitForFunction(()=>!window.modelStudy.colorState.transitioning);
  assert.equal(await page.evaluate(()=>window.modelStudy.currentColor),stoppedTarget,'Demo stop button should keep its current color');
  await page.locator('[data-color-demo]').click();
  await page.waitForFunction(()=>window.modelStudy.colorState.demoRunning);
  await page.waitForTimeout(160);
  await page.locator('[data-color="ink"]').click();
  await page.waitForFunction(()=>!window.modelStudy.colorState.demoRunning&&!window.modelStudy.colorState.transitioning);
  assert.equal(await page.evaluate(()=>window.modelStudy.currentColor),'ink','Manual color selection should cancel the demo');
  await page.locator('[data-color="teal"]').click();
  await page.waitForFunction(()=>!window.modelStudy.colorState.transitioning);
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
  await page.locator('#motion').check();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!document.querySelector('#motion').checked);
  assert.equal(await page.locator('#motion').isChecked(),false);
  assert.equal(await page.locator('[data-color-demo]').isDisabled(),true);
  await page.locator('[data-color="sand"]').click();
  const reducedColors=await readColors();
  assert.equal(reducedColors.colorState.transitioning,false,'Reduced-motion palette change should be immediate');
  assert.equal(reducedColors.currentColor,'sand');
  assert.deepEqual(errors,[]);
  observations.browser_version=browser.version();
  await writeFile('output/browser-inspection.json',JSON.stringify(observations,null,2)+'\n');
  console.log(JSON.stringify(observations,null,2));
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
