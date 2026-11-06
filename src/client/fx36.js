// r36 visuals: crate content icons/labels, armour-crate beacons, lightning rounds, Molotov fire, hunt traps, flare blind.
import { LOOTX } from '../sim/loot.js';
import { PICKUPS, TIERS } from '../sim/defs.js';
import { HT, HT_SEE } from '../sim/htraps.js';
const TAU = Math.PI * 2;
export const ZAP_COL = { 1: ['#ffffff', '200,220,255'], 2: ['#4aa8ff', '70,150,255'], 3: ['#ff3b4a', '255,60,70'] };
const zkOf = (p) => p.zk || (p.tier >= 5 ? 'lr' : p.tier >= 4 ? 'lb' : 'lw');
export function crateInfo(p) {
  if (p.type === 'zap') { const z = zkOf(p), n = z === 'lr' ? 3 : z === 'lb' ? 2 : 1; return { g: 'bolt', col: ZAP_COL[n][0], lab: 'Молния ×28' + (n === 3 ? ' · миф.' : n === 2 ? ' · лег.' : ''), zn: n }; }
  if (p.type === 'fire') return { g: 'flame', col: '#ff7a1f', lab: 'Молотов ×8' };
  if (p.type === 'loot') return { g: 'q', col: '#d8c38a', lab: 'Добыча' };
  if (p.type === 'lx' && (LOOTX[p.lid] || {}).cat === 'fmod') { const L = LOOTX[p.lid]; return { g: 'lx', col: L.col, lab: '🔧 ' + L.name + ' · 1 бой' }; }
  if (p.type === 'lx') { const L = LOOTX[p.lid] || {}; return { g: 'lx', col: L.col || '#fff', lab: (L.name || 'Добыча').replace(/^Снаряды: /, 'Снаряды · ') }; }
  const P = PICKUPS[p.type] || {}; let lab = P.lab || P.name || p.type;
  if (p.type === 'armor') lab = 'Броня ' + ['I', 'II', 'III', 'IV', 'V'][Math.min(4, (p.tier || 1) - 1)];
  if (p.type === 'weapon' && p.wid) lab = 'Оружие · ' + p.wid;
  return { g: 'ic', col: P.color || '#fff', lab };
}
export function glyph(g, kind, col, p, drawIcon) {
  g.fillStyle = col; g.strokeStyle = col;
  if (kind === 'flame') { g.beginPath(); g.moveTo(0, -5); g.bezierCurveTo(3.5, -1.5, 4, 1.5, 0, 4.5); g.bezierCurveTo(-4, 1.5, -3.5, -1.5, -1, -2.6); g.bezierCurveTo(-0.8, -0.8, 0.6, -1.6, 0, -5); g.fill(); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(0, 2, 1.6, 0, TAU); g.fill(); return; }
  if (kind === 'bolt') { g.beginPath(); g.moveTo(1.4, -5); g.lineTo(-2.8, 0.6); g.lineTo(-0.2, 0.6); g.lineTo(-1.4, 5); g.lineTo(2.8, -0.8); g.lineTo(0.2, -0.8); g.closePath(); g.fill(); return; }
  if (kind === 'q') { g.font = '800 7px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 0.4); return; }
  g.save(); g.scale(0.85, 0.85); g.lineWidth = 1; drawIcon(g, p.type, p.wid, p.lid); g.restore();
}
// distinct crate bodies for the new crates
export function drawNewCrate(g, p, time) {
  if (p.type === 'fire') { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(-5, -4.2, 11.5, 10); const G = g.createLinearGradient(-5.5, -5, 5.5, 5); G.addColorStop(0, '#b8321c'); G.addColorStop(1, '#6a1408'); g.fillStyle = G; g.fillRect(-5.5, -5, 11, 10);
    g.fillStyle = '#ffb02e'; for (const q of [-3, 0, 3]) { g.beginPath(); g.moveTo(q - 1.2, 4); g.quadraticCurveTo(q, -2 - Math.sin(time * 6 + q) * 0.8, q + 1.2, 4); g.fill(); } g.strokeStyle = 'rgba(20,6,2,0.8)'; g.lineWidth = 0.6; g.strokeRect(-5.2, -4.7, 10.4, 9.4); return true; }
  if (p.type === 'zap') { const n = crateInfo(p).zn, C = ZAP_COL[n]; g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(-5, -4.2, 11.5, 10); g.fillStyle = '#23262e'; g.fillRect(-5.5, -5, 11, 10); g.strokeStyle = C[0]; g.lineWidth = 0.7; g.strokeRect(-5.2, -4.7, 10.4, 9.4);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.6 + 0.4 * Math.abs(Math.sin(time * 5)); glyph(g, 'bolt', C[0], p); g.restore(); return true; }
  return false;
}
// armour beacon column (seen from far away, every mode/map)
export function drawArmorBeacon(g, p, time) {
  const k = 0.55 + 0.45 * Math.sin(time * 3 + p.id), col = (TIERS[Math.min(4, (p.tier || 1) - 1)] || TIERS[0]).color;
  g.save(); g.globalCompositeOperation = 'lighter'; const R = g.createRadialGradient(p.x, p.y, 1, p.x, p.y, 22); R.addColorStop(0, 'rgba(160,210,255,' + 0.45 * k + ')'); R.addColorStop(1, 'rgba(160,210,255,0)'); g.fillStyle = R; g.beginPath(); g.arc(p.x, p.y, 22, 0, TAU); g.fill();
  const C = g.createLinearGradient(p.x, p.y, p.x, p.y - 70); C.addColorStop(0, 'rgba(170,220,255,' + 0.55 * k + ')'); C.addColorStop(1, 'rgba(170,220,255,0)'); g.fillStyle = C; g.fillRect(p.x - 3, p.y - 70, 6, 70);
  g.strokeStyle = col; g.globalAlpha = 0.5 * (1 - (time * 0.8 % 1)); g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, 6 + (time * 0.8 % 1) * 16, 0, TAU); g.stroke(); g.restore();
}
// floating icons (mid range) + short labels (close). At most 10, nearest first, so the screen stays clean.
export function drawCrateTags(g, view, me, time, drawIcon) {
  if (!me || !me.alive) return; const L = [], B = view.map && view.map.sunny ? 1.45 : 1, LR = 64 * (B > 1 ? 1.5 : 1); // BUGA.BUM: bigger icons/labels
  for (const p of view.pickups) { const d2 = (p.x - me.x) ** 2 + (p.y - me.y) ** 2; if (d2 < 230 * 230) L.push([d2, p]); }
  L.sort((a, b) => a[0] - b[0]); let n = 0;
  for (const [d2, p] of L) { if (n++ >= 10) break; const d = Math.sqrt(d2), I = crateInfo(p), a = Math.min(1, (230 - d) / 40), bob = Math.sin(time * 2.4 + p.id) * 0.8, y = p.y - 12 + bob;
    g.save(); g.translate(p.x, y); g.scale(B, B); g.translate(-p.x, -y); g.globalAlpha = a * 0.92; g.fillStyle = 'rgba(12,14,20,0.72)'; g.beginPath(); g.arc(p.x, y, 5.2, 0, TAU); g.fill(); g.strokeStyle = I.col; g.lineWidth = 0.7; g.stroke();
    g.beginPath(); g.moveTo(p.x - 1.4, y + 5); g.lineTo(p.x, y + 7); g.lineTo(p.x + 1.4, y + 5); g.fill();
    g.translate(p.x, y); g.scale(0.62, 0.62); glyph(g, I.g, I.col, p, drawIcon); g.restore();
    if (d < LR) { g.save(); g.translate(p.x, y); g.scale(B, B); g.translate(-p.x, -y); g.globalAlpha = Math.min(1, (LR - d) / 18); g.font = '700 4.6px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = g.measureText(I.lab).width + 4; g.fillStyle = 'rgba(12,14,20,0.8)'; g.fillRect(p.x - w / 2, y - 12, w, 6); g.fillStyle = I.col === '#ffffff' || I.col === '#f4f8ff' ? '#fff' : I.col; g.fillText(I.lab, p.x, y - 8.9); g.restore(); }
  }
}
// lightning round: jagged bolt + glow, colour by tier
export function drawZapBullet(g, b, r) {
  const C = ZAP_COL[b.zap] || ZAP_COL[1], sp = Math.hypot(b.vx, b.vy) || 1, nx = b.vx / sp, ny = b.vy / sp, L = 26, px = -ny, py = nx;
  g.strokeStyle = 'rgba(' + C[1] + ',0.35)'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - nx * L, b.y - ny * L); g.stroke();
  for (let s = 0; s < 2; s++) { g.strokeStyle = s ? C[0] : 'rgba(' + C[1] + ',0.8)'; g.lineWidth = s ? 0.9 : 1.8; g.beginPath(); g.moveTo(b.x, b.y); for (let k = 1; k <= 6; k++) { const o = k === 6 ? 0 : (Math.random() - 0.5) * 6; g.lineTo(b.x - nx * L * k / 6 + px * o, b.y - ny * L * k / 6 + py * o); } g.stroke(); }
  if (Math.random() < 0.35) { const a = Math.random() * TAU, l = 4 + Math.random() * 6; g.strokeStyle = C[0]; g.lineWidth = 0.6; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + Math.cos(a) * l * 0.5 + (Math.random() - 0.5) * 2, b.y + Math.sin(a) * l * 0.5); g.lineTo(b.x + Math.cos(a) * l, b.y + Math.sin(a) * l); g.stroke(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, 1.8, 0, TAU); g.fill();
  if (r && r.addParticle && Math.random() < 0.5 * (r.quality || 1)) r.addParticle({ k: 'light', x: b.x, y: b.y, life: 0.08, t: 0, r: 18, c: C[1] });
}
// Molotov bottles in flight + burning patches
export function drawFires(g, view, r, time) {
  for (const q of view.molos || []) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(q.x, q.y + 2, 2.4, 1.4, 0, 0, TAU); g.fill(); g.save(); g.translate(q.x, q.y - (q.h || 0)); g.rotate(time * 14); g.fillStyle = '#5a7a3a'; g.fillRect(-1.3, -2.2, 2.6, 4.4); g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(0, -3, 1.4 + Math.random() * 0.8, 0, TAU); g.fill(); g.restore(); }
  for (const f of view.fires || []) { const life = Math.min(1, f.t / 1.2), R = f.r * (0.85 + 0.15 * Math.min(1, (f.max - f.t) / 0.4));
    g.fillStyle = 'rgba(30,14,6,' + 0.45 * life + ')'; g.beginPath(); g.arc(f.x, f.y, R, 0, TAU); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; const G = g.createRadialGradient(f.x, f.y, 2, f.x, f.y, R); G.addColorStop(0, 'rgba(255,190,70,' + 0.55 * life + ')'); G.addColorStop(0.6, 'rgba(255,90,20,' + 0.35 * life + ')'); G.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = G; g.beginPath(); g.arc(f.x, f.y, R, 0, TAU); g.fill(); g.restore();
    if (r && r.addParticle) { const q = r.quality || 1; for (let k = 0; k < 3 * q; k++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R; r.addParticle({ k: 'fire', x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 10, life: 0.35 + Math.random() * 0.3, t: 0, r: 1.6 + Math.random() * 1.6 }); } if (Math.random() < 0.5 * q) r.addParticle({ k: 'smoke', x: f.x + (Math.random() - 0.5) * R, y: f.y + (Math.random() - 0.5) * R, vx: 3, vy: -12, life: 1.6, t: 0, r: 3, c: '60,56,52' }); }
  }
}
// hunt traps: own team always sees them; enemies only up close (the sim/server already filters online)
export function drawHTraps(g, view, me, time) {
  const T = view.htraps; if (!T || !T.length) return;
  for (const q of T) { const D = HT[q.k]; if (!D) continue; const mine = me && q.team === me.team, d2 = me ? (q.x - me.x) ** 2 + (q.y - me.y) ** 2 : 0;
    if (!mine && q.k !== 'decoy' && q.k !== 'bomb' && d2 > HT_SEE * HT_SEE) continue;
    g.save(); g.translate(q.x, q.y); const pul = 0.6 + 0.4 * Math.sin(time * 5 + q.id);
    if (q.k === 'decoy') { g.rotate(q.a || 0); g.globalAlpha = 0.55 + 0.25 * Math.sin(time * 9); g.fillStyle = 'rgba(125,255,176,0.35)'; g.fillRect(-8, -5, 16, 10); g.strokeStyle = '#7dffb0'; g.lineWidth = 0.6; g.strokeRect(-8, -5, 16, 10); g.fillRect(-1, -1, 11, 2); for (let y = -5; y < 5; y += 1.6) { g.fillStyle = 'rgba(125,255,176,0.18)'; g.fillRect(-8, y, 16, 0.5); } }
    else if (q.k === 'bomb') { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(-4, -3.2, 10, 9); g.fillStyle = '#6a5236'; g.fillRect(-5, -4.5, 10, 9); g.strokeStyle = 'rgba(25,16,8,0.7)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-5, -4.5); g.lineTo(5, 4.5); g.moveTo(5, -4.5); g.lineTo(-5, 4.5); g.stroke(); if (mine || d2 < 30 * 30) { g.fillStyle = (time * 3 % 1) < 0.5 ? '#ff3b2f' : '#401010'; g.fillRect(-1, -1, 2, 2); } }
    else if (q.k === 'tele') { g.strokeStyle = D.col; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.globalAlpha = 0.3 + 0.2 * k; g.beginPath(); g.arc(0, 0, 3 + k * 2.4 + Math.sin(time * 4 + k) * 0.6, time * (2 + k), time * (2 + k) + 4); g.stroke(); } }
    else { g.globalAlpha = mine ? 0.75 : 0.9; g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(0.6, 0.8, 4.4, 0, TAU); g.fill(); g.fillStyle = '#2a2d33'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); g.strokeStyle = D.col; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = D.col; if (q.k === 'spike') for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 2, Math.sin(a) * 2); g.lineTo(Math.cos(a + 0.25) * 5.4, Math.sin(a + 0.25) * 5.4); g.lineTo(Math.cos(a + 0.5) * 2, Math.sin(a + 0.5) * 2); g.fill(); }
      else if (q.k === 'emp') { g.globalAlpha *= pul; glyph(g, 'bolt', D.col, q); } else if (q.k === 'snare') { g.lineWidth = 0.9; g.beginPath(); g.arc(0, 0, 2.4, 0, TAU); g.stroke(); g.fillRect(-0.5, -4, 1, 8); g.fillRect(-4, -0.5, 8, 1); } else { g.globalAlpha *= pul; g.beginPath(); g.arc(0, 0, 1.4, 0, TAU); g.fill(); } }
    g.restore(); }
}
