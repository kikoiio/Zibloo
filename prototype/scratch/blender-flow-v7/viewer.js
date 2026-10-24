import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const canvas = document.querySelector('canvas');
const stage = canvas.parentElement;
const status = document.querySelector('.status');
const motion = document.querySelector('#motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
motion.checked = !reduced.matches;
const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfffcf0,0x6b9690,2.2));
const key = new THREE.DirectionalLight(0xfff3db,1.8); key.position.set(-3,5,5); scene.add(key);
const fill = new THREE.DirectionalLight(0xc3e9e8,.8); fill.position.set(4,2,-3); scene.add(fill);
const camera = new THREE.PerspectiveCamera(34,1,.1,50);
camera.position.set(2.6,1.8,12.2);
const controls = new OrbitControls(camera,canvas);
controls.target.set(0,.2,0); controls.enablePan=false;controls.enableZoom=false;
controls.minPolarAngle=.5;controls.maxPolarAngle=2.4;controls.update();
let viewDistance=13.8;
const viewDirections={eyes:[0,0,1],hero:[2.6,1.6,12.2],front:[0,.3,12.6],side:[12.6,.3,0],back:[0,.3,-12.6]};
const setView = name => {
  viewDistance=name==='eyes'?5.0:13.8;
  controls.target.set(0,name==='eyes'?1.45:.2,0);
  camera.position.copy(controls.target).add(new THREE.Vector3(...viewDirections[name]).normalize().multiplyScalar(viewDistance/Math.min(1,camera.aspect)));
  controls.update();dirty=true;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));
};
let mixer, active, clips, model, current='Idle', dirty=true;
controls.addEventListener('change',()=>{dirty=true;});
const clock = new THREE.Clock();
const colorPresets={
  teal:{label:'青碧',body:'#236E69',belly:'#A3D9C9'},
  sand:{label:'沙色',body:'#B69A68',belly:'#F1E4C9'},
  rust:{label:'赤褐',body:'#A45338',belly:'#E6B58A'},
  ink:{label:'墨棕',body:'#433D35',belly:'#B8ADA0'}
};
const colorSequence=['teal','sand','rust','ink'];
let colorBody=null,colorAttribute=null,colorItemSize=3,colorTargets={},colorTransition=null,colorDelays;
let currentColor='teal',targetColor='teal',colorDemoToken=0,demoRunning=false;
const colorDemoButton=document.querySelector('[data-color-demo]');
const colorButtons=[...document.querySelectorAll('[data-color]')];
const clamp01=value=>Math.max(0,Math.min(1,value));
const smoothstep=(min,max,value)=>{
  const t=clamp01((value-min)/(max-min));
  return t*t*(3-2*t);
};
const linearColor=hex=>new THREE.Color(hex).toArray();
const colorStateSnapshot=()=>({
  current:currentColor,target:targetColor,
  progress:colorTransition?clamp01((performance.now()-colorTransition.start)/colorTransition.duration):1,
  transitioning:Boolean(colorTransition),demoRunning,
  reducedMotion:reduced.matches
});
function updateColorControls(){
  colorButtons.forEach(button=>{
    button.disabled=!colorBody;
    button.setAttribute('aria-pressed',String(button.dataset.color===targetColor));
  });
  colorDemoButton.disabled=!colorBody||reduced.matches;
  colorDemoButton.setAttribute('aria-pressed',String(demoRunning));
  colorDemoButton.textContent=demoRunning?'停止演示':'变色演示';
}
function initializeBodyColor(){
  model.traverse(object=>{
    if(!colorBody&&object.isSkinnedMesh&&object.geometry.attributes.position?.count>5000)colorBody=object;
  });
  if(!colorBody)throw Error('Missing skinned body for color study');
  const geometry=colorBody.geometry;
  geometry.computeBoundingBox();
  const positions=geometry.attributes.position;
  colorAttribute=geometry.attributes.color;
  if(!colorAttribute)throw Error('Missing exported body vertex colors');
  const sourceAttribute=colorAttribute;
  colorItemSize=sourceAttribute.itemSize;
  const restColor=new Float32Array(positions.count*colorItemSize);
  for(let index=0;index<positions.count;index++){
    const offset=index*colorItemSize;
    restColor[offset]=sourceAttribute.getX(index);
    restColor[offset+1]=sourceAttribute.getY(index);
    restColor[offset+2]=sourceAttribute.getZ(index);
    if(colorItemSize>3)restColor[offset+3]=sourceAttribute.getW(index);
  }
  colorAttribute=new THREE.BufferAttribute(restColor.slice(),colorItemSize).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('color',colorAttribute);
  colorDelays=new Float32Array(positions.count);
  const bounds=geometry.boundingBox,size=bounds.getSize(new THREE.Vector3());
  const sourceBase=linearColor('#236E69'),sourceBelly=linearColor('#A3D9C9');
  const delta=sourceBelly.map((value,index)=>value-sourceBase[index]);
  const deltaLength=delta.reduce((sum,value)=>sum+value*value,0);
  const vertices=[];
  for(let index=0;index<positions.count;index++){
    const offset=index*colorItemSize;
    const rest=[restColor[offset],restColor[offset+1],restColor[offset+2]];
    const projection=clamp01(rest.reduce((sum,value,channel)=>sum+(value-sourceBase[channel])*delta[channel],0)/deltaLength);
    const point=new THREE.Vector3().fromBufferAttribute(positions,index);
    vertices.push({
      belly:projection,
      x:size.x?(point.x-bounds.min.x)/size.x:.5,
      y:size.y?(point.y-bounds.min.y)/size.y:.5,
      z:size.z?(point.z-bounds.min.z)/size.z:.5
    });
  }
  const paletteColors=Object.fromEntries(Object.entries(colorPresets).map(([name,palette])=>[
    name,{body:linearColor(palette.body),belly:linearColor(palette.belly)}
  ]));
  colorTargets=Object.fromEntries(Object.entries(paletteColors).map(([name,palette])=>{
    const target=new Float32Array(colorAttribute.array.length);
    vertices.forEach((vertex,index)=>{
      const {belly,x,y,z}=vertex;
      const bellyAmount=belly;
      const largeMottle=Math.sin(x*6.2+y*2.1+z*1.8)*Math.sin(y*5.1-z*3.4+x*1.7);
      const brightness=.965+largeMottle*.035;
      colorDelays[index]=.50*(1-y)+.06*(largeMottle+1)*.5;
      const offset=index*colorItemSize;
      for(let channel=0;channel<3;channel++){
        const local=palette.body[channel]+(palette.belly[channel]-palette.body[channel])*bellyAmount;
        target[offset+channel]=Math.max(0,Math.min(1,local*brightness));
      }
      if(colorItemSize>3)target[offset+3]=restColor[offset+3];
    });
    return [name,target];
  }));
  colorTargets.teal=restColor.slice();
  const materials=Array.isArray(colorBody.material)?colorBody.material:[colorBody.material];
  materials.forEach(material=>{material.vertexColors=true;material.needsUpdate=true;});
  applyColor(colorTargets.teal);
  targetColor=currentColor='teal';
  updateColorControls();
}
function applyColor(colors){
  colorAttribute.array.set(colors);
  colorAttribute.needsUpdate=true;
  dirty=true;
}
function setColor(name,{fromDemo=false}={}){
  if(!colorTargets[name])return false;
  if(!fromDemo)stopColorDemo();
  targetColor=name;
  updateColorControls();
  if(reduced.matches){
    applyColor(colorTargets[name]);
    currentColor=name;colorTransition=null;
    updateColorControls();
    return true;
  }
  colorTransition={from:new Float32Array(colorAttribute.array),to:colorTargets[name],name,start:performance.now(),duration:1250};
  dirty=true;
  return true;
}
function updateColorTransition(now){
  if(!colorTransition)return;
  const {from,to,name,start,duration}=colorTransition;
  const amount=clamp01((now-start)/duration);
  const array=colorAttribute.array;
  for(let vertex=0;vertex<colorDelays.length;vertex++){
    const local=clamp01((amount-colorDelays[vertex])/.44);
    const eased=local*local*(3-2*local);
    const offset=vertex*colorItemSize;
    for(let channel=0;channel<colorItemSize;channel++){
      const index=offset+channel;
      array[index]=from[index]+(to[index]-from[index])*eased;
    }
  }
  colorAttribute.needsUpdate=true;dirty=true;
  if(amount>=1){
    colorTransition=null;currentColor=name;updateColorControls();
  }
}
function stopColorDemo(){
  colorDemoToken++;
  demoRunning=false;
  updateColorControls();
}
const waitForColorTransition=async token=>{
  while(token===colorDemoToken&&colorTransition)await new Promise(resolve=>setTimeout(resolve,40));
  return token===colorDemoToken;
};
async function playColorDemo(){
  if(demoRunning){stopColorDemo();return false;}
  if(!colorBody||reduced.matches)return false;
  stopColorDemo();
  const token=++colorDemoToken,original=targetColor;
  demoRunning=true;updateColorControls();
  for(const name of colorSequence){
    if(token!==colorDemoToken)return false;
    setColor(name,{fromDemo:true});
    if(!await waitForColorTransition(token))return false;
    await new Promise(resolve=>setTimeout(resolve,240));
  }
  if(token!==colorDemoToken)return false;
  setColor(original,{fromDemo:true});
  if(!await waitForColorTransition(token))return false;
  demoRunning=false;updateColorControls();
  return true;
}
const seek = phase => {
  if(!active)return;
  motion.checked=false;
  const clip=active.getClip();
  mixer.stopAllAction();
  active=mixer.clipAction(clip).reset().stopFading().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  active.time=Math.min(clip.duration-.00001,clip.duration*clamp01(phase));
  mixer.update(0);
  document.querySelector('#pose-time').value=String(Math.round(clamp01(phase)*100));
  dirty=true;
};
const emotionLabels={Idle:'放松 · 自然眨眼与游移视线',Greeting:'亲近 · 抬眼与俏皮眨眼',Focus:'专注 · 眯眼并注视光珠',Celebrate:'开心 · 两只弯弯的笑眼'};
const select = (name,fade=.25) => {
  const clip = clips.find(c=>c.name===name); if (!clip) throw Error(`Missing animation: ${name}`);
  if (!motion.checked) { mixer.stopAllAction(); fade=0; }
  const next = mixer.clipAction(clip); if(active) active.fadeOut(fade);
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).fadeIn(fade).play();
  active=next;current=name;
  if(!motion.checked){mixer.update(.01);active.time=clip.duration*.42;mixer.update(0);}
  document.querySelectorAll('[data-clip]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.clip===name)));
  document.querySelector('.emotion').textContent=emotionLabels[name];
  dirty=true;
};
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('zibloo_flow_v7.glb',gltf=>{
  model=gltf.scene;clips=gltf.animations;scene.add(model);mixer=new THREE.AnimationMixer(model);
  initializeBodyColor();
  select('Idle',0);status.textContent='拖动旋转 · 点击下方切换动作';
  window.modelStudy={model,mixer,clips,select,renderer,camera,setColor,playColorDemo,
    loadReference:()=>new GLTFLoader().loadAsync('zibloo_flow_v7_source.glb'),
    setView,seek,get current(){return current;},get currentColor(){return currentColor;},get colorState(){return colorStateSnapshot();}};
},undefined,error=>{status.textContent='角色加载失败，请刷新重试';console.error(error);});
document.querySelectorAll('[data-clip]').forEach(button=>button.addEventListener('click',()=>{if(mixer)select(button.dataset.clip);}));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
colorButtons.forEach(button=>button.addEventListener('click',()=>setColor(button.dataset.color)));
colorDemoButton.addEventListener('click',()=>playColorDemo());
document.querySelector('#pose-time').addEventListener('input',event=>window.modelStudy?.seek(Number(event.target.value)/100));
motion.addEventListener('change',()=>{if(mixer&&!motion.checked)seek(active.time/active.getClip().duration);dirty=true;});
reduced.addEventListener('change',()=>{
  motion.checked=!reduced.matches;motion.dispatchEvent(new Event('change'));
  if(reduced.matches){stopColorDemo();if(colorTargets[targetColor])setColor(targetColor,{fromDemo:true});}
  updateColorControls();
});
updateColorControls();
new ResizeObserver(()=>{
  const w=stage.clientWidth,h=stage.clientHeight;
  renderer.setSize(w,h,false);camera.aspect=w/h;
  const offset=camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(offset,viewDistance/Math.min(1,camera.aspect));
  camera.updateProjectionMatrix();controls.update();dirty=true;
}).observe(stage);
function frame(){requestAnimationFrame(frame);const delta=Math.min(.05,clock.getDelta());if(document.hidden)return;if(mixer&&motion.checked){mixer.update(delta);document.querySelector('#pose-time').value=String(Math.round(active.time/active.getClip().duration*100));dirty=true;}updateColorTransition(performance.now());controls.update();if(dirty){renderer.render(scene,camera);dirty=false;}}
frame();
