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
const viewDirections={hero:[2.6,1.6,12.2],front:[0,.3,12.6],side:[12.6,.3,0],back:[0,.3,-12.6]};
const setView = name => {
  camera.position.copy(controls.target).add(new THREE.Vector3(...viewDirections[name]).normalize().multiplyScalar(12.6/Math.min(1,camera.aspect)));
  controls.update();dirty=true;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));
};
let mixer, active, clips, model, current='Idle', dirty=true;
controls.addEventListener('change',()=>{dirty=true;});
const clock = new THREE.Clock();
const select = (name,fade=.25) => {
  const clip = clips.find(c=>c.name===name); if (!clip) throw Error(`Missing animation: ${name}`);
  if (!motion.checked) { mixer.stopAllAction(); fade=0; }
  const next = mixer.clipAction(clip); if(active) active.fadeOut(fade);
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).fadeIn(fade).play();
  active=next;current=name;
  if(!motion.checked){mixer.update(.01);active.time=clip.duration*.42;mixer.update(0);}
  document.querySelectorAll('[data-clip]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.clip===name)));
  dirty=true;
};
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('zibloo_flow_v5.glb',gltf=>{
  model=gltf.scene;clips=gltf.animations;scene.add(model);mixer=new THREE.AnimationMixer(model);
  select('Idle',0);status.textContent='拖动旋转 · 点击下方切换动作';
  window.modelStudy={model,mixer,clips,select,renderer,camera,
    loadReference:()=>new GLTFLoader().loadAsync('zibloo_flow_v5_source.glb'),
    get current(){return current;}};
},undefined,error=>{status.textContent='角色加载失败，请刷新重试';console.error(error);});
document.querySelectorAll('[data-clip]').forEach(button=>button.addEventListener('click',()=>{if(mixer)select(button.dataset.clip);}));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
motion.addEventListener('change',()=>{if(mixer&&!motion.checked){active.time=active.getClip().duration*.42;mixer.update(0);}dirty=true;});
reduced.addEventListener('change',()=>{motion.checked=!reduced.matches;motion.dispatchEvent(new Event('change'));});
new ResizeObserver(()=>{
  const w=stage.clientWidth,h=stage.clientHeight;
  renderer.setSize(w,h,false);camera.aspect=w/h;
  const offset=camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(offset,12.6/Math.min(1,camera.aspect));
  camera.updateProjectionMatrix();controls.update();dirty=true;
}).observe(stage);
function frame(){requestAnimationFrame(frame);const delta=Math.min(.05,clock.getDelta());if(document.hidden)return;if(mixer&&motion.checked){mixer.update(delta);dirty=true;}controls.update();if(dirty){renderer.render(scene,camera);dirty=false;}}
frame();
