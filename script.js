// Gated page router (+ top step nav)
// You can always go BACK, but a step only unlocks once the current step's
// answer is submitted. maxUnlocked lives in memory, so a refresh restarts
// the flow from step 1 (matching the HTML default).
const pages = document.querySelectorAll('.page');
const steps = document.querySelectorAll('.step');
let maxUnlocked = 1;

function syncSteps(active) {
  steps.forEach(s => {
    const n = Number(s.dataset.go);
    const locked = n > maxUnlocked;
    s.classList.toggle('locked', locked);
    s.disabled = locked;
    s.classList.toggle('active', String(n) === String(active));
  });
}

function unlock(n) {
  n = Number(n);
  if (n > maxUnlocked) {
    maxUnlocked = n;
    syncSteps(document.querySelector('.page.active')?.id?.replace('page-', '') || '1');
  }
}

function showPage(n) {
  n = Number(n);
  if (n > maxUnlocked) return false; // locked — answer the current step first
  pages.forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${n}`).classList.add('active');
  syncSteps(n);
  window.scrollTo(0, 0);
  if (n === 4) startTulipRain(4000); // rain even if they nav back here
  return true;
}

// Nav pills: guarded by showPage, locked ones are disabled anyway
steps.forEach(s => s.addEventListener('click', () => showPage(s.dataset.go)));

// Advancing actions — each unlocks exactly the next step:
// page 1 Yes / Yes, of course -> step 2
document.querySelectorAll('#page-1 [data-go]').forEach(b =>
  b.addEventListener('click', () => { unlock(2); showPage(2); }));
// page 2 okay -> step 3
document.querySelectorAll('#page-2 [data-go]').forEach(b =>
  b.addEventListener('click', () => { unlock(3); showPage(3); }));
// page 4 let's plan it -> step 5
document.querySelectorAll('#page-4 [data-go]').forEach(b =>
  b.addEventListener('click', () => { unlock(5); showPage(5); }));

syncSteps(1);

// ---- Runaway "No" button ----
const noBtn = document.getElementById('no-btn');
const yesBtn = document.getElementById('yes-btn');
let dodges = 0;
let noFixed = false;

function dodgeNo(e) {
  if (e && e.cancelable) e.preventDefault();
  dodges++;

  // After first dodge, pin it to viewport so it can jump anywhere on screen
  if (!noFixed) {
    noBtn.style.position = 'fixed';
    noBtn.style.zIndex = '60';
    noFixed = true;
  }

  const pad = 12;
  const r = noBtn.getBoundingClientRect();
  const maxX = Math.max(pad, window.innerWidth - r.width - pad);
  const maxY = Math.max(pad, window.innerHeight - r.height - pad);
  const x = Math.random() * maxX;
  const y = Math.random() * maxY;

  noBtn.style.left = `${x}px`;
  noBtn.style.top = `${y}px`;
  noBtn.style.right = 'auto';
  noBtn.style.bottom = 'auto';

  // Make Yes irresistible — grows with NO cap, takes the full row so it
  // can genuinely cover the page width if they keep chasing No
  const scale = 1 + dodges * 0.25;
  yesBtn.style.transform = `scale(${scale})`;
  if (dodges >= 2) yesBtn.style.flex = '1 1 100%';
  // No button text stays exactly as-is — it just jumps away
}

// Desktop hover, mouse press, mobile tap, keyboard focus all trigger a
// dodge. Click is captured so it can never actually activate.
// (pointerdown + touchstart are what make it jump on phones — mobile
// safari often never fires mouseover for taps.)
['pointerdown', 'pointerenter', 'mouseover', 'touchstart', 'focus'].forEach(evt =>
  noBtn.addEventListener(evt, dodgeNo, { passive: false })
);
noBtn.addEventListener('click', dodgeNo);

// ---- Tulip rain from ALL edges (perf-friendly canvas) ----
// Why the old version tanked: 400 live emoji drawn with fillText every
// frame (emoji rasterization is very expensive), set per-particle, plus a
// per-frame array copy via filter(), running forever at full DPR.
// Fix: pre-render each emoji ONCE to an offscreen sprite and drawImage it
// (GPU-cheap), cap at ~110 particles, cap DPR at 1.5, delta-time movement,
// in-place culling, and auto-stop after ~7s.
const canvas = document.getElementById('rain');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
let W = 0, H = 0;

function sizeCanvas() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);
if (window.visualViewport) window.visualViewport.addEventListener('resize', sizeCanvas); // mobile safari toolbar/zoom
window.addEventListener('orientationchange', () => setTimeout(sizeCanvas, 100));

// Pre-render emoji sprites once — the big perf win (no fillText in loop).
// Tulips are drawn (not emoji) so we get EXACTLY the requested palette —
// red, orange, yellow, purple, cornflower blue, pink — with green stems on
// every browser, no hue-rotate support needed.
function makeSprite(ch, filter) {
  const s = document.createElement('canvas');
  s.width = 72; s.height = 72;
  const c = s.getContext('2d');
  if (filter) c.filter = filter;
  c.font = '56px serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(ch, 36, 40);
  return s;
}

// Simple cute tulip: green stem + leaf, two dark side petals, bright front
// petal, zigzag crown on top. Drawn once per color at 72px.
function makeTulipSprite(main, dark) {
  const s = document.createElement('canvas');
  s.width = 72; s.height = 72;
  const c = s.getContext('2d');
  // stem
  c.strokeStyle = '#388E3C';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(36, 70);
  c.quadraticCurveTo(33, 56, 36, 42);
  c.stroke();
  // leaf
  c.fillStyle = '#43A047';
  c.save();
  c.translate(35, 60);
  c.rotate(0.5);
  c.beginPath();
  c.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // side petals
  c.fillStyle = dark;
  c.beginPath(); c.ellipse(26, 33, 8.5, 15, -0.28, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(46, 33, 8.5, 15, 0.28, 0, Math.PI * 2); c.fill();
  // front petal
  c.fillStyle = main;
  c.beginPath(); c.ellipse(36, 34, 11, 16, 0, 0, Math.PI * 2); c.fill();
  // crown zigzag
  c.beginPath();
  c.moveTo(26, 24); c.lineTo(30, 13); c.lineTo(34, 23);
  c.lineTo(36, 12); c.lineTo(40, 23); c.lineTo(44, 24);
  c.lineTo(44, 28); c.lineTo(26, 28);
  c.closePath(); c.fill();
  return s;
}

const TULIP_COLORS = [
  ['#EF3B36', '#B71C1C'], // red
  ['#FF8F00', '#E65100'], // orange
  ['#FFD600', '#F9A825'], // yellow
  ['#9D4EDD', '#7B2CBF'], // purple
  ['#6495ED', '#4169C7'], // cornflower blue
  ['#F181B2', '#D6568F'], // pink (theme pink)
];
const tulipSprites = TULIP_COLORS.map(([main, dark]) => makeTulipSprite(main, dark));
const hopperSprite = makeSprite('🦗'); // the one and only grasshopper

function pickRainSprite() {
  return tulipSprites[(Math.random() * tulipSprites.length) | 0]; // tulips only
}

const MAX_PARTICLES = 110;
const RAIN_MS = 7000; // auto-stop: burst then let them fall out
let particles = [];
let raining = false;
let rafId = 0;
let lastTs = 0;
let stopSpawningAt = 0;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function spawnTulip(anywhere = false) {
  const size = 22 + Math.random() * 26;
  const p = {
    size,
    sprite: pickRainSprite(),
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.06,
    sway: Math.random() * Math.PI * 2,
    x: 0, y: 0, vx: 0, vy: 0,
  };
  const speed = 2 + Math.random() * 2.5;
  if (anywhere) {
    // prefill across the screen so rain looks instant, not ramped
    p.x = Math.random() * W;
    p.y = Math.random() * H;
    p.vx = (Math.random() - 0.5) * 1;
    p.vy = 1 + Math.random() * 2.5;
    return p;
  }
  const edge = (Math.random() * 4) | 0; // 0 top, 1 left, 2 right, 3 bottom
  if (edge === 0) {
    p.x = Math.random() * W; p.y = -40;
    p.vx = (Math.random() - 0.5) * 1; p.vy = speed;
  } else if (edge === 1) {
    p.x = -40; p.y = Math.random() * H;
    p.vx = speed; p.vy = (Math.random() - 0.5) * 1;
  } else if (edge === 2) {
    p.x = W + 40; p.y = Math.random() * H;
    p.vx = -speed; p.vy = (Math.random() - 0.5) * 1;
  } else {
    p.x = Math.random() * W; p.y = H + 40;
    p.vx = (Math.random() - 0.5) * 1; p.vy = -speed;
  }
  return p;
}

function tick(ts) {
  if (!raining) return;
  const dt = Math.min(Math.max((ts - lastTs) / 16.7, 0.5), 3);
  lastTs = ts;
  ctx.clearRect(0, 0, W, H);

  // spawn: brisk for first ~2s, trickle after, none after RAIN_MS
  if (Date.now() < stopSpawningAt && particles.length < MAX_PARTICLES) {
    const n = particles.length < 60 ? 3 : 1;
    for (let i = 0; i < n; i++) particles.push(spawnTulip());
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.sway += 0.03 * dt;
    p.x += (p.vx + Math.sin(p.sway) * 0.7) * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    if (p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) {
      particles[i] = particles[particles.length - 1];
      particles.pop();
      continue;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }

  // done when spawning stopped AND everything fell out
  if (Date.now() > stopSpawningAt && particles.length === 0) {
    raining = false;
    ctx.clearRect(0, 0, W, H);
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function spawnHopper() {
  const p = spawnTulip(); // rides in from a random edge like everything else
  p.sprite = hopperSprite;
  p.size = 42;
  p.isHopper = true;
  return p;
}

function ensureHopper() {
  if (!particles.some(p => p.isHopper)) particles.push(spawnHopper());
}

function drawStatic(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
  ctx.restore();
}

function startTulipRain(encoreMs = RAIN_MS) {
  if (reduceMotion) {
    // static confetti, no loop — tulips + the grasshopper
    sizeCanvas();
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 23; i++) drawStatic(spawnTulip(true));
    drawStatic(spawnHopper());
    return;
  }
  if (raining) {
    stopSpawningAt = Math.max(stopSpawningAt, Date.now() + Math.min(encoreMs, 3000));
    ensureHopper();
    return;
  }
  raining = true;
  // instant full sky: prefill 70 across screen, rest spawn from edges
  particles = [];
  for (let i = 0; i < 70; i++) particles.push(spawnTulip(true));
  ensureHopper(); // exactly 1 grasshopper per shower
  stopSpawningAt = Date.now() + encoreMs;
  lastTs = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

// pause when tab hidden so it never burns CPU in background
document.addEventListener('visibilitychange', () => {
  if (document.hidden && raining) {
    raining = false;
    cancelAnimationFrame(rafId);
    particles = [];
    ctx.clearRect(0, 0, W, H);
  }
});

yesBtn.addEventListener('click', () => {
  unlock(4); // saying yes is the answer that opens step 4
  startTulipRain(); // full burst, auto-stops after ~7s
  showPage(4);
});

// ---- Date picker + owner notification ----
// HOW TO GET NOTIFIED: put your email below, host the site (e.g. GitHub
// Pages / Netlify — not just file://), submit once yourself, then click the
// activation email FormSubmit sends you. After that, every "it's a date!"
// submit lands in your inbox. No signup, no backend, still just html+js.
const NOTIFY_EMAIL = "anhad26sharma@gmail.com";

// Client-side rate limit: max 15 sends per 15 min on this device.
// (Honest limit of static hosting: this stops one phone/browser spamming
// you. True per-network limiting needs a server — e.g. Cloudflare rate
// rules in front of GitHub Pages. Happy to set that up when you push.)
const RATE_MAX = 15;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_KEY = 'dateNotifyLog';

function checkRateLimit() {
  try {
    const now = Date.now();
    const log = JSON.parse(localStorage.getItem(RATE_KEY) || '[]')
      .filter(t => typeof t === 'number' && now - t < RATE_WINDOW_MS);
    if (log.length >= RATE_MAX) {
      const retryMin = Math.ceil((log[0] + RATE_WINDOW_MS - now) / 60000);
      return { blocked: true, retryMin };
    }
    log.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(log));
    return { blocked: false };
  } catch {
    return { blocked: false }; // storage unavailable (private mode) — don't break the site
  }
}

let chosen = null;
let saturdayNudges = 0; // first Saturday submit gets the Sunday nudge, second one is accepted
document.querySelectorAll('.date-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.date-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    chosen = card.dataset.value;
  });
});

document.getElementById('submit-btn').addEventListener('click', async () => {
  const when = document.getElementById('when').value.trim();
  const msg = document.getElementById('final-msg');
  const btn = document.getElementById('submit-btn');
  if (!chosen) {
    msg.classList.remove('hidden');
    msg.textContent = 'pick one of the 4 dates first!! 👆';
    return;
  }
  if (!when) {
    msg.classList.remove('hidden');
    msg.textContent = 'tell me the day + time below too!! 🌷';
    return;
  }
  if (when.toLowerCase().includes('saturday')) {
    saturdayNudges++;
    if (saturdayNudges < 2) {
      msg.classList.remove('hidden');
      msg.textContent = 'Please, on Sunday we will have more time. Pick a Sunday instead! 🌷🌷';
      return;
    }
    saturdayNudges = 0; // they insisted — accept it this time
  } else {
    saturdayNudges = 0;
  }
  const rate = checkRateLimit();
  if (rate.blocked) {
    msg.classList.remove('hidden');
    msg.textContent = `whoa, easy!! too many sends — try again in ~${rate.retryMin} min 🌷`;
    return;
  }
  const summary = `it's a date!! ${chosen} — ${when} 🌷🌷 can't wait!!`;
  msg.classList.remove('hidden');
  msg.textContent = summary;
  startTulipRain(3000); // short encore, not another full 7s blast

  if (!NOTIFY_EMAIL) return; // owner hasn't set their email yet — summary on screen is all
  btn.disabled = true;
  msg.textContent = summary + ' (sending... 🌷)';
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(NOTIFY_EMAIL)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `🌷 date picked: ${chosen} — ${when}`,
        date: chosen,
        when: when,
      }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    msg.textContent = summary + " yay, I've been notified!! 🌷";
  } catch {
    msg.textContent = summary + ' (oops, notify failed — screenshot this and send it to me!! 📸)';
  } finally {
    btn.disabled = false;
  }
});
