(() => {
  const teal = '#499f9e', mint = '#b5d8c7', ink = '#154e52';
  const arms = [
    {back:true, width:22, points:[[249,224],[210,204],[165,201],[119,209],[82,199],[63,181],[66,166]]},
    {back:true, width:23, points:[[249,233],[202,252],[158,278],[119,288],[96,275],[92,253],[103,244]]},
    {back:true, width:20, points:[[269,236],[309,259],[343,294],[360,327],[346,349],[328,348]]},
    {back:true, width:21, points:[[278,221],[319,225],[357,211],[378,184],[377,159],[361,151]]},
    {width:23, points:[[249,233],[207,226],[158,237],[116,257],[77,259],[63,242],[70,229]]},
    {width:23, points:[[277,230],[313,240],[353,258],[391,255],[408,235],[401,219]]},
    {width:26, points:[[253,241],[235,277],[200,306],[169,328],[151,318],[155,302]]},
    {width:26, points:[[270,238],[291,279],[271,315],[246,347],[253,376],[283,388],[310,374],[312,356]]},
  ];
  const num = n => Number(n.toFixed(2));
  const xy = p => `${num(p[0])},${num(p[1])}`;
  const safe = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function sample(points) {
    const out=[];
    for(let i=0;i<points.length-1;i++) {
      const a=points[Math.max(0,i-1)], b=points[i], c=points[i+1], d=points[Math.min(points.length-1,i+2)];
      for(let j=0;j<7;j++) {
        const t=j/7, t2=t*t, t3=t2*t;
        out.push([0,1].map(k => .5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3)));
      }
    }
    out.push(points.at(-1));
    return out;
  }

  function ribbon(points, width, split=false) {
    const curve=sample(points), left=[], right=[];
    for(let i=0;i<curve.length;i++) {
      const prev=curve[Math.max(0,i-1)], next=curve[Math.min(curve.length-1,i+1)];
      const dx=next[0]-prev[0], dy=next[1]-prev[1], len=Math.hypot(dx,dy)||1;
      const progress=i/(curve.length-1), radius=width*(1-.69*Math.pow(progress,.8));
      const normal=[-dy/len,dx/len], part=split ? .12+.18*Math.sin(progress*Math.PI) : 1;
      left.push([curve[i][0]+normal[0]*radius,curve[i][1]+normal[1]*radius]);
      right.push([curve[i][0]-normal[0]*radius*part,curve[i][1]-normal[1]*radius*part]);
    }
    const tip=curve.at(-1), before=curve.at(-2), dx=tip[0]-before[0], dy=tip[1]-before[1], len=Math.hypot(dx,dy)||1;
    const cap=[tip[0]+dx/len*width*.4,tip[1]+dy/len*width*.4];
    return `M${left.map(xy).join(' L')} Q${xy(cap)} ${xy(right.at(-1))} L${right.reverse().map(xy).join(' L')} Z`;
  }

  function pose(index, time=0, mood='idle', greeting=0, pointer={x:0,y:0}) {
    const arm=arms[index];
    const quiet=mood==='focus'||mood==='paused';
    const energy=quiet ? 0 : mood==='celebrate' ? 1.7 : mood==='training' ? 1.25 : 1;
    const phase=index*.83;
    return arm.points.map((p,j)=>{
      const along=j/(arm.points.length-1), wave=Math.pow(along,1.7);
      const speed=mood==='training' ? 1.15 : .7;
      const x=p[0]+wave*(Math.sin(time*speed+phase-along*2.4)*5*energy);
      const y=p[1]+wave*(Math.cos(time*speed*.87+phase-along*2)*7*energy);
      const reach=index===3 ? along*along : 0;
      return [x+reach*pointer.x*.36, y+reach*pointer.y*.3-wave*greeting*(index===3 ? 35 : 6)*Math.sin(along*Math.PI*.6)];
    });
  }

  function paths(time=0,mood='idle',greeting=0,pointer={x:0,y:0}) {
    return arms.map((arm,i)=>{
      const points=pose(i,time,mood,greeting,pointer);
      return `<g class="zibloo-arm" data-arm="${i}"><path class="arm-base" fill="${mint}" d="${ribbon(points,arm.width)}"/><path class="arm-face" fill="${arm.back?'#83bfb1':teal}" d="${ribbon(points,arm.width,true)}"/></g>`;
    }).join('');
  }

  function svg({label='Zibloo',time=0,mood='idle',greeting=0}={}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="zibloo-vector" viewBox="0 0 480 440" role="img" aria-label="${safe(label)}"><g class="zibloo-body">${paths(time,mood,greeting)}<g class="zibloo-mantle"><path fill="${mint}" d="M246 42 C192 28 155 61 165 113 C174 153 209 177 225 209 C236 232 214 243 228 258 C245 275 282 269 291 245 C288 219 271 205 283 177 C300 140 313 102 294 71 C283 52 263 44 246 42 Z"/><path fill="${teal}" d="M246 42 C205 34 180 57 186 98 C191 135 226 164 242 192 C254 213 221 241 228 258 C245 275 282 269 291 245 C288 219 271 205 283 177 C300 140 313 102 294 71 C283 52 263 44 246 42 Z"/><g class="zibloo-eyes"><ellipse cx="253" cy="174" rx="7.4" ry="11" fill="${ink}"/><ellipse cx="279" cy="167" rx="6.3" ry="10" fill="${ink}"/><g class="zibloo-pupils" fill="#fffdf7"><ellipse cx="255" cy="171" rx="2.5" ry="4.2"/><ellipse cx="281" cy="164" rx="2.2" ry="3.6"/></g></g></g></g></svg>`;
  }

  let actors=[], frame=0, lastFrame=0, activeTime=0, media;
  const reduced=()=>media?.matches||document.documentElement.classList.contains('reduced-motion');
  const moving=actor=>!['focus','paused'].includes(actor.host.dataset.mood)||actor.greeting>.01;

  function draw(actor) {
    const mood=actor.host.dataset.mood||'idle';
    const time=reduced() ? 0 : activeTime;
    for(let i=0;i<arms.length;i++) {
      const points=pose(i,time,mood,actor.greeting,actor.pointer);
      actor.paths[i][0].setAttribute('d',ribbon(points,arms[i].width));
      actor.paths[i][1].setAttribute('d',ribbon(points,arms[i].width,true));
    }
    const quiet=['focus','paused'].includes(mood);
    const float=quiet||reduced() ? 0 : Math.sin(time*.72)*3;
    actor.body.setAttribute('transform',`translate(0 ${num(float)}) rotate(${num(actor.pointer.x*.018)} 250 220)`);
    const blinkPhase=(time+actor.offset)%5.8;
    const blink=quiet||reduced() ? 1 : blinkPhase>5.52 ? Math.max(.08,Math.abs(blinkPhase-5.66)/.14) : 1;
    actor.eyes.setAttribute('transform',`translate(0 ${num(171*(1-blink))}) scale(1 ${num(blink)})`);
  }

  function tick(now) {
    frame=0;
    if(document.hidden||reduced()) {lastFrame=0;return;}
    if(lastFrame&&now-lastFrame<40) {frame=requestAnimationFrame(tick);return;}
    const delta=lastFrame ? Math.min((now-lastFrame)/1000,.1) : 0;
    activeTime+=delta; lastFrame=now;
    actors=actors.filter(actor=>actor.host.isConnected);
    let keepGoing=false;
    for(const actor of actors) {
      actor.greeting+=(actor.greetUntil>now ? 1-actor.greeting : -actor.greeting)*.14;
      actor.pointer.x+=(actor.target.x-actor.pointer.x)*.12;
      actor.pointer.y+=(actor.target.y-actor.pointer.y)*.12;
      if(moving(actor)) {draw(actor);keepGoing=true;}
    }
    if(keepGoing)frame=requestAnimationFrame(tick);else lastFrame=0;
  }

  function refresh() {
    if(typeof document==='undefined')return;
    media??=matchMedia('(prefers-reduced-motion: reduce)');
    const old=new Map(actors.map(actor=>[actor.host,actor]));
    const dialog=document.querySelector('#overlay')?.firstElementChild;
    actors=[...document.querySelectorAll('.live-zibloo')].filter(host=>!dialog||host.closest('#overlay')).map((host,index)=>old.get(host)||{
      host,paths:[...host.querySelectorAll('.zibloo-arm')].map(g=>[g.querySelector('.arm-base'),g.querySelector('.arm-face')]),
      body:host.querySelector('.zibloo-body'),eyes:host.querySelector('.zibloo-eyes'),
      pointer:{x:0,y:0},target:{x:0,y:0},greeting:0,greetUntil:0,offset:index*.7,
    });
    if(reduced()) {
      cancelAnimationFrame(frame);frame=0;lastFrame=0;
      for(const actor of actors) {actor.pointer={x:0,y:0};actor.greeting=0;draw(actor);}
    } else {
      for(const actor of actors)draw(actor);
      if(!frame&&!document.hidden&&actors.some(moving))frame=requestAnimationFrame(tick);
    }
  }

  function greet(host) {
    const actor=actors.find(a=>a.host===host);
    if(!actor||reduced())return;
    actor.greetUntil=performance.now()+1700;
    if(!frame)frame=requestAnimationFrame(tick);
  }

  globalThis.Zibloo={svg,refresh,greet};
  if(typeof document!=='undefined') {
    document.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch')return;
      const stage=event.target.closest('.home-stage');
      const actor=actors.find(a=>a.host.closest('.home-stage'));
      if(!actor)return;
      if(!stage) {actor.target={x:0,y:0};return;}
      const box=actor.host.getBoundingClientRect();
      actor.target={x:Math.max(-65,Math.min(65,(event.clientX-box.left-box.width/2)*.5)),y:Math.max(-55,Math.min(55,(event.clientY-box.top-box.height/2)*.5))};
    },{passive:true});
    document.addEventListener('pointerleave',()=>{for(const actor of actors)actor.target={x:0,y:0};});
    document.addEventListener('visibilitychange',()=>{
      cancelAnimationFrame(frame);frame=0;lastFrame=0;
      if(!document.hidden)refresh();
    });
    media=matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change',refresh);
  }
})();
