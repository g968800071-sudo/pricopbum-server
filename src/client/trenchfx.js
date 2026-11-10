// r37 «Траншеи» art: crushable village houses (top-down roofs), wooden fences, trees (trunk + canopy), dug trenches with sandbags,
// collapse FX (debris thrown along the tank's path, dust cloud) and persistent rubble / fallen trees.
import { CELL } from '../sim/defs.js';
const TAU = Math.PI * 2, H = (C, R) => ((C * 73856093) ^ (R * 19349663)) >>> 0;
const ROOFS = [['#9b4a32', '#7d3a27', '#b8603f'], ['#6b5a4a', '#55473a', '#857160'], ['#5d6b70', '#4a565a', '#76858a'], ['#8a6a3a', '#6f552e', '#a8844c']];
export function drawHouse(g, x, y, C, R, m) {
  const id = m.hid ? m.hid[R * m.w + C] - 1 : -1, hs = id >= 0 && m.houses ? m.houses[id] : [C, R, 1, 1], [hc, hr, hw, hh] = hs, P = ROOFS[(id >= 0 ? id >> 1 : 0) % ROOFS.length];
  const alongX = hw >= hh, mid = alongX ? hr + hh / 2 : hc + hw / 2, pos = alongX ? R + 0.5 : C + 0.5, lit = pos < mid;
  g.fillStyle = lit ? P[2] : P[1]; g.fillRect(x, y, CELL, CELL);
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 0.5; // shingle rows
  for (let k = 1; k < 4; k++) { g.beginPath(); if (alongX) { g.moveTo(x, y + k * 2); g.lineTo(x + CELL, y + k * 2); } else { g.moveTo(x + k * 2, y); g.lineTo(x + k * 2, y + CELL); } g.stroke(); }
  if (Math.abs(pos - mid) < 0.6) { g.fillStyle = 'rgba(40,20,10,0.55)'; if (alongX) g.fillRect(x, y + CELL / 2 - 0.6, CELL, 1.2); else g.fillRect(x + CELL / 2 - 0.6, y, 1.2, CELL); } // ridge
  g.fillStyle = 'rgba(0,0,0,0.35)'; if (R === hr) g.fillRect(x, y, CELL, 0.9); if (R === hr + hh - 1) g.fillRect(x, y + CELL - 1.6, CELL, 1.6); if (C === hc) g.fillRect(x, y, 0.9, CELL); if (C === hc + hw - 1) g.fillRect(x + CELL - 1.6, y, 1.6, CELL);
  const h = H(C, R); if (h % 23 === 0) { g.fillStyle = '#4a4a4a'; g.fillRect(x + 2, y + 2, 3, 3); g.fillStyle = '#777'; g.fillRect(x + 2.4, y + 2.4, 2.2, 0.8); } // chimney
  if (h % 7 === 0) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + (h >> 4) % 6, y + (h >> 7) % 6, 2, 1); }
}
export function drawFence(g, x, y, C, R, m) {
  const hor = m.get(C - 1, R) === 13 || m.get(C + 1, R) === 13, ver = m.get(C, R - 1) === 13 || m.get(C, R + 1) === 13;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.strokeStyle = '#8a6238'; g.lineWidth = 1.1;
  if (hor || !ver) { g.fillRect(x, y + 4.6, CELL, 1); g.beginPath(); g.moveTo(x, y + 3.6); g.lineTo(x + CELL, y + 3.6); g.stroke(); }
  if (ver) { g.fillRect(x + 4.6, y, 1, CELL); g.beginPath(); g.moveTo(x + 3.6, y); g.lineTo(x + 3.6, y + CELL); g.stroke(); }
  g.fillStyle = '#5e4024'; g.fillRect(x + 2.8, y + 2.8, 1.8, 1.8);
}
export function drawTreeBase(g, x, y, C, R) { const h = H(C, R); g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x + 6, y + 6, 6.5, 5, 0.6, 0, TAU); g.fill(); g.fillStyle = '#4a3420'; g.beginPath(); g.arc(x + 4 + (h % 3) * 0.3, y + 4, 1.6, 0, TAU); g.fill(); }
export function drawTreeTop(g, x, y, C, R) { const h = H(C, R), cx = x + 4 + ((h % 5) - 2) * 0.4, cy = y + 4 + (((h >> 3) % 5) - 2) * 0.4, r = 5.4 + (h % 4) * 0.5, pine = h % 3 === 0;
  if (pine) { for (let k = 0; k < 3; k++) { const rr = r * (1 - k * 0.26); g.fillStyle = ['#1e3d1c', '#28502a', '#346236'][k]; g.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + h, q = i % 2 ? rr * 0.62 : rr; g.lineTo(cx - k * 0.5 + Math.cos(a) * q, cy - k * 0.5 + Math.sin(a) * q); } g.fill(); } return; }
  g.fillStyle = '#244a22'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + (h & 7), d = r * 0.45; g.fillStyle = i % 2 ? '#2f5d2b' : '#3a6d33'; g.beginPath(); g.arc(cx + Math.cos(a) * d - 0.6, cy + Math.sin(a) * d - 0.6, r * 0.5, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(190,230,120,0.18)'; g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.35, r * 0.35, 0, TAU); g.fill(); }
export function drawTrench(g, x, y, C, R, m) { const h = H(C, R), T = (c, r) => m.get(c, r) === 15;
  g.fillStyle = '#3a2a18'; g.fillRect(x, y, CELL, CELL); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, CELL, 2);
  g.fillStyle = 'rgba(120,90,55,0.5)'; if ((h >> 2) % 3 === 0) g.fillRect(x + 1, y + 3 + (h % 3), 6, 0.8); // duckboards
  const bag = (bx, by, w, hh) => { g.fillStyle = '#8b7a55'; g.beginPath(); g.ellipse(bx, by, w, hh, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,30,15,0.6)'; g.lineWidth = 0.4; g.stroke(); };
  if (!T(C, R - 1)) { bag(x + 2, y + 0.6, 2.1, 1.1); bag(x + 6, y + 0.6, 2.1, 1.1); } if (!T(C, R + 1)) { bag(x + 2, y + 7.4, 2.1, 1.1); bag(x + 6, y + 7.4, 2.1, 1.1); }
  if (!T(C - 1, R)) { bag(x + 0.6, y + 2, 1.1, 2.1); bag(x + 0.6, y + 6, 1.1, 2.1); } if (!T(C + 1, R)) { bag(x + 7.4, y + 2, 1.1, 2.1); bag(x + 7.4, y + 6, 1.1, 2.1); } }
// collapse: debris flies along the tank's direction, a dust cloud rises, rubble stays
export function crumbleFx(R, e) { const q = R.quality || 1, n = Math.min(26, 6 + e.n * 2) * q, kd = e.kd, a0 = e.a || 0;
  const cols = kd === 0 ? ['#9b4a32', '#b8a58a', '#6b5a4a', '#d8cbb0', '#4a3420'] : kd === 1 ? ['#8a6238', '#5e4024'] : ['#2f5d2b', '#4a3420', '#3a6d33'];
  for (let i = 0; i < n; i++) { const a = a0 + (Math.random() - 0.5) * 2.2, v = 30 + Math.random() * (kd === 0 ? 110 : 70); R.addParticle({ k: 'debris', x: e.x + (Math.random() - 0.5) * 8, y: e.y + (Math.random() - 0.5) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.7, t: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, c: cols[(Math.random() * cols.length) | 0], sz: kd === 0 ? 1.5 + Math.random() * 2 : 1.4 }); }
  for (let i = 0; i < (kd === 0 ? 4 + Math.min(6, e.n) : 2) * q; i++) R.addParticle({ k: 'dust', x: e.x + (Math.random() - 0.5) * 18, y: e.y + (Math.random() - 0.5) * 18, vx: (Math.random() - 0.5) * 12, vy: -4 - Math.random() * 6, life: 1.4 + Math.random() * 1.4, t: 0, r: kd === 0 ? 16 + Math.random() * 14 : 9 });
  R.decals.push({ k: 'rubble', x: e.x, y: e.y, a: a0, kd, n: e.n, s: (Math.random() * 1e6) | 0, t: 0, life: 900 }); if (R.decals.length > 700) R.decals.splice(0, 100); }
export function drawRubble(g, d, al) { let s = d.s; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); g.save(); g.globalAlpha = Math.min(1, al * 3);
  if (d.kd === 2) { g.translate(d.x, d.y); g.rotate(d.a); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-1, -1.2, 16, 3.4); g.fillStyle = '#4a3420'; g.fillRect(0, -1.6, 15, 3); g.fillStyle = '#2f5d2b'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(12 + rnd() * 6, (rnd() - 0.5) * 6, 2.5 + rnd() * 1.5, 0, TAU); g.fill(); } }
  else if (d.kd === 1) { g.translate(d.x, d.y); g.strokeStyle = '#6e4e2c'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { const a = d.a + (rnd() - 0.5) * 1.6, x = (rnd() - 0.5) * 8, y = (rnd() - 0.5) * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); } }
  else { const N = Math.min(18, 4 + d.n), sp = 3 + Math.sqrt(d.n) * 3.2; for (let i = 0; i < N; i++) { const x = d.x + (rnd() - 0.5) * sp * 2, y = d.y + (rnd() - 0.5) * sp * 2, w = 2 + rnd() * 3.5; g.fillStyle = ['#8a7a64', '#6e5f4d', '#9b4a32', '#a8977c', '#4a3420'][(rnd() * 5) | 0]; g.beginPath(); g.ellipse(x, y, w, w * (0.5 + rnd() * 0.4), rnd() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = '#5e4024'; g.lineWidth = 0.9; for (let i = 0; i < 3; i++) { const x = d.x + (rnd() - 0.5) * sp * 1.6, y = d.y + (rnd() - 0.5) * sp * 1.6, a = rnd() * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke(); } }
  g.restore(); }
