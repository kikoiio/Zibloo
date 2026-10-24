(() => {
  let serial = 0;
  const safe = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paperMask = id => `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 -1 0 0 1" result="paper"/><feComponentTransfer in="paper" result="ink"><feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="ink" operator="in"/></filter>`;
  const swimFrames = ['stroke-a','stroke-b','stroke-c','stroke-d'];
  function svg({label='Zibloo',symbol=false}={}) {
    if(symbol) {
      const id=`approved-art-${++serial}`;
      return `<svg xmlns="http://www.w3.org/2000/svg" class="zibloo-art approved-art" viewBox="20 115 420 390" role="img" aria-label="${safe(label)}" data-source="approved-B2"><defs>${paperMask(id)}</defs><image class="approved-source" filter="url(#${id})" href="assets/reference-B2.png" x="0" y="0" width="2025" height="776"/></svg>`;
    }
    const frames = swimFrames.map((name,index)=>`<image class="zibloo-frame" data-frame="${'abcd'[index]}" opacity="${index===0?1:0}" href="assets/frames/${name}.png" x="0" y="0" width="800" height="735"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" class="zibloo-art frame-sequence" viewBox="0 0 800 735" role="img" aria-label="${safe(label)}" data-source="b2-frame-sequence">${frames}<image class="zibloo-frame" data-frame="greet" opacity="0" href="assets/frames/greet.png" x="0" y="0" width="800" height="735"/></svg>`;
  }
  function logo(className='brand-image') {
    const id=`approved-lockup-${++serial}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="180 70 1400 470" role="img" aria-label="zibloo" data-source="approved-C3"><defs>${paperMask(id+'-ink')}<clipPath id="${id}"><path d="M180 70H1580V415H710V540H180Z"/></clipPath></defs><image class="approved-source" filter="url(#${id}-ink)" clip-path="url(#${id})" href="assets/reference-C3.png" x="0" y="0" width="1774" height="887"/></svg>`;
  }
  const media = typeof matchMedia==='function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const greetings = new Map();
  const reduced = () => !!media?.matches || document.documentElement.classList.contains('reduced-motion');
  let scene;
  function refresh() {
    if(typeof document==='undefined')return;
    const sidebar=document.querySelector('#sidebar-lockup');
    if(sidebar&&!sidebar.firstElementChild)sidebar.innerHTML=logo();
    document.documentElement.classList.toggle('system-reduced-motion',!!media?.matches);
    document.querySelectorAll('.live-zibloo').forEach(host=>{
      host.classList.add('approved-preview');
      bindInteractive(host);
    });
    const stage=document.querySelector('.home-stage');
    if(scene?.stage!==stage) {
      scene?.dispose();
      scene=stage?bindScene(stage):null;
    }
    if(reduced()) {
      for(const [host,timer] of greetings) {
        clearTimeout(timer);
        host.classList.remove('is-greeting');
      }
      greetings.clear();
      scene?.settle();
    }
  }
  function bindInteractive(host) {
    if(!host||host.dataset.interactiveReady==='true')return;
    host.dataset.interactiveReady='true';
    const reset=()=>host.classList.remove('is-pressed');
    host.addEventListener('pointerdown',()=>host.classList.add('is-pressed'));
    host.addEventListener('pointerleave',reset);
    host.addEventListener('pointerup',reset);
    host.addEventListener('pointercancel',reset);
  }
  function greet(host) {
    if(!host||reduced())return;
    clearTimeout(greetings.get(host));
    host.classList.remove('is-greeting');
    void host.offsetWidth;
    host.classList.add('is-greeting');
    greetings.set(host,setTimeout(()=>{
      host.classList.remove('is-greeting');
      greetings.delete(host);
    },1300));
  }
  function bindScene(stage) {
    const mover=stage.querySelector('.mascot-main');
    const surface=stage.querySelector('.swim-area');
    const caption=stage.querySelector('.character-caption');
    if(!mover||!surface||!caption)return null;
    let target={x:0,y:0};
    let settleTimer=0;
    const clamp=(value,min,max)=>Math.max(min,Math.min(Math.max(min,max),value));
    const constrain=({x,y})=>{
      const halfWidth=mover.offsetWidth/2,halfHeight=mover.offsetHeight/2;
      return {
        x:clamp(x,halfWidth+12-mover.offsetLeft,stage.clientWidth-halfWidth-12-mover.offsetLeft),
        y:clamp(y,halfHeight-mover.offsetTop,caption.offsetTop-halfHeight-12-mover.offsetTop)
      };
    };
    const settle=()=>{
      clearTimeout(settleTimer);
      settleTimer=0;
      mover.classList.remove('is-swimming');
      mover.style.setProperty('--swim-lean','0deg');
    };
    function move(point,animate=true) {
      clearTimeout(settleTimer);
      settleTimer=0;
      const current=getComputedStyle(mover).translate.split(' ').map(parseFloat);
      target=constrain(point);
      const dx=target.x-(current[0]||0),dy=target.y-(current[1]||0);
      const distance=Math.hypot(dx,dy);
      const moving=animate&&!reduced()&&!document.hidden&&distance>1;
      mover.style.transitionDuration=moving?`${Math.min(900,300+distance*2)}ms`:'0s';
      mover.style.setProperty('--swim-lean',`${moving?clamp(dx/15,-4,4):0}deg`);
      mover.classList.toggle('is-swimming',moving);
      if(!moving)mover.style.setProperty('--swim-lean','0deg');
      // Position and the artwork's idle/greeting transforms live on separate elements.
      mover.style.translate=`${target.x}px ${target.y}px`;
    }
    surface.addEventListener('click',event=>{
      if(event.detail===0)return move({x:0,y:0});
      const rect=stage.getBoundingClientRect();
      move({x:event.clientX-rect.left-mover.offsetLeft,y:event.clientY-rect.top-mover.offsetTop});
    });
    const directions={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-24],ArrowDown:[0,24]};
    stage.addEventListener('keydown',event=>{
      if(event.target!==surface&&event.target!==mover)return;
      if(directions[event.key]) {
        event.preventDefault();
        const [x,y]=directions[event.key];
        const current=getComputedStyle(mover).translate.split(' ').map(parseFloat);
        move({x:(current[0]||0)+x,y:(current[1]||0)+y},false);
      }else if(event.key==='Home'||event.key==='Escape') {
        event.preventDefault();
        move({x:0,y:0},false);
      }
    });
    stage.querySelector('.swim-reset')?.addEventListener('click',()=>move({x:0,y:0}));
    mover.addEventListener('transitionend',event=>{
      if(event.target===mover&&event.propertyName==='translate') {
        clearTimeout(settleTimer);
        settleTimer=setTimeout(settle,420);
      }
    });
    const observer=new ResizeObserver(()=>move(target,false));
    observer.observe(stage);
    observer.observe(mover);
    observer.observe(caption);
    move(target,false);
    return {stage,settle,dispose:()=>{observer.disconnect();settle();}};
  }
  globalThis.Zibloo={svg,logo,refresh,greet};
  if(typeof document!=='undefined') {
    media?.addEventListener('change',refresh);
    document.addEventListener('visibilitychange',()=>{
      document.documentElement.classList.toggle('document-hidden',document.hidden);
      if(document.hidden)scene?.settle();
    });
  }
})();
