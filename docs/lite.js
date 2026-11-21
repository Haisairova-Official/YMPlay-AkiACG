const motion = matchMedia('(prefers-reduced-motion: reduce)');
const digit = document.querySelector('#price-digit');
let priceTimer;

function schedulePrice() {
  clearTimeout(priceTimer);
  if (document.hidden || motion.matches) {
    digit.style.transform = '';
    return;
  }
  priceTimer = setTimeout(() => {
    digit.textContent = digit.textContent === '5' ? '4' : '5';
    // A brief horizontal misalignment reads as a glitch without flashing the whole price.
    digit.style.transform = Math.random() < .22 ? 'translateX(-.035em)' : '';
    schedulePrice();
  }, 10 + Math.floor(Math.random() * 291));
}
schedulePrice();
motion.addEventListener('change', schedulePrice);
document.addEventListener('visibilitychange', schedulePrice);

async function revealController() {
  const figure = document.querySelector('.silhouette');
  const source = figure.querySelector('img');
  const canvas = document.querySelector('#starfield');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await source.decode();

  const width = source.naturalWidth;
  const height = source.naturalHeight;
  const sample = document.createElement('canvas');
  sample.width = width;
  sample.height = height;
  const sampler = sample.getContext('2d', { willReadFrequently: true });
  sampler.drawImage(source, 0, 0);
  const rgba = sampler.getImageData(0, 0, width, height).data;
  function read(x, y, channel) {
    return rgba[(Math.round(y) * width + Math.round(x)) * 4 + channel] / 255;
  }
  function luminance(x, y) {
    return read(x, y, 1) * read(x, y, 3);
  }

  const particles = [];
  for (let y = 14; y < height - 14; y += 3) {
    for (let x = 14; x < width - 14; x += 3) {
      // Retain the glass edge, the key rims and a little suspended dust. Leave flat surfaces empty.
      const rim = Math.hypot(read(x+10,y,3)-read(x-10,y,3), read(x,y+10,3)-read(x,y-10,3));
      const detail = Math.hypot(luminance(x+10,y)-luminance(x-10,y), luminance(x,y+10)-luminance(x,y-10));
      // The eight radial seams are only a few source pixels wide after diffusion.
      const cx = x - width * .5;
      const cy = y - height * .612;
      const radius = Math.hypot(cx,cy);
      const seamDistance = Math.abs(Math.sin(4*Math.atan2(cy,cx))) * radius / 4;
      const keySeam = radius > 178 && radius < 225 ? Math.exp(-seamDistance*seamDistance/13) * .64 : 0;
      const weight = Math.min(.84, rim * .45 + detail * 4.3 + keySeam * .55);
      if (Math.random() > weight ** 1.35 + .0008 * read(x,y,3)) continue;
      const angle = Math.random() * Math.PI * 2;
      const halo = Math.random() < .40 ? 94 : 36;
      particles.push({ x: (x + Math.cos(angle)*halo*Math.random()) / width,
        y: (y + Math.sin(angle)*halo*Math.random()) / height,
        startX: Math.random(), startY: Math.random(), phase: angle, depth: Math.random(),
        lag: Math.random() * .24, size: .48 + Math.random() ** 2 * 1.45,
        alpha: (.19 + Math.random()*.6) * (.5 + weight*.5) });
    }
  }
  const dust = Array.from({length: 135}, () => ({
    x: Math.random(), y: Math.random(), phase: Math.random()*Math.PI*2, size: .45 + Math.random()*.85
  }));

  const stars = particles.concat(dust);
  for (const star of stars) {
    Object.assign(star, { driftX: 0, driftY: 0, offsetX: 0, offsetY: 0, vx: 0, vy: 0, px: 0, py: 0 });
  }
  let pointer = null;
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  function clearPointer() { pointer = null; }
  document.documentElement.addEventListener('pointerleave', clearPointer);
  window.addEventListener('blur', clearPointer);
  window.addEventListener('pointerdown', event => {
    if (motion.matches || event.button !== 0 || event.target.closest('a, summary, button')) return;
    const radius = Math.min(112, w * .23);
    for (const star of stars) {
      const dx = star.px - event.clientX, dy = star.py - event.clientY;
      const distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      const impulse = 260 * (1 - distance / radius) ** 1.3 / Math.max(1, distance);
      star.vx = Math.max(-330, Math.min(330, star.vx + dx * impulse));
      star.vy = Math.max(-330, Math.min(330, star.vy + dy * impulse));
    }
  }, { passive: true });

  let w, h, bounds, frame, elapsed = 0, previous = null;
  function measure() {
    bounds = figure.getBoundingClientRect();
    w = document.documentElement.clientWidth;
    h = window.innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w*dpr);
    canvas.height = Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    paint();
  }
  function paint(dt = 0) {
    const diffusion = 3.2 * Math.sqrt(dt);
    const attraction = Math.exp(-dt * .72);
    const friction = Math.exp(-dt * 3.3);
    const follow = 1 - Math.exp(-dt * 4.8);
    const hoverRadius = Math.min(54, w * .12);

    function move(star, x, y) {
      if (dt > 0) {
        // Mean-reverting Brownian motion keeps the silhouette loose without letting it dissolve.
        star.driftX = star.driftX * attraction + (Math.random() + Math.random() - 1) * diffusion * 2.45;
        star.driftY = star.driftY * attraction + (Math.random() + Math.random() - 1) * diffusion * 2.45;
        const dx = pointer ? x + star.driftX - pointer.x : hoverRadius;
        const dy = pointer ? y + star.driftY - pointer.y : 0;
        const distance = Math.hypot(dx, dy);
        const repulsion = 26 * Math.max(0, 1 - distance / hoverRadius) ** 1.3 / Math.max(1, distance);
        star.offsetX += (dx * repulsion - star.offsetX) * follow + star.vx * dt;
        star.offsetY += (dy * repulsion - star.offsetY) * follow + star.vy * dt;
        star.vx *= friction;
        star.vy *= friction;
      }
      star.px = x + star.driftX + star.offsetX;
      star.py = y + star.driftY + star.offsetY;
    }
    const t = motion.matches ? 9 : elapsed;
    const opening = .83 + .17 * (1 - (1 - Math.min(t, 1)) ** 3);
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#cde2ec';
    for (const star of dust) {
      ctx.globalAlpha = .19 + .025 * Math.sin(star.phase+t*.28);
      move(star, star.x*w, star.y*h);
      ctx.fillRect(star.px, star.py, star.size, star.size);
    }
    for (const p of particles) {
      const u = motion.matches ? 1 : Math.max(0, Math.min(1, (t - .95 - p.lag*4) / 5.3));
      const mix = u*u*(3-2*u);
      const tx = bounds.left + p.x*bounds.width;
      const ty = bounds.top + p.y*bounds.height;
      const arc = Math.sin(Math.PI*mix);
      const x = (1-mix)*(.5+(p.startX-.5)*opening)*w + mix*tx + arc*Math.cos(p.phase)*w*.10;
      const y = (1-mix)*(.5+(p.startY-.5)*opening)*h + mix*ty + arc*Math.sin(p.phase)*h*.11;
      const radius = p.size * (1-mix*.20);
      ctx.globalAlpha = Math.min(1, (.32 + p.alpha*.64 + .035*Math.sin(p.phase+t*(.16+p.depth*.3))) * (1-.12*mix));
      move(p, x, y);
      ctx.fillRect(p.px,p.py,radius,radius);
      if (p.depth > .967) {
        ctx.globalAlpha *= .14;
        ctx.fillRect(p.px-radius*1.6,p.py-radius*1.6,radius*4.2,radius*4.2);
      }
    }
    ctx.globalAlpha=1;
  }
  function tick(now) {
    const dt = previous === null ? 0 : Math.min(now-previous, 80)/1000;
    elapsed += dt;
    previous = now;
    paint(dt);
    frame=requestAnimationFrame(tick);
  }
  function resume() {
    cancelAnimationFrame(frame);
    previous=null;
    paint();
    if (!motion.matches && !document.hidden) frame=requestAnimationFrame(tick);
  }
  measure();
  figure.dataset.ready = '';
  new ResizeObserver(measure).observe(figure);
  window.addEventListener('resize',measure);
  window.addEventListener('scroll',()=>{bounds=figure.getBoundingClientRect(); if(motion.matches)paint();},{passive:true});
  document.addEventListener('visibilitychange',resume);
  motion.addEventListener('change',resume);
  resume();
}
revealController().catch(() => { /* CSS supplies a dotted preview if canvas is unavailable. */ });
