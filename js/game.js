/* Love Racket game. Rally engine, leaderboard and score logging. */
(() => {
const CONFIG = window.LR_CONFIG;

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS = {
  get(k, d){ try{ const v = localStorage.getItem('lr_'+k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('lr_'+k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem('lr_'+k); }catch(e){} }
};
const cutoffMs = new Date(CONFIG.CUTOFF).getTime();
const sleep = ms => new Promise(r => setTimeout(r, ms));

let me = LS.get('me', null);              // {email, name, best}
let pending = LS.get('pending', null);    // best unlogged run {score, duration, token}
let guestPlays = LS.get('guestPlays', 0); // games played before logging in
let localBest = LS.get('best', 0);
let pendingEmail = '';
let attempt = null;                       // {run, name, via}
let lastBoard = null;

document.querySelectorAll('.lg').forEach(i => { if (!i.getAttribute('src')) i.src = CONFIG.LOGO; });
document.querySelectorAll('.tix-link').forEach(a => a.href = CONFIG.TICKET_URL);
if (!CONFIG.API_URL) { const d = document.createElement('div'); d.className = 'demo'; d.textContent = 'Demo mode: scores stay in this browser'; document.body.appendChild(d); }

/* ================= API ================= */
async function api(action, data){
  if (!CONFIG.API_URL) { await sleep(action === 'token' ? 30 : 700); return Mock[action](data || {}); }
  const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ action }, data || {})) });
  if (!res.ok) throw new Error('net');
  return res.json();
}
const Mock = {
  db(){ return LS.get('mockdb', {}); },
  token(){ return { ok: true, token: 'demo-' + Date.now() }; },
  board(d){
    const rows = Object.values(this.db()).sort((a, b) => b.best - a.best || a.at - b.at);
    const r = { ok: true, top: rows.slice(0, 5).map(p => ({ name: p.name, score: p.best })), total: rows.length, closed: Date.now() >= cutoffMs };
    if (Number.isFinite(d.best)) r.rank = 1 + rows.filter(p => p.best > d.best).length;
    return r;
  },
  submit(d){
    if (Date.now() >= cutoffMs) return { ok: false, closed: true, error: 'The leaderboard is closed.' };
    const email = String(d.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Enter a valid email.' };
    const db = this.db(); let p = db[email]; const existing = !!p;
    if (!p) { if (!d.name) return { ok: true, needName: true }; p = db[email] = { name: d.name, best: -1, games: 0, at: Date.now() }; }
    const isNewBest = d.score > p.best;
    if (isNewBest) { p.best = d.score; p.at = Date.now(); }
    p.games += 1 + (d.extraPlays || 0);
    LS.set('mockdb', db);
    const b = this.board({ best: p.best });
    return { ok: true, existing, name: p.name, best: p.best, isNewBest, score: d.score, rank: b.rank, total: b.total, top: b.top };
  }
};

/* ================= LEADERBOARD ================= */
function renderBoard(r){
  if (!r || !r.ok || !r.top) return;
  lastBoard = r;
  let h = '';
  for (let i = 0; i < 5; i++) {
    const p = r.top[i];
    const mine = me && p && p.name === me.name && p.score === me.best;
    h += `<li class="${p ? '' : 'empty'}${mine ? ' mine' : ''}"><span class="rk">${i + 1}</span><span class="nm">${p ? esc(p.name) : 'Open spot'}</span><span class="sc">${p ? p.score : '-'}</span></li>`;
  }
  $('#top').innerHTML = h;
  $('#total').textContent = r.total ? `· ${r.total} player${r.total === 1 ? '' : 's'}` : '';
  const row = $('#meRow');
  if (me && r.rank && r.rank > 5) {
    row.innerHTML = `<span class="rk">${r.rank}</span><span class="nm">You, ${esc(me.name)}</span><span class="sc">${me.best}</span>`;
    row.classList.remove('hidden');
  } else row.classList.add('hidden');
}
async function refreshBoard(){
  try { renderBoard(await api('board', me ? { best: me.best } : {})); } catch(e) {}
}
setInterval(() => { if (!document.hidden) refreshBoard(); }, CONFIG.POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBoard(); });

function tick(){
  const ms = cutoffMs - Date.now();
  if (ms <= 0) { $('#cd').textContent = 'Closed'; return; }
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  $('#cd').textContent = `${d}d ${h}h ${m}m ${String(s).padStart(2, '0')}s`;
}
setInterval(tick, 1000); tick();

function renderWho(){
  const w = $('#who');
  if (me) {
    w.innerHTML = `Playing as <b>${esc(me.name)}</b>, best ${me.best}. <button class="link" id="notMe" type="button">Not you?</button>`;
    $('#notMe').onclick = () => { me = null; LS.del('me'); renderWho(); refreshBoard(); };
  } else w.textContent = 'Play first, then log your score with your email.';
}

/* ================= GAME OVER FLOW ================= */
function rankLines(r){
  if (!r || !r.rank) return '';
  let s = `<div class="rank">You're #${r.rank}${r.total ? ' of ' + r.total : ''}</div>`;
  if (r.rank <= 5) s += `<div class="gap">You're in the top 5. Hold your spot.</div>`;
  else if (r.top && r.top[4]) s += `<div class="gap">${r.top[4].score - r.best + 1} points to the top 5</div>`;
  return s;
}
function setOver(state, d){
  const b = $('#oBody'); const again = $('#again'); let h = '';
  again.disabled = state === 'checking';
  if (state === 'ask') {
    const note = pending && attempt === null && pending.score > G.lastScore ? `<div class="gap">We'll log your best run so far: ${pending.score}</div>` : '';
    h = `<div class="hint">Log your score for a shot at the top 5.</div>${note}
      <form class="row" id="fEmail" novalidate><input type="email" name="email" placeholder="Your email" autocomplete="email" inputmode="email" value="${esc(pendingEmail)}"><button class="btn" type="submit">Submit</button></form>`;
  } else if (state === 'checking') {
    h = `<div class="loader"><i></i><i></i><i></i></div><div class="gap">Checking the scoreboard...</div>`;
  } else if (state === 'new') {
    h = `<div class="hint"><b>New player.</b> Input your player name and start playing.</div>
      <form class="row" id="fName" novalidate><input name="name" maxlength="18" placeholder="Player name" autocomplete="nickname"><button class="btn" type="submit">Log score</button></form>
      <button class="link" id="back" type="button">Use a different email</button>`;
  } else if (state === 'welcome') {
    h = `<div class="hint"><b>We already have you, ${esc(d.name)}.</b> Score logged.</div>${d.isNewBest ? '<span class="pb">New personal best</span>' : ''}${rankLines(d)}`;
  } else if (state === 'logged') {
    h = `${d.isNewBest ? '<span class="pb">New personal best</span>' : '<div class="hint">Score logged.</div>'}${rankLines(d)}`;
  } else if (state === 'closed') {
    h = `<div class="hint">The leaderboard closed at 12 noon on 27 December. See you at Love Racket.</div>`;
  } else if (state === 'error') {
    h = `<div class="err">${esc(d || 'Something went wrong.')}</div><button class="btn" id="retry" type="button">Try again</button>`;
  }
  b.innerHTML = h;
  const fe = $('#fEmail');
  if (fe) fe.onsubmit = e => {
    e.preventDefault();
    const v = fe.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { fe.email.style.borderColor = 'var(--red)'; fe.email.focus(); return; }
    pendingEmail = v.toLowerCase();
    attempt = { run: pending, name: '', via: 'email' };
    logRun();
  };
  const fn = $('#fName');
  if (fn) { fn.name.focus({ preventScroll: true }); fn.onsubmit = e => {
    e.preventDefault();
    const v = fn.name.value.replace(/\s+/g, ' ').trim();
    if (v.length < 2) { fn.name.style.borderColor = 'var(--red)'; fn.name.focus(); return; }
    attempt.name = v.slice(0, 18); attempt.via = 'name';
    logRun();
  }; }
  const bk = $('#back'); if (bk) bk.onclick = () => { attempt = null; setOver('ask'); };
  const rt = $('#retry'); if (rt) rt.onclick = () => logRun();
}
async function logRun(){
  const email = me ? me.email : pendingEmail;
  const run = attempt.run;
  setOver('checking');
  try {
    const r = await api('submit', { email, name: attempt.name, score: run.score, duration: run.duration, token: run.token, extraPlays: me ? 0 : Math.max(0, guestPlays - 1) });
    if (!r.ok) { if (r.closed) return setOver('closed'); return setOver('error', r.error); }
    if (r.needName) { if (me) { me = null; LS.del('me'); renderWho(); } pendingEmail = email; return setOver('new'); }
    me = { email, name: r.name, best: r.best }; LS.set('me', me);
    pending = null; LS.del('pending'); guestPlays = 0; LS.set('guestPlays', 0);
    renderBoard(r); renderWho();
    LR.track('ScoreLogged', '/played/logged/', { rank: r.rank, score: r.score, newBest: !!r.isNewBest });
    setOver(attempt.via === 'email' && r.existing ? 'welcome' : 'logged', r);
    attempt = null;
  } catch(e) {
    setOver('error', 'Could not reach the scoreboard. Check your connection and try again.');
  }
}
$('#again').onclick = () => { $('#ovOver').classList.add('hidden'); startGame(); };

/* ================= GAME ================= */
const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage');
let logoImg = $('#logoImg');
if (!logoImg) { logoImg = new Image(); logoImg.src = CONFIG.LOGO; }
const W = 360, H = 480, CX = 16, CY = 14, CW = 328, CH = 452, PY = H - 64, OY = 64, R = 7, BASE = 290, MAXS = 700;
const PINK = '#F72A85', YELLOW = '#F6DF2A', GREEN = '#3BE08B', RED = '#FF4A4A', BG = '#1C0131';
let scale = 1;
function resize(){
  const r = cv.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); scale = cv.width / W;
}
addEventListener('resize', resize); resize();

const G = { state: 'idle', score: 0, lives: 3, streak: 0, boost: 0, returns: 0, speed: BASE, t0: 0, wait: 0, shake: 0, flash: 0, token: null, lastScore: 0,
  ball: { x: W / 2, y: PY - 16, vx: 0, vy: 0, live: false }, p: { x: W / 2, tx: W / 2, w: 76 }, o: { x: W / 2 }, items: [], pops: [], spawnT: 0 };
const mult = () => Math.min(5, 1 + Math.floor(G.streak / 4) + G.boost);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch(e) {} };
const pop = (x, y, text, col, big) => G.pops.push({ x, y, text, col, big, t: 0 });

const heartSVG = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
function hud(){
  $('#score').textContent = G.score === 0 ? 'LOVE' : G.score;
  $('#mult').textContent = 'x' + mult();
  $('#lives').innerHTML = [0, 1, 2].map(i => heartSVG.replace('<svg', `<svg class="${i < G.lives ? '' : 'off'}"`)).join('');
}

function aim(b, s){ const tx = CX + 30 + Math.random() * (CW - 60); b.vy = s; b.vx = (tx - b.x) / ((PY - b.y) / s); }
function serve(){ const b = G.ball; b.x = G.o.x; b.y = OY + R + 2; aim(b, G.speed); b.live = true; }

function startGame(){
  Object.assign(G, { state: 'play', score: 0, lives: 3, streak: 0, boost: 0, returns: 0, speed: BASE, t0: performance.now(), wait: .7, items: [], pops: [], spawnT: 2.5, token: null });
  G.p.w = 76; G.ball.live = false;
  $('#ovStart').classList.add('hidden'); $('#ovOver').classList.add('hidden');
  hud();
  if (!G.tracked) { G.tracked = 1; LR.track('GameStart', '/played/'); }
  api('token').then(r => { if (r && r.ok) G.token = r.token; }).catch(() => {});
}
function hit(off){
  const b = G.ball, s = G.speed;
  b.vx = clamp(off, -1, 1) * s * .75; b.vy = -s; b.y = PY - R;
  G.returns++; G.streak++;
  const m = mult(); G.score += m;
  pop(b.x, PY - 26, '+' + m, '#fff');
  if (G.streak % 4 === 0 && m < 5 && m > 1) pop(W / 2, H / 2 + 46, 'Chemistry x' + m, YELLOW, true);
  G.p.w = Math.max(52, 76 - G.returns * .5);
  vib(8); hud();
}
function miss(){
  G.lives--; G.streak = 0; G.boost = 0; G.ball.live = false; G.shake = 1;
  pop(W / 2, H - 120, G.lives ? 'Love lost' : 'Game, set, match', PINK, true);
  vib([30, 40, 30]); hud();
  if (G.lives <= 0) { G.state = 'done'; setTimeout(gameOver, 950); } else G.wait = 1;
}
function spawn(){
  let type;
  if (G.returns >= 6 && Math.random() < .36) type = 'red'; else type = Math.random() < .58 ? 'heart' : 'green';
  let y; do { y = 128 + Math.random() * (H - 276); } while (Math.abs(y - H / 2) < 24);
  G.items.push({ type, x: CX + 34 + Math.random() * (CW - 68), y, vx: (Math.random() < .5 ? -1 : 1) * (16 + Math.random() * 30), t: 0, life: 9 });
}
function collect(it){
  if (it.type === 'heart') { G.score += 5; pop(it.x, it.y - 16, '+5', PINK, true); vib(12); }
  else if (it.type === 'green') { G.boost = Math.min(4, G.boost + 1); pop(it.x, it.y - 16, 'Green flag', GREEN, true); vib(12); }
  else { G.streak = 0; G.boost = 0; G.shake = .7; G.flash = 1; pop(it.x, it.y - 16, 'Red flag', RED, true); vib([20, 30, 20]); }
  hud();
}

function gameOver(){
  G.state = 'over';
  const run = { score: G.score, duration: Math.round((performance.now() - G.t0) / 100) / 10, token: G.token };
  G.lastScore = run.score;
  if (run.score > localBest) { localBest = run.score; LS.set('best', localBest); }
  $('#oScore').textContent = run.score === 0 ? 'LOVE' : run.score;
  $('#oBest').textContent = 'Your best: ' + Math.max(localBest, me ? me.best : 0);
  $('#ovOver').classList.remove('hidden');
  if (me) { attempt = { run, name: '', via: 'auto' }; logRun(); }
  else {
    guestPlays++; LS.set('guestPlays', guestPlays);
    if (!pending || run.score >= pending.score) { pending = run; LS.set('pending', pending); }
    attempt = null; setOver('ask');
  }
}

/* input */
const keys = {};
function px(e){ const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; }
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('#ovOver')) return;
  G.p.tx = px(e);
  if (G.state === 'idle') startGame();
});
stage.addEventListener('pointermove', e => { if (G.state === 'play' || G.state === 'idle') G.p.tx = px(e); });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') { keys.l = 1; e.preventDefault(); }
  if (e.key === 'ArrowRight') { keys.r = 1; e.preventDefault(); }
  if ((e.key === ' ' || e.key === 'Enter') && G.state === 'idle') { e.preventDefault(); startGame(); }
});
addEventListener('keyup', e => { if (e.key === 'ArrowLeft') keys.l = 0; if (e.key === 'ArrowRight') keys.r = 0; });

/* update */
function update(dt){
  const p = G.p, b = G.ball;
  if (keys.l) p.tx -= 480 * dt; if (keys.r) p.tx += 480 * dt;
  p.tx = clamp(p.tx, CX + p.w / 2 - 8, CX + CW - p.w / 2 + 8);
  p.x += (p.tx - p.x) * Math.min(1, dt * 28);
  G.pops.forEach(q => { q.t += dt; q.y -= 30 * dt; }); G.pops = G.pops.filter(q => q.t < 1);
  G.shake = Math.max(0, G.shake - dt * 3); G.flash = Math.max(0, G.flash - dt * 3);
  for (const it of G.items) { it.t += dt; it.x += it.vx * dt; if (it.x < CX + 26 || it.x > CX + CW - 26) it.vx *= -1; }
  G.items = G.items.filter(it => it.t < it.life);

  if (G.state === 'idle') { b.x = p.x; b.y = PY - R - 2; G.o.x += (W / 2 - G.o.x) * Math.min(1, dt * 3); return; }
  if (G.state !== 'play') return;

  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.returns >= 1 && G.items.length < 2) { spawn(); G.spawnT = 2.6 + Math.random() * 2.2; }

  if (!b.live) { G.wait -= dt; G.o.x += (W / 2 - G.o.x) * Math.min(1, dt * 6); if (G.wait <= 0) serve(); return; }

  const py = b.y;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < CX + R) { b.x = CX + R; b.vx = Math.abs(b.vx); }
  if (b.x > CX + CW - R) { b.x = CX + CW - R; b.vx = -Math.abs(b.vx); }

  if (b.vy < 0) G.o.x += (b.x - G.o.x) * Math.min(1, dt * 7);
  else G.o.x += (W / 2 - G.o.x) * Math.min(1, dt * 1.5);

  if (b.vy < 0 && b.y <= OY + R) { b.y = OY + R; G.speed = Math.min(MAXS, BASE + G.returns * 12); aim(b, G.speed); }

  if (b.vy > 0 && py < PY - R && b.y >= PY - R) {
    const half = p.w / 2 + R + 3, dx = b.x - p.x;
    if (Math.abs(dx) <= half) hit(dx / half);
  }
  if (b.vy > 0 && b.y > H + R * 3) { miss(); return; }

  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    if (Math.hypot(b.x - it.x, b.y - it.y) < R + 14) { G.items.splice(i, 1); collect(it); }
  }
}

/* draw */
function rr(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function line(a, b, c, d){ ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
function heartPath(x, y, s){
  ctx.beginPath(); ctx.moveTo(x, y + s * .9);
  ctx.bezierCurveTo(x - s * 1.4, y + s * .1, x - s * .9, y - s * 1, x, y - s * .35);
  ctx.bezierCurveTo(x + s * .9, y - s * 1, x + s * 1.4, y + s * .1, x, y + s * .9); ctx.closePath();
}
function court(){
  ctx.fillStyle = BG; ctx.fillRect(-12, -12, W + 24, H + 24);
  const g = ctx.createLinearGradient(0, CY, 0, CY + CH); g.addColorStop(0, '#360A61'); g.addColorStop(.5, '#2C0752'); g.addColorStop(1, '#360A61');
  rr(CX, CY, CW, CH, 14); ctx.fillStyle = g; ctx.fill();
  const ix = CX + 12, iy = CY + 12, iw = CW - 24, ih = CH - 24, sl = 26;
  ctx.strokeStyle = 'rgba(247,42,133,.8)'; ctx.lineWidth = 2;
  ctx.strokeRect(ix, iy, iw, ih);
  ctx.strokeRect(ix + sl, iy, iw - sl * 2, ih);
  line(ix + sl, H / 2 - 112, ix + iw - sl, H / 2 - 112);
  line(ix + sl, H / 2 + 112, ix + iw - sl, H / 2 + 112);
  line(W / 2, H / 2 - 112, W / 2, H / 2 + 112);
  line(W / 2, iy, W / 2, iy + 7); line(W / 2, iy + ih, W / 2, iy + ih - 7);
  if (logoImg.complete && logoImg.naturalWidth) {
    const lw = 236, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
    ctx.globalAlpha = .26; ctx.drawImage(logoImg, W / 2 - lw / 2, H / 2 - lh / 2, lw, lh); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(CX - 4, H / 2 - 6, CW + 8, 12);
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
  for (let x = CX; x < CX + CW; x += 6) line(x, H / 2 - 6, x, H / 2 + 6);
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(CX - 6, H / 2 - 7, CW + 12, 3);
  ctx.fillStyle = YELLOW; [CX - 6, CX + CW + 6].forEach(x => { ctx.beginPath(); ctx.arc(x, H / 2 - 5.5, 4, 0, 7); ctx.fill(); });
}
function racket(x, y, w, col, up){
  const rx = w / 2, ry = Math.max(11, w * .2), hy = up ? -1 : 1;
  ctx.save(); ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.strokeStyle = col; ctx.lineWidth = 5; line(0, ry * hy, 0, (ry + 12) * hy);
  ctx.strokeStyle = BG; ctx.lineWidth = 7; line(0, (ry + 13) * hy, 0, (ry + 24) * hy);
  ctx.strokeStyle = col; ctx.lineWidth = 2; line(0, (ry + 13) * hy, 0, (ry + 24) * hy);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fillStyle = 'rgba(28,1,49,.6)'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = col; ctx.globalAlpha = .45; ctx.lineWidth = 1;
  for (let i = -rx; i <= rx; i += 7) line(i, -ry, i, ry);
  for (let j = -ry; j <= ry; j += 5) line(-rx, j, rx, j);
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.lineWidth = 3.5; ctx.strokeStyle = col; ctx.stroke();
  ctx.restore();
}
function drawBall(now){
  const b = G.ball; let hgt;
  if (G.state === 'idle') hgt = Math.abs(Math.sin(now / 260)) * 26;
  else if (!b.live) return;
  else hgt = Math.sin(Math.PI * clamp((b.y - OY) / (PY - OY), 0, 1)) * 30;
  const k = 1 - hgt / 90;
  ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 3, R * k, R * .45 * k, 0, 0, 7); ctx.fill();
  const r = R * (1 + hgt / 55), y = b.y - hgt;
  ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(b.x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(b.x - r * .95, y, r * .78, -.85, .85); ctx.stroke();
  ctx.beginPath(); ctx.arc(b.x + r * .95, y, r * .78, Math.PI - .85, Math.PI + .85); ctx.stroke();
}
function drawItem(it, now){
  const a = Math.min(1, it.t / .3, (it.life - it.t) / .8), s = Math.min(1, it.t / .3);
  const bob = Math.sin(now / 300 + it.x) * 2.5;
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(it.x, it.y + bob); ctx.scale(s, s);
  const col = it.type === 'heart' ? PINK : it.type === 'green' ? GREEN : RED;
  ctx.fillStyle = col; ctx.globalAlpha *= .18 + .1 * Math.sin(now / 200);
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill();
  ctx.globalAlpha = Math.max(0, a);
  if (it.type === 'heart') { heartPath(0, 0, 9); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  else {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; line(-6, 12, -6, -12);
    ctx.beginPath(); ctx.moveTo(-5, -12); ctx.quadraticCurveTo(3, -14, 11, -7); ctx.quadraticCurveTo(3, -2, -5, -1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function draw(now){
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (G.shake) ctx.translate((Math.random() - .5) * 8 * G.shake, (Math.random() - .5) * 8 * G.shake);
  court();
  G.items.forEach(it => drawItem(it, now));
  racket(G.o.x, OY, 66, PINK, true);
  racket(G.p.x, PY, G.p.w, YELLOW, false);
  drawBall(now);
  for (const q of G.pops) {
    ctx.globalAlpha = 1 - q.t; ctx.font = `700 ${q.big ? 20 : 15}px Fredoka, sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = BG; ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.col; ctx.fillText(q.text, q.x, q.y);
  }
  ctx.globalAlpha = 1;
  if (G.flash) { ctx.fillStyle = `rgba(255,74,74,${G.flash * .22})`; ctx.fillRect(-12, -12, W + 24, H + 24); }
}

let last = performance.now();
function loop(t){ const dt = Math.min(.033, (t - last) / 1000); last = t; update(dt); draw(t); requestAnimationFrame(loop); }

/* boot */
hud(); renderWho(); renderBoard({ ok: true, top: [], total: 0 }); refreshBoard();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
requestAnimationFrame(loop);
})();
