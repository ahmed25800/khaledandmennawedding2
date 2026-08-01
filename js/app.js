(() => {
  // Config
  const AUDIO_SRC = window.AUDIO_SRC || 'assets/audio/audioinvite.mp3';
  const TARGET_DATE = new Date(2026, 7, 19, 18, 30, 0); // months are 0-based

  // Audio element: prefer the <audio id="bg-audio"> in the DOM so mobile gestures work reliably
  let audio = document.getElementById('bg-audio');
  if (!audio) {
    audio = new Audio(AUDIO_SRC);
    audio.preload = 'auto';
  }
  try { audio.loop = true; } catch(e){}
  try { audio.playsInline = true; } catch(e){}
  audio.volume = 0.85;

  // Lenis smooth scrolling
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;
  if (!prefersReduced && window.Lenis) {
    lenis = new Lenis({duration:1.8,easing: t => Math.min(1,1.001 - Math.pow(2, -8 * t))});
    function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }

  // GSAP animations for popup and interactions
  const startBtn = document.getElementById('start-btn');
  startBtn.innerHTML = 'Enter Celebration <span aria-hidden="true">✦</span>';
  const scrollHint = document.createElement('span');
  scrollHint.className = 'scroll-hint';
  scrollHint.setAttribute('aria-hidden', 'true');
  scrollHint.innerHTML = 'Scroll down <span>↓</span>';
  startBtn.insertAdjacentElement('afterend', scrollHint);
  const popup = document.getElementById('music-popup');
  const dropOrnament = document.querySelector('.drop-ornament');
  const confettiColors = ['#d6a44d', '#f5dfaf', '#7b151c', '#b97821'];
  dropOrnament.innerHTML = Array.from({length: 96}, (_, index) => {
    const size = 4 + Math.floor(Math.random() * 7);
    const delay = (Math.random() * 1.1).toFixed(2);
    const duration = (2.1 + Math.random() * 1.15).toFixed(2);
    const drift = -75 + Math.floor(Math.random() * 150);
    const spin = -420 + Math.floor(Math.random() * 840);
    const color = confettiColors[index % confettiColors.length];
    const round = index % 3 === 0 ? '50%' : '1px';
    return `<span style="--x:${Math.random() * 100}%;--size:${size}px;--delay:${delay}s;--duration:${duration}s;--drift:${drift}px;--spin:${spin}deg;--color:${color};--round:${round}"></span>`;
  }).join('');
  const panels = Array.from(document.querySelectorAll('.panel'));
  const mapsBtn = document.getElementById('maps-btn');

  // Show subtle entrance for countdown and maps button
  gsap.from('#countdown', {y:-10, autoAlpha:0, duration:0.8, delay:0.6, ease:'power2.out'});
  gsap.from('#maps-btn', {y:10, autoAlpha:0, duration:0.8, delay:0.8, ease:'power2.out'});

  // Popup interactions
  function openPopup(){
    popup.style.display = 'flex';
    gsap.fromTo(popup.querySelector('.popup-content'), {scale:0.96, autoAlpha:0}, {scale:1, autoAlpha:1, duration:0.75, ease:'power3.out'});
  }
  function closePopup(){
    gsap.to(popup, {autoAlpha:0, duration:0.6, onComplete:()=>{ popup.style.display='none'; }});
  }

  function scrollToNextPanel(){
    const next = document.querySelector('.panel[data-index="2"]');
    if (!next) return;
    const targetY = window.scrollY + next.getBoundingClientRect().top;
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(targetY, {offset:0, duration:2.4});
    } else {
      try{ window.scrollTo({top: targetY, behavior:'smooth'}); }catch(e){ window.scrollTo(0, targetY); }
    }
  }

  startBtn.addEventListener('click', async () => {
    if (startBtn.disabled) return;
    startBtn.disabled = true;
    try {
      await audio.play();
    } catch(e){
      // play may fail silently; it's fine
    }
    // Close the welcome first, then let dense confetti fall over the invitation.
    document.body.append(dropOrnament);
    closePopup();
    setTimeout(() => {
      dropOrnament.classList.add('is-dropping');
    }, 650);
    // The visitor scrolls naturally through the invitation, one section at a time.
  });

  // Auto-scroll controller: advance panels one-by-one gently
  const AUTO_INTERVAL = 3800; // time between automatic advances
  let autoState = { running:false, timer:null, currentIndex:1 };

  function scrollToPanelIndex(idx){
    const node = document.querySelector(`.panel[data-index="${idx}"]`);
    if (!node) return;
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(node, {offset:0, duration:1.1});
    } else {
      node.scrollIntoView({behavior:'smooth'});
    }
  }

  function startAutoScroll(fromIndex){
    if (autoState.running) return;
    autoState.running = true;
    autoState.currentIndex = fromIndex || 1;
    function step(){
      if (!autoState.running) return;
      autoState.currentIndex += 1;
      const target = document.querySelector(`.panel[data-index="${autoState.currentIndex}"]`);
      if (target) {
        scrollToPanelIndex(autoState.currentIndex);
        autoState.timer = setTimeout(step, AUTO_INTERVAL);
      } else {
        // reached end: stop
        stopAutoScroll();
      }
    }
    // delay first advance to let users absorb initial section
    autoState.timer = setTimeout(step, AUTO_INTERVAL);
  }

  function stopAutoScroll(){
    autoState.running = false;
    if (autoState.timer) { clearTimeout(autoState.timer); autoState.timer = null; }
  }

  // Stop auto-scroll on user interaction
  ['touchstart','wheel','pointerdown','keydown'].forEach(evt=>{
    window.addEventListener(evt, ()=>{
      stopAutoScroll();
      stopVideoScroll();
    }, {passive:true});
  });

  // Start auto-scroll after user clicks start: begin from panel 1 (advance to 2 then onward)
  startBtn.addEventListener('click', ()=>{
    // start continuous video-like auto-scroll after entering (2s delay)
    setTimeout(()=> startVideoScroll(), 2000);
  });

  // Continuous "video-like" auto-scroll
  const videoState = { running:false, rafId:null, lastTime:0, speed:0 };
  function startVideoScroll(){
    if (videoState.running) return;
    videoState.running = true;
    videoState.speed = window.innerHeight / 12; // one screen every ~12s for a softer flow
    videoState.lastTime = performance.now();
    function tick(t){
      const dt = t - videoState.lastTime;
      videoState.lastTime = t;
      const delta = videoState.speed * (dt/1000);
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const currentY = window.scrollY;
      const targetY = Math.min(maxY, currentY + delta);
      const smoothY = currentY + (targetY - currentY) * 0.65;
      window.scrollTo({top: smoothY, left:0, behavior:'auto'});
      if (smoothY >= maxY) { stopVideoScroll(); return; }
      videoState.rafId = requestAnimationFrame(tick);
    }
    videoState.rafId = requestAnimationFrame(tick);
  }
  function stopVideoScroll(){
    videoState.running = false;
    if (videoState.rafId) { cancelAnimationFrame(videoState.rafId); videoState.rafId = null; }
  }

  // Map button
  mapsBtn.addEventListener('click', (e)=>{ e.preventDefault(); window.open('https://www.google.com/maps/place/5WPQ%2B7CG+قاعة+اللوتس+نادي+الشرطة،+المعسكر,+Abis,+Moharam+Bek,+Alexandria+Governorate+5411450%E2%80%AD/@31.1874898,29.9391415,17z/data=!4m6!3m5!1s0x14f5c300634f5897:0xc547e49990f9b43c!8m2!3d31.1856863!4d29.9385729!16s%2Fg%2F11zch2f_pq?g_ep=Eg1tbF8yMDI2MDcyOF8wIOC7DCoASAJQAQ%3D%3D','_blank'); });

  // Section reveal using IntersectionObserver + GSAP
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        gsap.fromTo(entry.target, {autoAlpha:0, scale:0.995, y:8}, {autoAlpha:1, scale:1, y:0, duration:0.9, ease:'power3.out'});
      }
    });
  }, {threshold:0.25});
  panels.forEach(p => obs.observe(p));

  // Countdown
  function updateCountdown(){
    const now = new Date();
    let diff = Math.max(0, TARGET_DATE - now);
    const days = Math.floor(diff / (1000*60*60*24));
    diff -= days * (1000*60*60*24);
    const hours = Math.floor(diff / (1000*60*60));
    diff -= hours * (1000*60*60);
    const minutes = Math.floor(diff / (1000*60));
    diff -= minutes * (1000*60);
    const seconds = Math.floor(diff / 1000);
    function pad(n){ return n.toString().padStart(2,'0'); }
    document.getElementById('days').textContent = days;
    document.getElementById('hours').textContent = pad(hours);
    document.getElementById('minutes').textContent = pad(minutes);
    document.getElementById('seconds').textContent = pad(seconds);
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Small interactive micro-animations
  mapsBtn.addEventListener('mouseenter', ()=> gsap.to('#maps-btn', {scale:1.04,duration:0.18}));
  mapsBtn.addEventListener('mouseleave', ()=> gsap.to('#maps-btn', {scale:1,duration:0.18}));
  startBtn.addEventListener('mouseenter', ()=> gsap.to(startBtn, {scale:1.03,duration:0.15}));
  startBtn.addEventListener('mouseleave', ()=> gsap.to(startBtn, {scale:1,duration:0.15}));

  // If popup should show on load, open it
  document.addEventListener('DOMContentLoaded', ()=>{
    openPopup();
  });

})();
