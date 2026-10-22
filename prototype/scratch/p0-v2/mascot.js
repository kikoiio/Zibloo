(() => {
  let serial = 0;
  const safe = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svg = ({label='Zibloo',symbol=false}={}) => `<svg xmlns="http://www.w3.org/2000/svg" class="zibloo-art" viewBox="${symbol?'20 115 420 390':'470 25 800 735'}" role="img" aria-label="${safe(label)}" data-source="approved-B2"><image class="approved-source" href="assets/reference-B2.png" x="0" y="0" width="2025" height="776"/></svg>`;
  function logo(className='brand-image') {
    const id=`approved-lockup-${++serial}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="180 70 1400 470" role="img" aria-label="zibloo" data-source="approved-C3"><defs><clipPath id="${id}"><path d="M180 70H1580V415H710V540H180Z"/></clipPath></defs><image class="approved-source" clip-path="url(#${id})" href="assets/reference-C3.png" x="0" y="0" width="1774" height="887"/></svg>`;
  }
  const media = typeof matchMedia==='function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let greetingTimer;
  function refresh() {
    if(typeof document==='undefined')return;
    const sidebar=document.querySelector('#sidebar-lockup');
    if(sidebar&&!sidebar.firstElementChild)sidebar.innerHTML=logo();
    document.documentElement.classList.toggle('system-reduced-motion',!!media?.matches);
  }
  function greet(host) {
    if(!host||media?.matches||document.documentElement.classList.contains('reduced-motion'))return;
    clearTimeout(greetingTimer);
    host.classList.add('is-greeting');
    greetingTimer=setTimeout(()=>host.isConnected&&host.classList.remove('is-greeting'),1300);
  }
  globalThis.Zibloo={svg,logo,refresh,greet};
  if(typeof document!=='undefined') {
    media?.addEventListener('change',refresh);
    document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('document-hidden',document.hidden));
  }
})();
