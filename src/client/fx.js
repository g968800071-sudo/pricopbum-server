// r15 polish: pooled particles, realistic hit/ricochet/part/wreck effects, weather & time of day, night headlights, bloom glow, auto quality.
const TAU = Math.PI * 2;
export const ATMOS = [
  { id: 'day', n: 'День' }, { id: 'dusk', n: 'Закат' }, { id: 'night', n: 'Ночь' }, { id: 'rain', n: 'Ливень' }, { id: 'fog', n: 'Туман' }, { id: 'snow', n: 'Снегопад' }];
export function installFx(R) {
  const P = R.prototype;
  // --- pooling: dead particles are recycled (swap-remove, no splice), cap scales with quality
  P.addParticle = function (p) { const cap = 1100 * this.quality; if (this.particles.length >= cap) return; const o = (this.pool && this.pool.pop()) || {}; for (const k in o) o[k] = undefined; Object.assign(o, p); if (o.t === undefined) o.t = 0; this.particles.push(o); };
  P.stepFx = function (dt) {
    this.t = (this.t || 0) + dt; this.shake = Math.max(0, this.shake - dt * 30); this.flashT = Math.max(0, this.flashT - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    const A = this.particles, pool = this.pool || (this.pool = []);
    for (let i = A.length - 1; i >= 0; i--) { const p = A[i]; p.t += dt; if (p.t >= p.life) { A[i] = A[A.length - 1]; A.pop(); if (pool.length < 1500) pool.push(p); continue; }
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; const d = p.k === 'spark' ? 0.9 : p.k === 'debris' ? 0.9 : p.z !== undefined ? 0.985 : 0.94; const f = Math.pow(d, dt * 60); p.vx *= f; p.vy *= f; }
      if (p.z !== undefined) { p.vz -= 260 * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; if (Math.abs(p.vz) > 25) { p.vz *= -0.38; p.vx *= 0.55; p.vy *= 0.55; p.vr = (p.vr || 0) * 0.5; } else { p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; p.vr = 0; } } else if (p.trail && Math.random() < 0.5 * this.quality) this.addParticle({ k: 'smoke', x: p.x, y: p.y - p.z, vx: 0, vy: -4, life: 0.9, r: 2.2, c: '45,45,45' }); }
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) { const p = this.popups[i]; p.t += dt; if (p.t >= p.life) this.popups.splice(i, 1); }
    // burning wrecks keep smoking
    { const V = this.view, W = V && V.wrecks, c = this.cam; if (W && c && c.z) { const vw = this.W / c.z * 0.6 + 40, vh = this.H / c.z * 0.6 + 40, now = V.time || 0, q = this.quality;
      for (const w of W) { if (Math.abs(w.x - c.x) > vw || Math.abs(w.y - c.y) > vh) continue; const age = w.age != null ? w.age : now - (w.t0 || 0), burn = age < (this.ultra ? 45 : 30), far = Math.abs(w.x - c.x) > vw * 0.7 || Math.abs(w.y - c.y) > vh * 0.7; // LOD: far wrecks emit less
        const rate = (burn ? 0.75 : age < 150 ? 0.22 : 0.07) * q * (far ? 0.35 : 1) * dt * 60; if (Math.random() < rate) this.addParticle({ k: 'smoke', x: w.x + (Math.random() - 0.5) * 8, y: w.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 6 + 3, vy: -10 - Math.random() * 8, life: (burn ? 1.6 : 2.4) * (this.ultra ? 1.8 : 1), r: (burn ? 2.8 : 3.4) * (this.ultra ? 1.6 : 1), c: burn ? '40,36,34' : '110,110,110' });
        if (burn && !far && Math.random() < 0.6 * q * dt * 60 * Math.max(0.2, 1 - age / 30)) this.addParticle({ k: 'fire', x: w.x + (Math.random() - 0.5) * 10, y: w.y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 8, vy: -16 - Math.random() * 14, life: 0.35 + Math.random() * 0.3, t: 0, r: 2 + Math.random() * 2 }); } } }
  };
  // chunk = 3D-ish debris piece with height, bounce and rest on the ground
  P.chunk = function (x, y, a, v, o) { this.addParticle(Object.assign({ k: 'chunk', x, y, z: 4 + Math.random() * 4, vz: 60 + Math.random() * 90, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 18, life: 2.6 + Math.random() * 1.6, w: 2, h: 1.4, c: '#8a8f96' }, o)); };
  // hit on a tank: shards + sparks out of the impact side, small chunks scatter
  P.tankHit = function (t, hx, hy, dt, big) {
    const q = this.quality, a0 = Math.atan2(hy - t.y, hx - t.x), col = dt === 'fire' ? '#ff9a3d' : dt === 'emp' ? '#5df0ff' : dt === 'cold' ? '#bfefff' : '#ffd88a';
    for (let i = 0; i < (6 + big * 6) * q; i++) { const a = a0 + (Math.random() - 0.5) * 1.4, v = 70 + Math.random() * 150; this.addParticle({ k: 'spark', x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.15 + Math.random() * 0.25, c: col }); }
    for (let i = 0; i < (2 + big * 3) * q; i++) this.chunk(hx, hy, a0 + (Math.random() - 0.5) * 1.8, 30 + Math.random() * 70, { c: Math.random() < 0.5 ? '#9aa0a8' : (t._vis && t._vis.c1) || '#5d6b3e', w: 1.2 + Math.random() * 1.6, h: 0.8 + Math.random() });
    this.addParticle({ k: 'flash', x: hx, y: hy, life: 0.07, r: 7 + big * 4 });
    // armour plates / toolboxes fall off as damage builds up (at 75 / 50 / 25 % HP)
    if (t.maxHp) { const f = t.hp / t.maxHp, m = this.hpMark || (this.hpMark = new Map()), lv = f < 0.25 ? 3 : f < 0.5 ? 2 : f < 0.75 ? 1 : 0, was = m.get(t.id) || 0;
      if (lv > was) { m.set(t.id, lv); const box = lv === 2; this.chunk(t.x, t.y, a0 + (Math.random() - 0.5), 40 + Math.random() * 40, { w: box ? 3.4 : 5, h: box ? 2.4 : 1.4, c: box ? '#6b5a32' : (t._vis && t._vis.c2) || '#4b5530', life: 6, vz: 110 }); } else if (lv < was) m.set(t.id, lv); }
  };
  P.ricochet = function (x, y, a) { for (let i = 0; i < 12 * this.quality; i++) { const aa = a + (Math.random() - 0.5) * 0.7, v = 120 + Math.random() * 170; this.addParticle({ k: 'spark', x, y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.18 + Math.random() * 0.2, c: '#fff6c8' }); } this.addParticle({ k: 'flash', x, y, life: 0.08, r: 9 }); this.popup(x, y - 6, 'Рикошет', '#cfe8ff'); };
  P.partOff = function (t, p) {
    const q = this.quality, a0 = Math.random() * TAU;
    if (p === 2) for (let i = 0; i < 14 * q; i++) { const side = i % 2 ? 1 : -1, a = (t.a || 0) + side * Math.PI / 2 + (Math.random() - 0.5); this.chunk(t.x + Math.cos(a) * 6, t.y + Math.sin(a) * 6, a, 25 + Math.random() * 60, { w: 1.8, h: 1.1, c: '#2b2b2b', life: 5 }); } // broken track links
    else if (p === 0) this.chunk(t.x, t.y, a0, 50, { w: 4, h: 3, c: '#55606a', vz: 140, trail: 1, life: 5 }); // turret hatch / armour block
    else for (let i = 0; i < 4 * q; i++) this.chunk(t.x, t.y, a0 + i, 40 + Math.random() * 40, { trail: i === 0 ? 1 : 0, c: '#70757c' });
    for (let i = 0; i < 6 * q; i++) this.addParticle({ k: 'smoke', x: t.x, y: t.y, vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 10, life: 1.2, r: 2.5, c: '50,50,50' });
  };
  // destruction: hull bursts, turret flies off spinning with a smoke trail, burning wreck stays
  P.wreck = function (t) {
    const v = t._vis || {}; const a = Math.random() * TAU;
    this.chunk(t.x, t.y, a, 45 + Math.random() * 40, { k: 'chunk', turret: 1, w: 9, h: 7, c: v.c1 || '#5d6b3e', vz: 210, vr: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 8), trail: 1, life: 9 });
    for (let i = 0; i < 10 * this.quality; i++) this.chunk(t.x, t.y, Math.random() * TAU, 40 + Math.random() * 110, { trail: i < 3 ? 1 : 0, c: i % 3 ? '#3a3a3a' : v.c1 || '#5d6b3e', w: 1.5 + Math.random() * 3, h: 1 + Math.random() * 2 });
    if (this.ultra) { /* r25 Ultra: tank breaks apart — both tracks unroll off, side panels and hatches fly, ammo cook-off */ for (const sd of [-1, 1]) this.chunk(t.x + Math.cos(t.a + 1.57) * sd * 6, t.y + Math.sin(t.a + 1.57) * sd * 6, t.a + 1.57 * sd, 30 + Math.random() * 30, { w: 13, h: 3, c: '#2b2b2b', vz: 90, vr: sd * 3, trail: 0, life: 9 });
      for (let i = 0; i < 6; i++) this.chunk(t.x, t.y, Math.random() * TAU, 60 + Math.random() * 120, { w: 4 + Math.random() * 4, h: 2.5 + Math.random() * 2, c: i % 2 ? v.c1 || '#5d6b3e' : '#4a4a40', vz: 140 + Math.random() * 120, vr: (Math.random() - 0.5) * 20, trail: 1, life: 9 });
      for (let i = 0; i < 3; i++) setTimeout(() => this.boom && this.boom(t.x + (Math.random() - 0.5) * 12, t.y + (Math.random() - 0.5) * 12, 0.55, false, 'small'), 250 + i * 330); }
    if (this.hpMark) this.hpMark.delete(t.id);
  };
  // cached charred-hull sprite (one canvas, rotated per wreck) – cheap even with 100+ wrecks
  P.wreckSprite = function () { if (this._ws) return this._ws; const k = 4, cv = document.createElement('canvas'); cv.width = 26 * k; cv.height = 20 * k; const g = cv.getContext('2d'); g.scale(k, k); g.translate(13, 10);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(1, 1.5, 12.5, 9, 0, 0, TAU); g.fill(); g.fillStyle = '#191715'; g.fillRect(-10, -8, 20, 3.6); g.fillRect(-10, 4.4, 20, 3.6); g.fillStyle = '#2a2622'; for (let i = -9; i < 10; i += 2.4) { g.fillRect(i, -8, 1.2, 3.6); g.fillRect(i, 4.4, 1.2, 3.6); }
    const gr = g.createLinearGradient(0, -5, 0, 5); gr.addColorStop(0, '#3b3632'); gr.addColorStop(1, '#221f1c'); g.fillStyle = gr; g.fillRect(-9, -5, 18, 10); g.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-7 + Math.random() * 14, -4 + Math.random() * 8, 0.8 + Math.random() * 1.6, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(120,90,60,.35)'; g.fillRect(-8, -4.6, 16, 0.8); return (this._ws = cv); };
  P.drawWrecks = function (g, x0, y0, x1, y1) { const V = this.view, W = V && V.wrecks; if (!W) return; const sp = this.wreckSprite(), now = V.time || 0;
    for (const w of W) { if (w.x < x0 - 20 || w.x > x1 + 20 || w.y < y0 - 20 || w.y > y1 + 20) continue; const age = w.age != null ? w.age : now - (w.t0 || 0); g.save(); g.translate(w.x, w.y); g.rotate(w.a); g.drawImage(sp, -13, -10, 26, 20);
      if (age < 30) { g.fillStyle = 'rgba(255,120,40,' + (0.3 + 0.25 * Math.sin(this.t * 13 + w.id)) * (1 - age / 30) + ')'; g.fillRect(-5, -2.5, 10, 5); }
      if ((w.id % 3) !== 0) { g.rotate(w.ta - w.a); g.fillStyle = '#2c2825'; g.beginPath(); g.ellipse(-1, 0, 5, 4, 0.2, 0, TAU); g.fill(); g.strokeStyle = '#1d1a18'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(2, 0); g.lineTo(11, 1.5); g.stroke(); } // tilted turret on ~2/3 of wrecks
      g.restore();
      if (w.tid) { const me = this.meId != null ? V.tanks.find(t => t.id === this.meId) : null; if (me && me.team === w.team && (V.mode !== 'br' || V.squad > 1)) { const pul = 0.5 + 0.5 * Math.sin(this.t * 5); g.strokeStyle = 'rgba(108,255,154,' + (0.35 + 0.4 * pul) + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(w.x, w.y, 16, 0, TAU); g.stroke();
        if (w.rp > 0) { g.strokeStyle = '#6cff9a'; g.lineWidth = 2.6; g.beginPath(); g.arc(w.x, w.y, 16, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, w.rp)); g.stroke(); g.fillStyle = '#fff'; g.font = '700 7px system-ui'; g.textAlign = 'center'; g.fillText(Math.ceil(12 * (1 - w.rp)) + ' с', w.x, w.y - 19); }
        else { g.fillStyle = '#6cff9a'; g.font = '700 6px system-ui'; g.textAlign = 'center'; g.fillText('ждёт помощи', w.x, w.y - 19); } } } } };
  P.drawChunk = function (g, p, k) { const a = k > 0.8 ? (1 - k) / 0.2 : 1; g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(p.x - p.w / 2 + p.z * 0.25, p.y - p.h / 2 + p.z * 0.35, p.w, p.h);
    g.translate(p.x, p.y - p.z); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); if (p.turret) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(p.w / 2 - 1, -0.8, 7, 1.6); g.fillStyle = '#2b2b2b'; g.fillRect(p.w / 2, -0.6, 7, 1.2); } else { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.35); } g.restore(); };
  // --- atmosphere (screen space). Night: dark layer with headlight cones + light pools cut out. Rain / snow / fog layers. Bloom = additive glow.
  P.drawAtmo = function (g, view, me, cam, vp, dpr, time, vis, bullets) {
    if (view.map && view.map.sunny && !view.underground) { /* r36 BUGA.BUM: bright sunny day — warm light, visible sun with rays, soft haze */ const W = vp.w, H = vp.h, sx = vp.x + W * 0.86, sy = vp.y + H * 0.1, R = Math.min(W, H);
      g.save(); g.beginPath(); g.rect(vp.x, vp.y, W, H); g.clip(); const L = g.createLinearGradient(sx, sy, vp.x, vp.y + H); L.addColorStop(0, 'rgba(255,236,170,0.20)'); L.addColorStop(0.5, 'rgba(255,245,210,0.06)'); L.addColorStop(1, 'rgba(120,170,255,0.05)'); g.fillStyle = L; g.fillRect(vp.x, vp.y, W, H);
      g.globalCompositeOperation = 'lighter'; const G = g.createRadialGradient(sx, sy, 0, sx, sy, R * 0.55); G.addColorStop(0, 'rgba(255,250,215,0.85)'); G.addColorStop(0.08, 'rgba(255,240,170,0.55)'); G.addColorStop(0.3, 'rgba(255,220,120,0.14)'); G.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = G; g.fillRect(vp.x, vp.y, W, H);
      g.save(); g.translate(sx, sy); g.rotate(time * 0.05); for (let k = 0; k < 12; k++) { g.rotate(TAU / 12); g.fillStyle = 'rgba(255,240,180,' + (0.05 + 0.03 * Math.sin(time * 0.8 + k)) + ')'; g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 0.6, -R * 0.025); g.lineTo(R * 0.6, R * 0.025); g.closePath(); g.fill(); } g.restore();
      g.fillStyle = '#fffbe6'; g.beginPath(); g.arc(sx, sy, R * 0.045, 0, TAU); g.fill(); for (const [k, r, a] of [[0.35, 0.02, 0.16], [0.55, 0.035, 0.10], [0.8, 0.014, 0.18]]) { g.fillStyle = 'rgba(255,230,160,' + a + ')'; g.beginPath(); g.arc(sx + (vp.x + W / 2 - sx) * k * 2, sy + (vp.y + H / 2 - sy) * k * 2, R * r, 0, TAU); g.fill(); } // lens flare
      g.restore(); if (this.quality >= 0.75) this.bloom(g, cam, vp, dpr, bullets, 0.8); return; }
    const at = view.underground ? 'night' : (this.atmo || 'day'); if (at === 'day') { if (this.quality >= 1) this.bloom(g, cam, vp, dpr, bullets); return; }
    const W = vp.w, H = vp.h, toS = (x, y) => [vp.x + vp.w / 2 + (x - cam.x) * cam.z, vp.y + vp.h / 2 + (y - cam.y) * cam.z];
    g.save(); g.beginPath(); g.rect(vp.x, vp.y, W, H); g.clip();
    if (at === 'night' || at === 'dusk') {
      const L = this._lc || (this._lc = document.createElement('canvas')); const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2); if (L.width !== lw || L.height !== lh) { L.width = lw; L.height = lh; }
      const c = L.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, lw, lh); c.fillStyle = view.underground ? 'rgba(6,4,2,0.7)' : at === 'night' ? 'rgba(4,8,24,0.78)' : 'rgba(60,20,40,0.35)'; c.fillRect(0, 0, lw, lh); c.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, s) => { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,' + s + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
      if (view.underground && view.map.rooms) for (const q of view.map.rooms) { const [sx, sy] = toS(q.x, q.y); if (sx < vp.x - 200 || sy < vp.y - 200 || sx > vp.x + W + 200 || sy > vp.y + H + 200) continue; hole((sx - vp.x) / 2, (sy - vp.y) / 2, 34 * cam.z, 0.75); }
      for (const t of vis) { if (!t.alive) continue; const [sx, sy] = toS(t.x, t.y), X = (sx - vp.x) / 2, Y = (sy - vp.y) / 2, z = cam.z / 2, a = t.a || 0; hole(X, Y, 22 * z, 0.8);
        // headlight cone
        const len = 95 * z, gr = c.createRadialGradient(X, Y, 4 * z, X, Y, len); gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(X, Y); c.arc(X, Y, len, a - 0.42, a + 0.42); c.closePath(); c.fill(); }
      for (const p of this.particles) { if (p.k !== 'fire' && p.k !== 'flash' && p.k !== 'muzzle') continue; const [sx, sy] = toS(p.x, p.y); hole((sx - vp.x) / 2, (sy - vp.y) / 2, (p.k === 'flash' ? 40 : 16) * cam.z / 2, 0.9); }
      for (const b of bullets) { const [sx, sy] = toS(b.x, b.y); hole((sx - vp.x) / 2, (sy - vp.y) / 2, 10 * cam.z / 2, 0.8); }
      if (view.wrecks) for (const w of view.wrecks) if ((w.age != null ? w.age : (view.time || 0) - (w.t0 || 0)) < 30) { const [sx, sy] = toS(w.x, w.y); hole((sx - vp.x) / 2, (sy - vp.y) / 2, 30 * cam.z / 2, 0.85); }
      g.drawImage(L, vp.x, vp.y, W, H);
      if (at === 'dusk') { const gr = g.createLinearGradient(0, vp.y, 0, vp.y + H); gr.addColorStop(0, 'rgba(255,140,60,0.16)'); gr.addColorStop(1, 'rgba(120,40,120,0.12)'); g.fillStyle = gr; g.fillRect(vp.x, vp.y, W, H); }
    }
    if (this.quality >= 0.75) this.bloom(g, cam, vp, dpr, bullets, at === 'night' ? 1.6 : 1);
    const wx = this.wx || (this.wx = []), n = Math.round((at === 'rain' ? 160 : at === 'snow' ? 110 : 0) * this.quality);
    while (wx.length < n) wx.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }); wx.length = n;
    if (at === 'rain') { g.fillStyle = 'rgba(30,40,60,0.18)'; g.fillRect(vp.x, vp.y, W, H); g.strokeStyle = 'rgba(190,210,255,0.35)'; g.lineWidth = 1; g.beginPath(); for (const d of wx) { d.y += 0.03 * d.s; d.x += 0.006 * d.s; if (d.y > 1) { d.y -= 1; d.x = Math.random(); if (Math.random() < 0.3) this.addParticle({ k: 'ring', x: cam.x + (d.x - 0.5) * W / cam.z, y: cam.y + (Math.random() - 0.5) * H / cam.z, life: 0.4, r: 0.5, g: 3, w: 0.4, c: '200,220,255' }); } const X = vp.x + (d.x % 1) * W, Y = vp.y + d.y * H; g.moveTo(X, Y); g.lineTo(X - 3 * d.s, Y - 14 * d.s); } g.stroke(); }
    if (at === 'snow') { g.fillStyle = 'rgba(220,235,255,0.10)'; g.fillRect(vp.x, vp.y, W, H); g.fillStyle = 'rgba(255,255,255,0.85)'; for (const d of wx) { d.y += 0.0035 * d.s; d.x += Math.sin(time + d.s * 9) * 0.0008; if (d.y > 1) d.y -= 1; g.beginPath(); g.arc(vp.x + ((d.x % 1) + 1) % 1 * W, vp.y + d.y * H, 1.2 * d.s + 0.4, 0, TAU); g.fill(); } }
    if (at === 'fog') { for (let i = 0; i < 3; i++) { const x = vp.x + ((time * (8 + i * 5) + i * 300) % (W + 400)) - 200, y = vp.y + H * (0.25 + i * 0.25), gr = g.createRadialGradient(x, y, 10, x, y, 260); gr.addColorStop(0, 'rgba(200,210,215,0.35)'); gr.addColorStop(1, 'rgba(200,210,215,0)'); g.fillStyle = gr; g.fillRect(vp.x, vp.y, W, H); }
      if (me && me.alive) { const [sx, sy] = toS(me.x, me.y), gr = g.createRadialGradient(sx, sy, 90, sx, sy, Math.max(W, H) * 0.6); gr.addColorStop(0, 'rgba(190,198,204,0)'); gr.addColorStop(1, 'rgba(190,198,204,0.55)'); g.fillStyle = gr; g.fillRect(vp.x, vp.y, W, H); } }
    g.restore();
  };
  P.bloom = function (g, cam, vp, dpr, bullets, mul = 1) { g.save(); g.globalCompositeOperation = 'lighter'; const toS = (x, y) => [vp.x + vp.w / 2 + (x - cam.x) * cam.z, vp.y + vp.h / 2 + (y - cam.y) * cam.z];
    const glow = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + c + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
    let n = 0; for (const p of this.particles) { if (p.k !== 'flash' && p.k !== 'fire') continue; if (++n > 60 * this.quality) break; const [x, y] = toS(p.x, p.y); glow(x, y, (p.k === 'flash' ? 3 : 1.4) * (p.r || 6) * cam.z, '255,170,70', 0.22 * mul * (1 - p.t / p.life)); }
    for (const b of bullets) { const [x, y] = toS(b.x, b.y); glow(x, y, 8 * cam.z, '255,220,140', 0.18 * mul); } g.restore(); };
}
// auto quality: drop when the frame time is high, raise again when it is smooth
export function autoQuality(r, dt) { // r31: mobile-first auto quality: resolution steps (dprK) + effects; returns true when the canvas must be resized
  const a = r._aq || (r._aq = { acc: 0, n: 0, good: 0 }); if (r.dprK == null) { const mob = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; r.dprK = mob ? 0.75 : 1; if (mob) r.quality = Math.min(r.quality, 0.75); }
  const now = performance.now(); if (!a.t0) { a.t0 = now; return true; } a.n++; a.acc = (now - a.t0) / 1000; if (a.acc > 5 && a.n < 3) { a.t0 = now; a.n = 0; return false; } if (a.acc < 1.5) return false; const fps = a.n / a.acc; a.t0 = now; a.acc = 0; a.n = 0; if (r.qMax == null) r.qMax = 1; r.autoFps = fps; let rs = false;
  if (fps < 45) { a.good = 0; if (r.dprK > 0.5) { r.dprK = Math.max(0.5, r.dprK - 0.125); rs = true; } else if (r.quality > 0.4) r.quality = Math.max(0.4, r.quality - 0.2); }
  else if (fps > 58 && ++a.good >= 3) { a.good = 0; if (r.quality < Math.min(r.qMax, 0.75)) r.quality = Math.min(r.qMax, r.quality + 0.1); else if (r.dprK < 1) { r.dprK = Math.min(1, r.dprK + 0.125); rs = true; } else if (r.quality < r.qMax) r.quality = Math.min(r.qMax, r.quality + 0.1); }
  r.ultra = r.quality > 1.05; return rs; }
// r15 branding: waving «PRICOP.studio» flags on poles (decorative, non-blocking): corners, bases, landmarks, DOTA lanes
export function installFlags(R) {
  const P = R.prototype;
  P.flagTex = function (col) { this._ft = this._ft || {}; if (this._ft[col]) return this._ft[col]; const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 64); gr.addColorStop(0, col); gr.addColorStop(1, shade(col)); g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 58, 128, 6);
    g.fillStyle = '#ffd23d'; g.beginPath(); g.arc(20, 32, 11, 0, TAU); g.fill(); g.fillStyle = '#1b1e23'; g.font = '900 14px "Russo One", system-ui, "Noto Sans Georgian", "Noto Sans Armenian", "Sylfaen", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 20, 33);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = '900 17px "Russo One", system-ui, "Noto Sans Georgian", "Noto Sans Armenian", "Sylfaen", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif'; g.fillText('PRICOP', 36, 27); g.font = '700 12px system-ui, sans-serif'; g.fillStyle = '#ffd23d'; g.fillText('.studio', 37, 43);
    this._ft[col] = c; return c; };
  P.flagSites = function (view) { const m = view.map; if (this._flagMap === m) return this._flags; this._flagMap = m; const F = [], pw = m.pw, ph = m.ph, C = 8;
    const free = (x, y) => { const c = Math.floor(x / C), r = Math.floor(y / C); for (let dc = -3; dc <= 4; dc++) for (let dr = -4; dr <= 2; dr++) { const v = m.get(c + dc, r + dr); if (v !== 0 && v !== 4 && v !== 8) return false; } return true; };
    const add = (x, y, col) => { for (let k = 0; k < 12; k++) { const xx = x + (k ? (Math.random() - 0.5) * 30 : 0), yy = y + (k ? (Math.random() - 0.5) * 30 : 0); if (xx > 10 && yy > 20 && xx < pw - 10 && yy < ph - 6 && free(xx, yy)) { F.push({ x: xx, y: yy, col, ph: Math.random() * 6 }); return; } } };
    const N = '#2a2f3a'; add(26, 34, N); add(pw - 26, 34, N); add(26, ph - 20, N); add(pw - 26, ph - 20, N);
    if (m.spawns && view.mode !== 'br' && view.mode !== 'classic') m.spawns.forEach((sp, team) => { if (!sp.length) return; const cx = sp.reduce((a, p) => a + p[0], 0) / sp.length, cy = sp.reduce((a, p) => a + p[1], 0) / sp.length, col = team ? '#c23a3a' : '#2f6fd6'; add(cx, cy - 40, col); add(cx, cy + 46, col); });
    if (m.lanes) for (const f of [0.3, 0.42, 0.58, 0.7]) { add(pw * f, 14, f < 0.5 ? '#2f6fd6' : '#c23a3a'); add(pw * f, ph - 8, f < 0.5 ? '#2f6fd6' : '#c23a3a'); } // DOTA: along the outer edges beside the top/bottom lanes, never on the lane itself
    const n = view.mode === 'br' ? 8 : view.mode === 'classic' ? 0 : 2; for (let i = 0; i < n; i++) { const e = i % 4, t = 0.2 + 0.6 * Math.random(); add(e === 0 ? 18 : e === 1 ? pw - 40 : pw * t, e === 2 ? 22 : e === 3 ? ph - 10 : ph * t, N); } // edges only
    if (view.mode === 'br') add(pw / 2, ph / 2, N);
    this._flags = F; return F; };
  P.drawFlags2 = function (g, view, x0, y0, x1, y1, time) { const F = this.flagSites(view), strips = this.quality >= 1 ? 16 : this.quality >= 0.7 ? 10 : 6;
    for (const f of F) { if (f.x < x0 - 40 || f.x > x1 + 10 || f.y < y0 - 10 || f.y > y1 + 40) continue; const tex = this.flagTex(f.col), W = 26, H = 13, top = f.y - 30; let behind = false; for (const t of view.tanks) if (t.alive && t.x > f.x - 6 && t.x < f.x + W + 6 && t.y > top - 8 && t.y < f.y + 6) { behind = true; break; } if (!behind && view.pickups) for (const q of view.pickups) if (q.x > f.x - 4 && q.x < f.x + W + 4 && q.y > top - 6 && q.y < f.y + 4) { behind = true; break; } g.save(); g.globalAlpha = behind ? 0.3 : 0.95;
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(f.x + 6, f.y + 1, 9, 2.5, 0, 0, TAU); g.fill();
      g.strokeStyle = '#c9ced6'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x, top - 2); g.stroke(); g.fillStyle = '#ffd23d'; g.beginPath(); g.arc(f.x, top - 2.5, 1.4, 0, TAU); g.fill();
      for (let i = 0; i < strips; i++) { const u = i / strips, sw = W / strips, wave = Math.sin(time * 4.2 + f.ph - u * 5.5) * 2.2 * u, lit = 0.12 * Math.sin(time * 4.2 + f.ph - u * 5.5 - 0.6);
        g.drawImage(tex, u * 128, 0, 128 / strips + 0.6, 64, f.x + u * W, top + wave, sw + 0.35, H);
        if (lit) { g.fillStyle = lit > 0 ? 'rgba(255,255,255,' + lit + ')' : 'rgba(0,0,0,' + (-lit) + ')'; g.fillRect(f.x + u * W, top + wave, sw + 0.35, H); } } g.restore(); } };
}
function shade(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) * 0.6, g = ((n >> 8) & 255) * 0.6, b = (n & 255) * 0.6; return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
