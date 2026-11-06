import { LOOTX } from '../sim/loot.js';
import { GMODS } from '../sim/gmods.js';
import { MGS, TURRETS } from '../sim/arms.js';
// Renderer: chunk-cached tiles, vector tanks, particles, lighting-ish effects, HUD.
import { visOf } from '../sim/models.js';
import { drawMBT, lookOf, tankDims } from './tankart.js';
import { T_MUD, T_SWAMP, TIERS, CELL, T_EMPTY, T_BRICK, T_STEEL, T_WATER, T_BUSH, T_ICE, T_CRATE, T_BASE, SKINS, TEAM_COLORS, teamColor, teamTag, WEAPONS, PICKUPS, LOOT_REVEAL, LOOT_SEE, armorMax } from '../sim/defs.js';
import { makeRng } from '../sim/rng.js';
import { drawHouse, drawFence, drawTreeBase, drawTreeTop, drawTrench, crumbleFx, drawRubble } from './trenchfx.js';
import { installFx, installFlags } from './fx.js';
import { drawNewCrate, drawArmorBeacon, drawCrateTags, drawZapBullet, drawFires, drawHTraps } from './fx36.js';

const CH = 32; // cells per chunk side (256 world px)
const TAU = Math.PI * 2;
export const TANK_VIS = 1.83; // r17: tanks drawn 1.5x larger than r16 (1.22)
const ENEMY_SKINS = {
  enemy_b: { body: '#9aa3ad', dark: '#5d646d', light: '#d5dbe2' },
  enemy_f: { body: '#3fb7a6', dark: '#237366', light: '#88e6d8' },
  enemy_p: { body: '#d9773a', dark: '#8f4519', light: '#ffb27c' },
  enemy_a: { body: '#5c7a3c', dark: '#34481f', light: '#93b46a' },
};
export const THEMES = {
  br:      { ground: '#3d4a2e', g2: '#46552f', g3: '#34402a', speck: 'rgba(255,255,255,0.05)', dark: 'rgba(0,0,0,0.10)' },
  team:    { ground: '#7d6a48', g2: '#8a764f', g3: '#6f5d3e', speck: 'rgba(255,255,255,0.06)', dark: 'rgba(0,0,0,0.10)' },
  classic: { ground: '#17191e', g2: '#1c1f25', g3: '#141619', speck: 'rgba(255,255,255,0.025)', dark: 'rgba(0,0,0,0.2)' },
};
// r17: realistic art direction — every paint is muted toward a military grey-olive; team colour lives only in a stripe / ground ring
const MIL = [{ body: '#5b6340', dark: '#3a3f2a', light: '#7c8458' }, { body: '#8f8264', dark: '#5e5541', light: '#ad9f7d' }, { body: '#6b6e6a', dark: '#454844', light: '#8c8f8a' }, { body: '#b9bcb4', dark: '#7f837c', light: '#d6d8d1' }];
const _mc = new Map();
export function mute(c) { if (typeof c !== 'string' || c[0] !== '#' || c.length !== 7) return c; let r = _mc.get(c); if (r) return r;
  const n = parseInt(c.slice(1), 16); let R = n >> 16, G = (n >> 8) & 255, B = n & 255; const L = 0.3 * R + 0.59 * G + 0.11 * B, k = 0.62; // keep 38% saturation, pull toward olive-grey
  R = Math.round((R * (1 - k) + (L * 1.02) * k) * 0.86); G = Math.round((G * (1 - k) + (L * 1.0) * k) * 0.86); B = Math.round((B * (1 - k) + (L * 0.86) * k) * 0.86);
  r = '#' + ((1 << 24) | (Math.min(255, R) << 16) | (Math.min(255, G) << 8) | Math.min(255, B)).toString(16).slice(1); _mc.set(c, r); return r; }
const mutePal = (p) => p.light === undefined ? p : { body: mute(p.body), dark: mute(p.dark), light: mute(p.light), camo: p.camo };
export function skinColors(skin, team, mode) {
  if (mode === 'team' && skin === 'team') return MIL[(team || 0) % MIL.length];
  return mutePal(ENEMY_SKINS[skin] || SKINS[skin] || SKINS.olive);
}

function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = (v) => Math.min(255, Math.round(v + (255 - v) * k)); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.chunks = new Map(); this.bushChunks = new Map();
    this.particles = []; this.decals = []; this.popups = []; this.shake = 0; this.cam = { x: 0, y: 0, z: 1.5 }; this.quality = 1;
    this.mapRef = null; this.changePtr = 0; this.t = 0; this.flashT = 0; this.hurtT = 0;
  }
  resize(w, h, dpr) { this.W = w; this.H = h; this.dpr = dpr; this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'; this.clearCache(); }
  clearCache() { this.chunks.clear(); this.bushChunks.clear(); }
  setMap(map, mode) { this.mapRef = map; this.mode = mode; this.theme = map.theme ? { ...(THEMES[mode] || THEMES.br), ...map.theme } : (THEMES[mode] || THEMES.br); this.changePtr = map.changes.length; this.clearCache(); this.particles.length = 0; this.decals.length = 0; this.popups.length = 0; }
  syncChanges() {
    const m = this.mapRef; if (!m) return;
    for (; this.changePtr < m.changes.length; this.changePtr++) {
      const i = m.changes[this.changePtr], c = i % m.w, r = (i / m.w) | 0;
      const kx = (c / CH) | 0, ky = (r / CH) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cc = c + dx, rr = r + dy; const k2 = ((cc / CH) | 0) + ',' + ((rr / CH) | 0);
        this.chunks.delete(k2); this.bushChunks.delete(k2);
      }
      this.chunks.delete(kx + ',' + ky); this.bushChunks.delete(kx + ',' + ky);
    }
  }
  scale() { return this.cam.z * this.dpr; }

  // ---------- chunk drawing ----------
  buildChunk(kx, ky, bush) {
    const m = this.mapRef, s = Math.min(this.scale(), 3), size = Math.ceil(CH * CELL * s);
    const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
    const g = cv.getContext('2d'); g.scale(s, s); const ox = kx * CH, oy = ky * CH; const th = this.theme;
    const rng = makeRng((kx * 7919 + ky * 104729 + 1) ^ (bush ? 0x55 : 0));
    if (!bush) {
      g.fillStyle = th.ground; g.fillRect(0, 0, CH * CELL, CH * CELL);
      // soft patches
      for (let i = 0; i < 10; i++) { g.fillStyle = rng() < 0.5 ? th.g2 : th.g3; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(rng() * 256, rng() * 256, 14 + rng() * 34, 10 + rng() * 24, rng() * 3, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      for (let i = 0; i < 260; i++) { g.fillStyle = rng() < 0.6 ? th.speck : th.dark; g.fillRect(rng() * 256, rng() * 256, 0.8 + rng() * 1.2, 0.8 + rng() * 1.2); }
      // r15 detail pass: grass blades / gravel / cracks (cached per chunk, so free at runtime)
      if (!m.under && this.mode !== 'classic') { g.lineWidth = 0.45; for (let i = 0; i < 700; i++) { const x = rng() * 256, y = rng() * 256, l = 1.2 + rng() * 2.2, a = -1.2 - rng() * 0.8; g.strokeStyle = rng() < 0.5 ? 'rgba(160,190,90,0.18)' : 'rgba(20,40,10,0.22)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l); g.stroke(); } }
      for (let i = 0; i < 40; i++) { const x = rng() * 256, y = rng() * 256, r = 0.5 + rng() * 1.1; g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 0.4, y + 0.5, r, r * 0.7, 0, 0, TAU); g.fill(); g.fillStyle = m.under ? 'rgba(150,140,125,0.6)' : 'rgba(150,145,120,0.55)'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - r * 0.4, y - r * 0.4, r * 0.5, r * 0.3); }
      if (m.under) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.4; for (let i = 0; i <= 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); } for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); let x = rng() * 256, y = rng() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 14; y += (rng() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); } }
      if (this.mode === 'classic') { g.strokeStyle = 'rgba(255,255,255,0.025)'; g.lineWidth = 0.5; for (let i = 0; i <= CH; i += 4) { g.beginPath(); g.moveTo(i * CELL, 0); g.lineTo(i * CELL, 256); g.moveTo(0, i * CELL); g.lineTo(256, i * CELL); g.stroke(); } }
    }
    for (let r = 0; r < CH; r++) for (let c = 0; c < CH; c++) {
      const C = ox + c, R = oy + r; if (C >= m.w || R >= m.h) continue; const v = m.t[R * m.w + C]; const x = c * CELL, y = r * CELL;
      if (bush) { if (v === T_BUSH) this.drawBush(g, x, y, C, R, rng); else if (v === 14) drawTreeTop(g, x, y, C, R); continue; }
      switch (v) {
        case T_BRICK: this.drawBrick(g, x, y, C, R, m.hp[R * m.w + C]); break;
        case T_STEEL: if (m.under) this.drawRock(g, x, y, C, R, m); else this.drawSteel(g, x, y, C, R); break;
        case 10: this.drawHatch(g, x, y, C, R, m); break;
        case 11: this.drawConc(g, x, y, C, R); break;
        case T_WATER: this.drawWater(g, x, y, C, R); break;
        case T_ICE: this.drawIce(g, x, y, C, R, rng); break;
        case T_MUD: this.drawMud(g, x, y, C, R); break;
        case 12: drawHouse(g, x, y, C, R, m); break; case 13: drawFence(g, x, y, C, R, m); break; case 14: drawTreeBase(g, x, y, C, R); break; case 15: drawTrench(g, x, y, C, R, m); break; // r37 «Траншеи»
        case T_SWAMP: this.drawSwamp(g, x, y, C, R, m); break;
        case T_CRATE: this.drawCrate(g, x, y, C, R); break;
      }
    }
    if (!bush) {
      if (m.hz) { // r37 BR relief (cached in the chunk → free at runtime): lit hills/mountains, dark craters with rims
        const X0 = ox * CELL, Y0 = oy * CELL, S = CH * CELL; g.save(); g.translate(-X0, -Y0);
        for (const f of m.hz) { if (f.x + f.r * 1.4 < X0 || f.x - f.r * 1.4 > X0 + S || f.y + f.r * 1.4 < Y0 || f.y - f.r * 1.4 > Y0 + S) continue; const r = f.r;
          if (f.h > 0) { let gr = g.createRadialGradient(f.x + r * 0.28, f.y + r * 0.3, r * 0.2, f.x + r * 0.2, f.y + r * 0.22, r * 1.12); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(10,20,0,0.16)'); gr.addColorStop(0.85, 'rgba(10,15,0,0.40)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x + r * 0.12, f.y + r * 0.14, r * 1.12, 0, TAU); g.fill();
            gr = g.createRadialGradient(f.x - r * 0.3, f.y - r * 0.32, 2, f.x, f.y, r); gr.addColorStop(0, f.k === 'mtn' ? 'rgba(235,228,205,0.55)' : 'rgba(250,245,200,0.42)'); gr.addColorStop(0.6, 'rgba(220,230,170,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.fill();
            g.lineWidth = 0.7; for (let q = 0.3; q < 1; q += 0.23) { g.strokeStyle = 'rgba(0,0,0,' + (0.09 + q * 0.09) + ')'; g.beginPath(); g.arc(f.x, f.y, r * q, 0, TAU); g.stroke(); }
            if (f.k === 'mtn') { for (let i = 0; i < 26; i++) { const a = rng() * TAU, d = rng() * r * 0.45; g.fillStyle = rng() < 0.5 ? 'rgba(120,115,105,0.55)' : 'rgba(200,195,180,0.5)'; g.beginPath(); g.ellipse(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 1.5 + rng() * 3, 1 + rng() * 2, rng() * 3, 0, TAU); g.fill(); } } }
          else { let gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); gr.addColorStop(0, 'rgba(30,22,10,0.58)'); gr.addColorStop(0.65, 'rgba(40,30,12,0.46)'); gr.addColorStop(0.82, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.fill();
            g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(f.x, f.y, r * 0.78, Math.PI * 0.75, Math.PI * 1.75); g.arc(f.x + r * 0.08, f.y + r * 0.08, r * 0.7, Math.PI * 1.75, Math.PI * 0.75, true); g.fill();
            g.strokeStyle = 'rgba(230,215,170,0.42)'; g.lineWidth = r * 0.1; g.beginPath(); g.arc(f.x, f.y, r * 0.86, Math.PI * 1.8, Math.PI * 0.7); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = r * 0.06; g.beginPath(); g.arc(f.x, f.y, r * 0.9, Math.PI * 0.8, Math.PI * 1.7); g.stroke();
            for (let i = 0; i < 14; i++) { const a = rng() * TAU, d = r * (0.9 + rng() * 0.25); g.fillStyle = 'rgba(90,70,40,0.4)'; g.beginPath(); g.ellipse(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 1 + rng() * 2.5, 0.8 + rng() * 1.6, a, 0, TAU); g.fill(); } } }
        g.restore(); }
    }
    // ambient occlusion-ish shadows below solid blocks
    if (!bush) {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let r = 0; r < CH; r++) for (let c = 0; c < CH; c++) {
        const C = ox + c, R = oy + r; if (C >= m.w || R >= m.h) continue; const v = m.t[R * m.w + C];
        if (v !== T_EMPTY && v !== T_ICE && v !== T_BUSH && v !== T_MUD && v !== T_SWAMP) continue;
        const up = m.get(C, R - 1), lf = m.get(C - 1, R);
        if (up === T_BRICK || up === T_STEEL || up === T_CRATE) g.fillRect(c * CELL, r * CELL, CELL, 2.5);
        if (lf === T_BRICK || lf === T_STEEL || lf === T_CRATE) g.fillRect(c * CELL, r * CELL, 2, CELL);
      }
    }
    return { cv, s };
  }
  drawBrick(g, x, y, C, R, hp) {
    g.fillStyle = '#5a2414'; g.fillRect(x, y, CELL, CELL);
    const rows = [[0, 0], [4, 4]];
    for (let k = 0; k < 2; k++) {
      const yy = y + k * 4, off = ((R + k) % 2) * 4;
      for (let bx = -off; bx < CELL; bx += 8) {
        const x0 = Math.max(x, x + bx + 0.5), x1 = Math.min(x + CELL, x + bx + 7.5); if (x1 <= x0) continue;
        g.fillStyle = '#b4532f'; g.fillRect(x0, yy + 0.5, x1 - x0, 3);
        g.fillStyle = '#d97a4a'; g.fillRect(x0, yy + 0.5, x1 - x0, 0.9);
        g.fillStyle = '#8a3a1e'; g.fillRect(x0, yy + 2.7, x1 - x0, 0.8);
      }
    }
    if (hp < 0.99) { g.fillStyle = 'rgba(20,8,4,' + (0.55 * (1 - hp)) + ')'; g.fillRect(x, y, CELL, CELL); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x + 2, y + 1); g.lineTo(x + 4, y + 4); g.lineTo(x + 3, y + 7); g.stroke(); }
  }
  drawRock(g, x, y, C, R, m) { // r15 bunker bedrock with bevelled edges along tunnels
    const h = ((C * 73856093) ^ (R * 19349663)) >>> 0, n = (k) => ((h >>> k) & 15) / 15; g.fillStyle = 'rgb(' + (34 + n(0) * 10 | 0) + ',' + (30 + n(4) * 8 | 0) + ',' + (27 + n(8) * 6 | 0) + ')'; g.fillRect(x, y, CELL, CELL);
    g.fillStyle = 'rgba(255,240,220,0.05)'; g.fillRect(x + n(12) * 5, y + n(16) * 5, 2 + n(20) * 2, 1.5);
    const open = (v) => v !== T_STEEL; if (open(m.get(C, R + 1))) { g.fillStyle = '#5c5146'; g.fillRect(x, y + CELL - 2.2, CELL, 2.2); g.fillStyle = '#7a6c5c'; g.fillRect(x, y + CELL - 2.2, CELL, 0.7); }
    if (open(m.get(C, R - 1))) { g.fillStyle = '#0d0b0a'; g.fillRect(x, y, CELL, 1.4); } if (open(m.get(C - 1, R))) { g.fillStyle = '#16130f'; g.fillRect(x, y, 1.4, CELL); } if (open(m.get(C + 1, R))) { g.fillStyle = '#4a4138'; g.fillRect(x + CELL - 1.4, y, 1.4, CELL); }
  }
  drawHatch(g, x, y, C, R, m) { // 2×2 armoured hatch / ramp; each cell draws its quarter
    const dx = m.get(C - 1, R) === 10 ? 1 : 0, dy = m.get(C, R - 1) === 10 ? 1 : 0, X = x - dx * CELL, Y = y - dy * CELL, S = CELL * 2, cx = X + S / 2, cy = Y + S / 2;
    g.save(); g.beginPath(); g.rect(x, y, CELL, CELL); g.clip();
    g.fillStyle = '#1b1a18'; g.fillRect(X, Y, S, S); for (let i = -4; i < 8; i++) { g.fillStyle = i % 2 ? '#e8b02a' : '#191919'; g.beginPath(); g.moveTo(X + i * 3, Y); g.lineTo(X + i * 3 + 3, Y); g.lineTo(X + i * 3 + 3 - S, Y + S); g.lineTo(X + i * 3 - S, Y + S); g.fill(); }
    const gr = g.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 6.5); gr.addColorStop(0, '#c9ced4'); gr.addColorStop(0.6, '#6d757e'); gr.addColorStop(1, '#2c3136'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 6.3, 0, TAU); g.fill();
    g.strokeStyle = '#23272b'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(cx - 4, cy); g.lineTo(cx + 4, cy); g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 4); g.stroke(); g.beginPath(); g.arc(cx, cy, 4.6, 0, TAU); g.stroke();
    g.fillStyle = m.under ? '#ffd27a' : '#ffb347'; g.beginPath(); g.moveTo(cx, cy - 2.6); g.lineTo(cx + 2, cy + (m.under ? -0.6 : 1.4)); g.lineTo(cx - 2, cy + (m.under ? -0.6 : 1.4)); g.closePath(); if (!m.under) { g.save(); g.translate(cx, cy); g.rotate(Math.PI); g.translate(-cx, -cy); g.fill(); g.restore(); } else g.fill();
    g.restore();
  }
  drawConc(g, x, y, C, R) { // r20: cast concrete barrier block — chamfered edges, pores, seam, lifting loop
    const h = ((C * 73856093) ^ (R * 19349663)) >>> 0; g.fillStyle = '#a9a59b'; g.fillRect(x, y, CELL, CELL); g.fillStyle = '#c8c4b9'; g.fillRect(x + 0.8, y + 0.8, CELL - 1.6, CELL - 1.6);
    g.fillStyle = '#d9d5cb'; g.fillRect(x + 0.8, y + 0.8, CELL - 1.6, 1); g.fillStyle = '#8f8b81'; g.fillRect(x + 0.8, y + CELL - 1.6, CELL - 1.6, 0.8);
    g.fillStyle = 'rgba(70,66,60,0.45)'; for (let k = 0; k < 5; k++) { const v = (h >> (k * 5)) & 31; g.fillRect(x + 1.4 + (v % 6), y + 1.6 + ((v >> 2) % 5), 0.45, 0.45); }
    g.fillStyle = 'rgba(60,56,50,0.35)'; if ((C + R) % 2) g.fillRect(x + CELL / 2 - 0.15, y + 1, 0.3, CELL - 2); g.strokeStyle = '#6d6a63'; g.lineWidth = 0.45; g.beginPath(); g.arc(x + CELL / 2, y + CELL / 2, 0.9, 0, Math.PI * 2); g.stroke(); }
  drawSteel(g, x, y, C, R) {
    const m = this.mapRef;
    g.fillStyle = '#6f7a86'; g.fillRect(x, y, CELL, CELL);
    const top = m.get(C, R - 1) !== T_STEEL, left = m.get(C - 1, R) !== T_STEEL, bot = m.get(C, R + 1) !== T_STEEL, right = m.get(C + 1, R) !== T_STEEL;
    const grd = g.createLinearGradient(x, y, x + CELL, y + CELL); grd.addColorStop(0, '#b9c3cd'); grd.addColorStop(0.5, '#8c97a3'); grd.addColorStop(1, '#5d6670');
    g.fillStyle = grd; g.fillRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    g.fillStyle = '#dfe6ec'; if (top) g.fillRect(x, y, CELL, 1); if (left) g.fillRect(x, y, 1, CELL);
    g.fillStyle = '#3b424a'; if (bot) g.fillRect(x, y + CELL - 1, CELL, 1); if (right) g.fillRect(x + CELL - 1, y, 1, CELL);
    if ((C + R) % 2 === 0) { g.fillStyle = '#4b535c'; g.beginPath(); g.arc(x + 4, y + 4, 0.9, 0, TAU); g.fill(); g.fillStyle = '#e8eef3'; g.fillRect(x + 3.4, y + 3.3, 0.6, 0.5); }
  }
  drawWater(g, x, y, C, R) { // r25: depth colour (distance to shore), shallow sand fringe, soft broken shoreline foam
    const m = this.mapRef, isW = (cc, rr) => { const v = m.get(cc, rr); return v === T_WATER || v === T_ICE; };
    let dep = 3; for (let d = 1; d <= 3 && dep === 3; d++) for (let k = -d; k <= d; k++) if (!isW(C + k, R - d) || !isW(C + k, R + d) || !isW(C - d, R + k) || !isW(C + d, R + k)) { dep = d - 1; break; }
    g.fillStyle = ['#2f7a8c', '#22627e', '#1a4e70', '#123d5e'][dep]; g.fillRect(x, y, CELL, CELL);
    const h = (C * 2654435761 ^ R * 40503) >>> 0; g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + (h % 5), y + ((h >> 4) % 6), 3, 0.7);
    const edge = (cc, rr) => !isW(cc, rr);
    if (dep === 0) { g.fillStyle = 'rgba(194,178,128,0.28)'; if (edge(C, R - 1)) g.fillRect(x, y, CELL, 2.2); if (edge(C - 1, R)) g.fillRect(x, y, 2.2, CELL); if (edge(C, R + 1)) g.fillRect(x, y + CELL - 2.2, CELL, 2.2); if (edge(C + 1, R)) g.fillRect(x + CELL - 2.2, y, 2.2, CELL);
      g.fillStyle = 'rgba(235,248,255,0.6)'; const f = (h >> 7) % 3;
      if (edge(C, R - 1)) { g.fillRect(x, y + 0.6, CELL - f, 0.9); g.fillRect(x + 2 + f, y + 1.8, 2.5, 0.6); } if (edge(C - 1, R)) { g.fillRect(x + 0.6, y + f, 0.9, CELL - f); g.fillRect(x + 1.8, y + 3, 0.6, 2); }
      if (edge(C, R + 1)) { g.fillRect(x + f, y + CELL - 1.5, CELL - f, 0.9); } if (edge(C + 1, R)) { g.fillRect(x + CELL - 1.5, y, 0.9, CELL - f); } }
  }
  drawMud(g, x, y, C, R) { const h = (C * 73856093 ^ R * 19349663) >>> 0;
    g.fillStyle = '#5a4630'; g.fillRect(x, y, CELL, CELL); g.fillStyle = 'rgba(30,22,12,0.35)'; g.beginPath(); g.ellipse(x + 2 + (h % 4), y + 3 + ((h >> 3) % 3), 2.2, 1.2, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(160,130,90,0.25)'; g.fillRect(x + ((h >> 5) % 6), y + ((h >> 8) % 6), 1.4, 0.8); }
  drawSwamp(g, x, y, C, R, m) { const h = (C * 2654435761 ^ R * 40503) >>> 0;
    g.fillStyle = '#2f3b24'; g.fillRect(x, y, CELL, CELL); g.fillStyle = 'rgba(80,110,50,0.45)'; g.fillRect(x, y, CELL, CELL * 0.5);
    if (h % 5 === 0) { g.fillStyle = '#5f7a32'; g.beginPath(); g.ellipse(x + 4, y + 4, 2, 1.2, (h % 7) * 0.5, 0, TAU); g.fill(); } // duckweed
    if (h % 9 === 0) { g.strokeStyle = '#4a6b2a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x + 2, y + 7); g.lineTo(x + 2.6, y + 2); g.moveTo(x + 3.4, y + 7); g.lineTo(x + 4.6, y + 3); g.stroke(); } // reeds
    if (m.get(C, R - 1) !== T_SWAMP) { g.fillStyle = 'rgba(30,22,12,0.5)'; g.fillRect(x, y, CELL, 1); } }
  drawIce(g, x, y, C, R, rng) {
    g.fillStyle = '#a9d4e6'; g.fillRect(x, y, CELL, CELL); g.fillStyle = 'rgba(255,255,255,0.55)';
    if ((C + R * 3) % 5 === 0) { g.save(); g.translate(x + 4, y + 4); g.rotate(-0.6); g.fillRect(-3, -0.4, 6, 0.8); g.restore(); }
    g.fillStyle = 'rgba(70,120,150,0.18)'; g.fillRect(x, y + CELL - 0.6, CELL, 0.6);
  }
  drawCrate(g, x, y, C, R) {
    const m = this.mapRef; const n = (cc, rr) => m.get(cc, rr) === T_CRATE;
    g.fillStyle = '#9c6a32'; g.fillRect(x, y, CELL, CELL);
    g.fillStyle = '#b98543'; g.fillRect(x, y + 1, CELL, 2.2); g.fillRect(x, y + 5, CELL, 2.2);
    g.fillStyle = '#6b4520';
    if (!n(C, R - 1)) g.fillRect(x, y, CELL, 1.2); if (!n(C, R + 1)) g.fillRect(x, y + CELL - 1.2, CELL, 1.2);
    if (!n(C - 1, R)) g.fillRect(x, y, 1.2, CELL); if (!n(C + 1, R)) g.fillRect(x + CELL - 1.2, y, 1.2, CELL);
    g.fillStyle = '#d9d2c0'; if (!n(C - 1, R) && !n(C, R - 1)) g.fillRect(x + 0.4, y + 0.4, 1.6, 1.6); if (!n(C + 1, R) && !n(C, R + 1)) g.fillRect(x + CELL - 2, y + CELL - 2, 1.6, 1.6);
    if (!n(C + 1, R) && !n(C, R - 1)) g.fillRect(x + CELL - 2, y + 0.4, 1.6, 1.6); if (!n(C - 1, R) && !n(C, R + 1)) g.fillRect(x + 0.4, y + CELL - 2, 1.6, 1.6);
  }
  // r22: realistic shrubs / small trees instead of flat green blobs: ground shadow, dark inner foliage, many lit leaf clusters, specular tips
  drawBush(g, x, y, C, R, rng) {
    const tree = rng() < 0.22, cx = x + 4 + (rng() - 0.5) * 2, cy = y + 4 + (rng() - 0.5) * 2, rad = tree ? 6.2 + rng() * 1.6 : 4.4 + rng() * 1.2;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx + 2.2, cy + 2.6, rad * 1.05, rad * 0.8, 0.5, 0, TAU); g.fill();
    const n = tree ? 16 : 11; for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) { const a = rng() * TAU, r = rad * (pass === 0 ? 0.25 + rng() * 0.55 : 0.1 + rng() * 0.62) * (1 - pass * 0.18), px = cx + Math.cos(a) * r - pass * 0.5, py = cy + Math.sin(a) * r - pass * 0.6, lr = (tree ? 1.9 : 1.5) * (1 - pass * 0.2) * (0.7 + rng() * 0.6);
      const base = pass === 0 ? [28, 52, 22] : pass === 1 ? [46, 84, 34] : [78, 122, 50], v = 0.8 + rng() * 0.35, hue = rng() < 0.15 ? [12, 6, -6] : [0, 0, 0];
      g.fillStyle = 'rgb(' + ((base[0] + hue[0]) * v | 0) + ',' + ((base[1] + hue[1]) * v | 0) + ',' + ((base[2] + hue[2]) * v | 0) + ')'; g.beginPath(); g.ellipse(px, py, lr, lr * (0.7 + rng() * 0.3), rng() * 3, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(190,220,140,0.22)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx - rad * 0.3 + rng() * rad * 0.4, cy - rad * 0.35 + rng() * rad * 0.3, 0.6, 0, TAU); g.fill(); }
  }
  getChunk(kx, ky, bush) {
    const key = kx + ',' + ky, store = bush ? this.bushChunks : this.chunks; let ch = store.get(key);
    if (!ch) { ch = this.buildChunk(kx, ky, bush); store.set(key, ch); if (store.size > 40) { const first = store.keys().next().value; store.delete(first); } }
    else { store.delete(key); store.set(key, ch); }
    return ch;
  }
  drawLayer(bush, x0, y0, x1, y1) {
    const g = this.ctx, m = this.mapRef, span = CH * CELL;
    const k0x = Math.max(0, Math.floor(x0 / span)), k1x = Math.min(Math.ceil(m.w / CH) - 1, Math.floor(x1 / span));
    const k0y = Math.max(0, Math.floor(y0 / span)), k1y = Math.min(Math.ceil(m.h / CH) - 1, Math.floor(y1 / span));
    for (let ky = k0y; ky <= k1y; ky++) for (let kx = k0x; kx <= k1x; kx++) { const ch = this.getChunk(kx, ky, bush); g.drawImage(ch.cv, kx * span, ky * span, span, span); }
  }

  // ---------- effects ----------
  addParticle(p) { if (this.particles.length > 900 * this.quality) return; this.particles.push(p); }
  // r21: layered explosions by ammo type: flash light, fireball, shockwave + ground dust ring, dirt clods with gravity,
  // sparks/embers, lingering smoke columns, scorch decal. kind: 'tank' | 'rocket' | 'he' | 'fire' | 'emp' | 'mine' | 'small'
  boom(x, y, s, tank, w) { const q = this.quality, R = Math.random, kind = tank ? 'tank' : w === 'rocket' || w === 'hrocket' ? 'rocket' : w === 'mortar' || w === 'mine' || w === 'heavy' ? 'he' : w === 'flame' || w === 'incendiary' ? 'fire' : w === 'emp' ? 'emp' : s < 0.8 ? 'small' : 'he';
    const S = Math.max(0.5, s) * (this.ultra ? 1.7 : 1), emp = kind === 'emp', big = kind === 'tank' || kind === 'rocket';
    this.addParticle({ k: 'light', x, y, life: 0.22 + 0.1 * S, t: 0, r: 70 * S, c: emp ? '120,220,255' : '255,200,120' });
    this.addParticle({ k: 'fball', x, y, life: 0.5 + 0.25 * S, t: 0, r: (big ? 15 : 11) * S, c: emp ? 1 : 0 });
    for (let i = 0; i < (big ? 7 : 4) * q; i++) { const a = R() * TAU, d = R() * 8 * S; this.addParticle({ k: 'fball', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * 25 * S, vy: Math.sin(a) * 25 * S, life: 0.35 + R() * 0.35, t: -R() * 0.08, r: (5 + R() * 6) * S, c: emp ? 1 : 0 }); }
    this.addParticle({ k: 'shock', x, y, life: 0.32, t: 0, r: 34 * S, c: emp ? '150,230,255' : '255,235,200' });
    this.addParticle({ k: 'dust', x, y, life: 1.1 + 0.4 * S, t: 0, r: 30 * S });
    const nd = (kind === 'he' ? 22 : big ? 16 : 8) * S * q; for (let i = 0; i < nd; i++) { const a = R() * TAU, v = 30 + R() * 90 * S; this.addParticle({ k: 'dirt', x, y, z: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 60 + R() * 140 * S, life: 0.9 + R() * 0.6, t: 0, sz: 1 + R() * 2.2, c: R() < 0.5 ? '#3b3022' : '#56462f' }); }
    for (let i = 0; i < 14 * S * q; i++) { const a = R() * TAU, v = 80 + R() * 220; this.addParticle({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.15 + R() * 0.35, t: 0, c: emp ? 'rgba(150,230,255,1)' : undefined }); }
    const ns = (big ? 12 : kind === 'small' ? 4 : 8) * S * q, sc = kind === 'tank' || kind === 'rocket' ? '34,32,30' : kind === 'he' ? '88,80,68' : '70,70,70';
    for (let i = 0; i < ns; i++) { const a = R() * TAU, v = 6 + R() * 22; this.addParticle({ k: 'smoke', x: x + Math.cos(a) * 5 * S, y: y + Math.sin(a) * 5 * S, vx: Math.cos(a) * v + 4, vy: Math.sin(a) * v - 6, life: (kind === 'tank' ? 4 : 2.2) + R() * 2.5, t: -0.15 - R() * 0.3, r: (4 + R() * 5) * S, c: sc }); }
    if (kind === 'tank' || kind === 'fire') for (let i = 0; i < 10 * q; i++) this.addParticle({ k: 'fire', x: x + (R() - 0.5) * 10, y: y + (R() - 0.5) * 10, vx: (R() - 0.5) * 8, vy: -6 - R() * 10, life: 0.8 + R() * 1.6, t: -R() * 1.2, r: 2 + R() * 3 });
    if (tank) for (let i = 0; i < 14; i++) { const a = R() * TAU, v = 40 + R() * 110; this.addParticle({ k: 'debris', x, y, z: 0, vz: 80 + R() * 160, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + R() * 0.6, t: 0, rot: R() * 6, vr: (R() - 0.5) * 20, c: R() < 0.5 ? '#2a2b26' : '#4a4c40', sz: 2 + R() * 2.5 }); }
    this.decals.push({ k: 'scorch', x, y, r: (kind === 'small' ? 7 : 11) * S, t: 0, life: 60 }); if (this.decals.length > 700) this.decals.splice(0, 100);
    if (this.ultra) { /* r25 Ultra: second shockwave, ground light flash, ember shower, extra fireballs */ this.addParticle({ k: 'shock', x, y, life: 0.55, t: 0, r: 60 * S, c: '255,250,235' }); this.addParticle({ k: 'light', x, y, life: 0.45, t: 0, r: 130 * S, c: '255,180,90' }); this.addParticle({ k: 'ring', x, y, life: 0.9, t: 0, r: 8 * S, g: 50 * S, w: 2.5, c: '120,110,95' });
      for (let i = 0; i < 26 * S; i++) { const a = R() * TAU, v = 60 + R() * 260; this.addParticle({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.4 + R() * 0.7, t: 0, c: 'rgba(255,' + (150 + (R() * 90 | 0)) + ',60,1)' }); }
      for (let i = 0; i < (big ? 8 : 3); i++) { const a = R() * TAU, d = 6 + R() * 12 * S; this.addParticle({ k: 'fball', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * 18, vy: Math.sin(a) * 18 - 8, life: 0.7 + R() * 0.4, t: -R() * 0.12, r: 9 * S }); }
      for (let i = 0; i < (big ? 10 : 4) * S; i++) { const a = R() * TAU; this.addParticle({ k: 'smoke', x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, vx: Math.cos(a) * 10 + 3, vy: Math.sin(a) * 10 - 12, life: 3.5, t: 0, r: 5 * S, c: '38,35,33' }); } }
    this.shake = Math.max(this.shake, (big ? 9 : 5) * S); }
  hit(x, y, s, w) {
    const col = s === 2 ? '#dfefff' : s === 3 ? '#7fd8ff' : (WEAPONS[w] ? WEAPONS[w].color : '#ffe27a');
    for (let i = 0; i < 6 * this.quality; i++) { const a = Math.random() * TAU, v = 40 + Math.random() * 110; this.addParticle({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.12 + Math.random() * 0.18, t: 0, c: col }); }
    this.addParticle({ k: 'flash', x, y, life: 0.07, t: 0, r: 8 });
    this.addParticle({ k: 'smoke', x, y, vx: 0, vy: -6, life: 0.5, t: 0, r: 2.5 });
  }
  crumbleFx(e) { crumbleFx(this, e); }
  brickFx(x, y, steel) {
    for (let i = 0; i < 5 * this.quality; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 60; this.addParticle({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, t: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, c: steel ? '#9aa6b2' : (Math.random() < 0.5 ? '#b4532f' : '#7a3018'), sz: 1.5 }); }
    this.addParticle({ k: 'smoke', x, y, vx: 0, vy: -5, life: 0.7, t: 0, r: 4, c: steel ? '160,170,180' : '150,110,90' });
  }
  crateFx(x, y) { for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, v = 30 + Math.random() * 80; this.addParticle({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.5, t: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, c: Math.random() < 0.5 ? '#b98543' : '#6b4520', sz: 2.2 }); } this.addParticle({ k: 'ring', x, y, life: 0.3, t: 0, r: 16, c: '255,220,140' }); }
  muzzle(x, y, a, w) {
    this.addParticle({ k: 'muzzle', x, y, a, life: 0.06, t: 0, w });
    for (let i = 0; i < 3 * this.quality; i++) { const aa = a + (Math.random() - 0.5) * 0.8, v = 30 + Math.random() * 40; this.addParticle({ k: 'smoke', x, y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.35 + Math.random() * 0.3, t: 0, r: 1.5 + Math.random() * 1.5 }); }
  }
  hitFlash(x, y, v) { const n = Math.min(3, 1 + (v / 40 | 0)); this.addParticle({ k: 'flash', x, y, life: 0.12, t: 0, r: 12 + Math.min(24, v * 0.3) }); for (let i = 0; i < 5 * n; i++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 140; this.addParticle({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.2 + Math.random() * 0.15, t: 0, c: '#ffd060' }); } this.shake = Math.max(this.shake || 0, Math.min(3, v / 30)); } // r26: hit flash
  popup(x, y, text, color, big) { this.popups.push({ x, y, text, color, t: 0, life: big ? 1.4 : 0.9, big }); if (this.popups.length > 40) this.popups.shift(); }
  pickupFx(x, y, color) { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; this.addParticle({ k: 'spark', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.35, t: 0, c: color }); } this.addParticle({ k: 'ring', x, y, life: 0.35, t: 0, r: 20, c: '255,255,255' }); }
  stepFx(dt) {
    this.t += dt; this.shake = Math.max(0, this.shake - dt * 30); this.flashT = Math.max(0, this.flashT - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.t += dt; if (p.t >= p.life) { this.particles.splice(i, 1); continue; }
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; const d = p.k === 'spark' ? 0.9 : p.k === 'debris' ? 0.9 : 0.94; const f = Math.pow(d, dt * 60); p.vx *= f; p.vy *= f; }
      if (p.rot !== undefined) p.rot += p.vr * dt;
      if (p.vz !== undefined) { p.z += p.vz * dt; p.vz -= 260 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.25; p.vx *= 0.5; p.vy *= 0.5; } }
    }
    for (let i = this.popups.length - 1; i >= 0; i--) { const p = this.popups[i]; p.t += dt; if (p.t >= p.life) this.popups.splice(i, 1); }
  }
  addTread(t) {
    if (this.quality < 1) return;
    if (!t._lt || Math.hypot(t.x - t._lt.x, t.y - t._lt.y) > 4) {
      const c = Math.cos(t.a), s = Math.sin(t.a);
      const deep = t.terr === 1 || t.terr === 3, L = deep ? (this.mapRef && this.mapRef.trench ? 45 : 14) : 6; this.decals.push({ k: 'tread', x: t.x - s * 5, y: t.y + c * 5, a: t.a, t: 0, life: L, d: deep }); this.decals.push({ k: 'tread', x: t.x + s * 5, y: t.y - c * 5, a: t.a, t: 0, life: L, d: deep });
      if (deep && Math.random() < 0.6) this.addParticle({ k: 'spark', x: t.x - c * 7, y: t.y - s * 7, vx: -c * 20 + (Math.random() - 0.5) * 30, vy: -s * 20 + (Math.random() - 0.5) * 30, life: 0.35, t: 0, c: t.terr === 1 ? '#6b5236' : '#5f7a32' });
      t._lt = { x: t.x, y: t.y }; if (this.decals.length > 700) this.decals.splice(0, 60);
    }
  }

  // ---------- tank ----------
  drawTank(g, t, mode, isMe, time) {
    if (t.cloaked) { const ally = this.view && this.meId && (this.view.tanks.find(o => o.id === this.meId) || {}).team === t.team && this.view.mode !== 'ffa'; if (!isMe && !ally) { if (Math.random() < 0.15) this.addParticle({ k: 'ring', x: t.x + (Math.random() - 0.5) * 10, y: t.y + (Math.random() - 0.5) * 10, vx: 0, vy: 0, life: 0.5, t: 0, r: 1, g: 5, c: '200,190,255' }); return; } g.save(); g.globalAlpha = 0.35; this._drawTank(g, t, mode, isMe, time); g.restore(); return; } // r26 «Невидимка»: enemies see only a faint shimmer
    if (t.sub) { // fully submerged: only faint bubbles + ripples (own tank as a ghost so the player knows where it is)
      if (Math.random() < 0.08) this.addParticle({ k: 'ring', x: t.x + (Math.random() - 0.5) * 8, y: t.y + (Math.random() - 0.5) * 8, vx: 0, vy: 0, life: 1.2, t: 0, r: 1, g: 6, c: '190,220,170' });
      if (isMe) { g.save(); g.globalAlpha = 0.22; t.sub = 0; this.drawTank(g, t, mode, false, time); t.sub = 1; g.restore(); }
      else if (t._rv) { g.strokeStyle = 'rgba(255,60,90,' + (0.6 + 0.3 * Math.sin(time * 8)) + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(t.x, t.y, 11, 0, TAU); g.stroke(); }
      return; }
    if (t._rv && !isMe) { g.strokeStyle = 'rgba(255,60,90,' + (0.55 + 0.3 * Math.sin(time * 8)) + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(t.x, t.y, 12, 0, TAU); g.stroke(); } // revealed by «Маяк»
    const sink = t.terr === 2 || t.terr === 3; if (sink) { g.save(); g.translate(0, 1.4); }
    this._drawTank(g, t, mode, isMe, time);
    if (t.gm && t.gm.length) this.drawGM(g, t, time); // r27: visible mod hardware
    if (t.terr === 1) { t._dirt = Math.min(1, (t._dirt || 0) + 0.004); } else if (t._dirt > 0) t._dirt -= 0.0006;
    if (t._dirt > 0.05) { g.save(); g.translate(t.x, t.y); g.rotate(t.a); g.fillStyle = 'rgba(70,52,30,' + (0.35 * t._dirt) + ')'; g.fillRect(-9, -7, 18, 3); g.fillRect(-9, 4, 18, 3); g.restore(); }
    if (sink) { g.restore(); g.save(); g.translate(t.x, t.y + 3); g.fillStyle = 'rgba(47,59,36,' + (t.terr === 2 ? 0.72 : 0.45) + ')'; g.beginPath(); g.ellipse(0, 1, 13, 6, 0, 0, TAU); g.fill(); g.restore();
      if (Math.random() < 0.05) this.addParticle({ k: 'ring', x: t.x, y: t.y + 3, vx: 0, vy: 0, life: 1, t: 0, r: 9, g: 5, c: '160,200,140' }); }
    if (t.surfT > 0 && Math.random() < 0.6) this.addParticle({ k: 'spark', x: t.x + (Math.random() - 0.5) * 14, y: t.y + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 40, life: 0.4, t: 0, c: '#8fb06a' });
  }
  drawGM(g, t, time) { const has = (id) => t.gm.find(m => GMODS[m[0]] && GMODS[m[0]].id === id); g.save(); g.translate(t.x, t.y); g.rotate(t.a);
    const sp = has('spikes'); if (sp) { g.fillStyle = '#c8c8c8'; for (let q = -1; q <= 1; q++) { g.beginPath(); g.moveTo(10, q * 4 - 1.5); g.lineTo(10 + 3 + sp[2], q * 4); g.lineTo(10, q * 4 + 1.5); g.fill(); } }
    const dz = has('dozer'); if (dz) { g.fillStyle = '#ffcc33'; g.fillRect(10, -8, 2 + dz[2] * 0.5, 16); g.fillStyle = '#5a4a10'; g.fillRect(10, -8, 1, 16); }
    const rx = has('reactive'); if (rx) { g.fillStyle = '#ff8a3d'; for (let q = -6; q <= 6; q += 4) { g.fillRect(q - 1.4, -7.6, 2.8, 1.6); g.fillRect(q - 1.4, 6, 2.8, 1.6); } }
    const scr = has('spaced'); if (scr) { g.fillStyle = 'rgba(201,179,138,0.9)'; g.fillRect(-9, -9, 18, 1.4); g.fillRect(-9, 7.6, 18, 1.4); }
    const cm = has('camo'); if (cm) { g.strokeStyle = 'rgba(111,143,58,0.8)'; g.lineWidth = 0.6; for (let q = -8; q <= 8; q += 3) { g.beginPath(); g.moveTo(q, -6); g.lineTo(q + 3, 6); g.stroke(); } }
    const rd = has('radar'); if (rd) { g.save(); g.translate(-4, 0); g.rotate(time * 4); g.fillStyle = '#00e5ff'; g.fillRect(-0.6, -3, 1.2, 6); g.restore(); }
    const ap = has('aps'); if (ap) { g.fillStyle = '#4ff0ff'; g.beginPath(); g.arc(-6, -5, 1.4, 0, TAU); g.arc(-6, 5, 1.4, 0, TAU); g.fill(); }
    const am = has('amph'); if (am) { g.fillStyle = 'rgba(61,139,255,0.8)'; g.fillRect(-10, -6, 1.6, 12); }
    const ws = has('wide'); if (ws) { g.fillStyle = 'rgba(40,30,20,0.85)'; g.fillRect(-9, -10, 18, 1.6); g.fillRect(-9, 8.4, 18, 1.6); }
    const sm = has('smoke'); if (sm) { g.fillStyle = '#bbb'; g.fillRect(2, -6, 2, 2); g.fillRect(2, 4, 2, 2); }
    const ex = has('ext'); if (ex) { g.fillStyle = '#ff3b2f'; g.fillRect(-9, -3, 2, 3); }
    const nt = has('nitro') || has('turbo'); if (nt && Math.hypot(t.vx || 0, t.vy || 0) > 30 && Math.random() < 0.4) { g.restore(); this.addParticle({ k: 'spark', x: t.x - Math.cos(t.a) * 11, y: t.y - Math.sin(t.a) * 11, vx: -Math.cos(t.a) * 40, vy: -Math.sin(t.a) * 40, life: 0.25, t: 0, c: '255,80,220' }); return; }
    g.restore();
    const sh = has('shield'); if (sh && t.shBHp > 0) { g.strokeStyle = 'rgba(90,184,255,' + (0.25 + 0.35 * (t.shBHp / (t.shBMax || 1))) + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(t.x, t.y, 15 + Math.sin(time * 5) * 0.6, 0, TAU); g.stroke(); } }
  _drawTank(g, t, mode, isMe, time) {
    let col = skinColors(t.skin, t.team, mode);
    // r15: chosen catalogue model / constructor build -> hull, turret, barrel, tracks, kit, decal and paint
    const VK = t.model + ':' + (t.build ? t.build.join('') : '') + (t.visO ? JSON.stringify(t.visO) : ''); const V = t._vis !== undefined && t._visK === VK ? t._vis : (t._visK = VK, t._vis = visOf(t));
    if (V && t.skin !== 'team' && mode !== 'team' && !(this.view && this.view.squad > 1)) col = { body: mute(V.c1), dark: mute(V.c2), light: mute(shade(V.c1, 0.2).replace(/rgb\((\d+),(\d+),(\d+)\)/, (_, a, b, c) => '#' + [a, b, c].map(v => (+v).toString(16).padStart(2, '0')).join(''))) };
    // r15: modern MBT look, drawn 22% larger than the hitbox; class silhouette by weapon (light / medium / heavy / rocket)
    const W0 = t.weapon, cls = V ? ([0, 5].includes(V.ci) ? 'L' : [2, 7].includes(V.ci) ? 'H' : 'M') : W0 === 'heavy' || W0 === 'mortar' || W0 === 'rail' ? 'H' : W0 === 'mg' || W0 === 'flame' || W0 === 'shotgun' || W0 === 'twin' ? 'L' : 'M';
    const HS = V ? [[0.92, 0.9], [1.04, 0.92], [1, 1], [1.06, 1.02], [1.1, 1.1], [1.02, 1.12]][V.hull] : null;
    const sx = HS ? HS[0] : cls === 'H' ? 1.08 : cls === 'L' ? 0.94 : 1, sy = HS ? HS[1] : cls === 'H' ? 1.1 : cls === 'L' ? 0.92 : 1;
    // r25: hull rocks back on firing + suspension bob while driving (visual only)
    const rk = (t.recoil || 0), ta0 = t.ta ?? t.a ?? 0, bob = Math.sin((t.tread || 0) * 0.9) * 0.3 * Math.min(1, Math.hypot(t.vx || 0, t.vy || 0) / 40);
    g.save(); g.translate(t.x - Math.cos(ta0) * rk * 1.6 + Math.cos((t.a || 0) + 1.57) * bob, t.y - Math.sin(ta0) * rk * 1.6 + Math.sin((t.a || 0) + 1.57) * bob); { const tc0 = this.view && this.teamCol ? this.teamCol(this.view, t) : null; if (tc0 && !this.mesh3d) { g.globalAlpha = 0.45; g.strokeStyle = tc0; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 1, 17, 15, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; } } // r17: subtle team ground ring
    g.scale(TANK_VIS, TANK_VIS); if (t.isBoss) g.scale(1.4, 1.4);
    // r18: realistic MBT sprite (hull, tracks, skirts, turret, barrel, contact shadow) — see tankart.js
    const look = lookOf(t, col, V, cls); look.pal.body = look.pal.body.map(v => v * (t.skin === 'team' ? 1 : 1)); const dims = tankDims(cls);
    const F = t.fx || {}, MB = t.mods || 0; const VO = t.visO || {}; t._m3 = { tw: VO.trk != null ? [0.88, 1, 1.12, 1.26][VO.trk] : 1, nw: VO.trk != null ? 5 + VO.trk : 0, tl: t.tur != null && TURRETS[t.tur] ? TURRETS[t.tur].look : VO.tur != null && TURRETS[(VO.tur * 9 + 3) % TURRETS.length] ? TURRETS[(VO.tur * 9 + 3) % TURRETS.length].look : null, mgr: t.weapon === 'mg' && t.mgi != null && MGS[t.mgi] ? MGS[t.mgi].r : -1, mts: t.mounts && t.mounts.length ? t.mounts.map(q => [q.w, q.pos, q.mgi != null && MGS[q.mgi] ? MGS[q.mgi].r : -1]) : null, md: { lb: (t.bulletMul || 1) > 1.01 || !!(MB & 2) || (VO.bar | 0) >= 2, radar: !!t.radar, scope: !!(MB & 1) || (F.spread || 1) < 0.99, ammo: !!(MB & 8) || (F.ammo || 1) > 1.01, spd: t.spd0 != null && t.speed > t.spd0 * 1.01 }, pal: look.pal, cls, sx, sy, kit: look.kit || (t.armMul || 1) > 1.01 || (F.splashRes || 1) < 0.99, sc: TANK_VIS * (t.isBoss ? 1.4 : 1), _t: this.t };
    if (this.mesh3d) { /* r21: GL draws the mesh and its soft sun shadow */ } // r19: 3D cameras draw the mesh; the frame only keeps its contact shadow
    else drawMBT(g, t, look, -(t.recoil || 0) * 2.2);
    g.save(); g.rotate(t.a);
    { // r15: visible battle damage builds up: dents, scorch, missing plates, broken track
      const k = t.maxHp ? t.hp / t.maxHp : 1, pb = t.pbroke || 0;
      if (k < 0.75) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(2 * sx, -2, 1.2, 0, TAU); g.arc(-4 * sx, 2.4, 1, 0, TAU); g.fill(); }
      if (k < 0.5) { g.fillStyle = 'rgba(20,14,8,0.5)'; g.beginPath(); g.ellipse(-1, 1, 4.5, 2.6, 0.6, 0, TAU); g.fill(); }
      if (pb & 16) { g.fillStyle = '#2a2d33'; g.fillRect(-6 * sx, -4.4 * sy, 4, 2.2); g.fillRect(1 * sx, 2.4 * sy, 3.5, 2); }
      if (pb & 4) { g.fillStyle = '#5a1a1a'; g.fillRect(-2, 5.8 * sy - 2.4, 4, 4.8); g.fillStyle = '#14171c'; g.fillRect(-1, 5.8 * sy - 2.4, 2, 4.8); }
      if (pb & 8 && Math.random() < 0.3) this.addParticle({ k: 'smoke', x: t.x - Math.cos(t.a) * 8, y: t.y - Math.sin(t.a) * 8, vx: 0, vy: -12, life: 0.9, t: 0, r: 2.6, c: '20,20,20' });
      if (t.burnT > 0 && Math.random() < 0.5) this.addParticle({ k: 'spark', x: t.x + (Math.random() - 0.5) * 10, y: t.y + (Math.random() - 0.5) * 10, vx: 0, vy: -25, life: 0.35, t: 0, c: Math.random() < 0.5 ? '#ff8a2a' : '#ffd23d' });
      if (t.empT > 0 && Math.random() < 0.4) this.addParticle({ k: 'spark', x: t.x + (Math.random() - 0.5) * 14, y: t.y + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.2, t: 0, c: '#5df0ff' });
      if (t.slowT > 0) { g.fillStyle = 'rgba(190,235,255,0.35)'; g.fillRect(-7.5 * sx, -4.4 * sy, 15 * sx, 8.8 * sy); }
    }
    const tcol = this.view && this.teamCol ? this.teamCol(this.view, t) : null; if (tcol) { g.globalAlpha = 0.7; g.fillStyle = tcol; g.fillRect(-dims.L / 2 + 0.5, -dims.W / 2 + dims.W * 0.25, 0.5, dims.W * 0.5); g.globalAlpha = 1; } // subtle team stripe on the rear plate
    if (t.skin === 'gold') { g.fillStyle = 'rgba(255,230,150,' + (0.12 + 0.1 * Math.sin(time * 4 + t.id)) + ')'; g.fillRect(-6, -3.5, 3, 7); }
    g.restore();
    if (t.hitT > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,' + (t.hitT * 5) + ')'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
    if (t.flash && Math.floor(time * 6) % 2 === 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,40,40,0.55)'; g.beginPath(); g.arc(0, 0, 8.5, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
    if (t.inv > 0) {
      g.strokeStyle = 'rgba(120,220,255,' + (0.22 + 0.12 * Math.sin(time * 12)) + ')'; g.lineWidth = 0.6; g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU + time; const px = Math.cos(a) * 12, py = Math.sin(a) * 12; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      g.fillStyle = 'rgba(120,220,255,0.04)'; g.fill();
    }
    if (t.shield > 0) { g.strokeStyle = 'rgba(150,200,220,0.55)'; g.lineWidth = 0.7; g.beginPath(); g.arc(0, 0, 11, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, t.shield / 60)); g.stroke(); }
    if (t.speedT > 0) { g.fillStyle = 'rgba(255,210,60,0.5)'; g.save(); g.rotate(t.a); g.fillRect(-12 - Math.random() * 3, -4, 3, 1.2); g.fillRect(-12 - Math.random() * 3, 3, 3, 1.2); g.restore(); }
    if (t.powerT > 0) { g.strokeStyle = 'rgba(255,150,60,' + (0.4 + 0.3 * Math.sin(time * 10)) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke(); }
    g.restore();
  }
  drawSpawnFx(g, t, time) {
    const k = t.spawnT; g.save(); g.translate(t.x, t.y); g.rotate(time * 6);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.4; const r = 4 + (1 - (k % 0.25) / 0.25) * 6;
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(r, 0); g.lineTo(r + 3, 0); g.stroke(); }
    g.fillStyle = 'rgba(255,240,180,0.7)'; g.beginPath(); g.arc(0, 0, 2.5, 0, TAU); g.fill(); g.restore();
  }
  // r22: pickups are real military containers lying on the ground (no bobbing / neon halo); a small coloured stencil + tier pips are the only marker
  drawPickup(g, p, time) {
    const L = p.type === 'lx' ? LOOTX[p.lid] || {} : null, info = L ? { color: L.col || '#ffffff' } : PICKUPS[p.type] || PICKUPS.med, blink = p.life < 4 && Math.floor(time * 8) % 2 === 0;
    if (blink) return; const cat = L ? L.cat : p.type, kind = /weapon|wvar|tur|mgt/.test(cat) ? 'long' : /ammo|shell|rocket|hrocket|mine/.test(cat) ? 'can' : /med|repair|spare/.test(cat) ? 'med' : /armor|blocks/.test(cat) ? 'steel' : 'crate';
    g.save(); g.translate(p.x, p.y); g.rotate(((p.id * 0.618) % 1 - 0.5) * 0.5);
    if (drawNewCrate(g, p, time)) { g.restore(); return; }
    const box = (w, h, c0, c1) => { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(-w / 2 + 1.4, -h / 2 + 1.8, w, h); const G = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); G.addColorStop(0, c0); G.addColorStop(1, c1); g.fillStyle = G; g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = 'rgba(10,10,6,0.75)'; g.lineWidth = 0.6; g.strokeRect(-w / 2 + 0.3, -h / 2 + 0.3, w - 0.6, h - 0.6); g.fillStyle = 'rgba(255,255,240,0.1)'; g.fillRect(-w / 2, -h / 2, w, 0.9); };
    if (kind === 'long') { box(15, 7, '#5d5a3a', '#3b3923'); g.fillStyle = 'rgba(20,18,10,0.6)'; for (const q of [-5, 0, 5]) g.fillRect(q - 0.4, -3.5, 0.8, 7); g.fillStyle = '#26241a'; g.fillRect(-7.9, -1.2, 0.9, 2.4); g.fillRect(7, -1.2, 0.9, 2.4); }
    else if (kind === 'can') { box(9, 6, '#4f5a39', '#303822'); g.fillStyle = '#23281a'; g.fillRect(-4.5, -0.6, 9, 1.2); g.fillStyle = '#8a8f78'; g.fillRect(-1.2, -3.6, 2.4, 1); }
    else if (kind === 'med') { box(9, 8, '#d8d8cf', '#9c9c92'); g.fillStyle = '#b3261e'; g.fillRect(-0.9, -2.8, 1.8, 5.6); g.fillRect(-2.8, -0.9, 5.6, 1.8); }
    else if (kind === 'steel') { box(11, 9, '#6c7074', '#3f4246'); g.fillStyle = 'rgba(0,0,0,0.3)'; for (const q of [-3, 0, 3]) g.fillRect(-5.5, q - 0.25, 11, 0.5); }
    else { box(11, 11, '#6a5236', '#3f2f1d'); g.strokeStyle = 'rgba(25,16,8,0.7)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-5.5, -5.5); g.lineTo(5.5, 5.5); g.moveTo(5.5, -5.5); g.lineTo(-5.5, 5.5); g.stroke(); }
    // marker: type-coloured band across the container + tier colour edge + level marks (I–III)
    { const w0 = kind === 'long' ? 15 : kind === 'can' ? 9 : 11, tr0 = p.tier || (L && L.r) || 1; g.globalAlpha *= 0.85; g.fillStyle = info.color; g.fillRect(-w0 / 2, -0.9, w0, 1.8); g.fillStyle = TIERS[Math.min(4, tr0 - 1)].color; g.fillRect(-w0 / 2, -w0 / 2 + 0.2, 1.2, w0 - 0.4);
      if (L && L.lv) { g.fillStyle = '#f4f1e6'; for (let i = 0; i < L.lv; i++) g.fillRect(w0 / 2 - 2 - i * 1.5, -w0 / 2 + 1, 0.8, 2.4); } g.globalAlpha /= 0.85; }
    g.globalAlpha = 0.75; g.fillStyle = info.color; g.fillRect(kind === 'long' ? -7.5 : -4.5, kind === 'long' ? 2.4 : 2.2, kind === 'long' ? 3 : 2.2, 0.9); g.save(); g.scale(0.42, 0.42); g.strokeStyle = info.color; g.lineWidth = 2; drawIcon(g, p.type, p.wid, p.lid); g.restore(); g.globalAlpha = 1;
    const tr = p.tier || (L && L.r) || 1; if (tr > 1 || p.type === 'weapon' || p.type === 'armor') { const tc = TIERS[Math.min(4, tr - 1)].color; g.fillStyle = tc; for (let i = 0; i < tr; i++) g.fillRect(-3 + i * 1.6, -5.6 - (kind === 'long' ? -2 : 0), 1, 1); }
    g.restore();
  }
  drawSmokes(g, view, time) {
    for (const s of view.smokes || []) { const k = Math.min(1, s.t / 1.5) * Math.min(1, (s.max - s.t + 0.3) / 0.6);
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + time * 0.25 + s.id, rr = s.r * (0.35 + 0.4 * ((i * 37) % 10) / 10); const x = s.x + Math.cos(a) * rr * 0.6, y = s.y + Math.sin(a * 1.3) * rr * 0.6;
        const gr = g.createRadialGradient(x, y, 0, x, y, s.r * 0.65); gr.addColorStop(0, 'rgba(205,212,220,' + 0.5 * k + ')'); gr.addColorStop(1, 'rgba(205,212,220,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, s.r * 0.65, 0, TAU); g.fill(); } }
  }
  drawMines(g, view, me, time) {
    for (const m of view.mines || []) { const own = me && m.team === me.team; const close = me && Math.hypot(m.x - me.x, m.y - me.y) < 34;
      if (!own && !close) continue; g.save(); g.translate(m.x, m.y); g.globalAlpha = own ? 0.9 : 0.45;
      g.fillStyle = '#2a2d33'; g.beginPath(); g.arc(0, 0, 4.2, 0, TAU); g.fill(); g.strokeStyle = own ? '#6ba8ff' : '#ff5a4a'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = (m.arm > 0 || Math.floor(time * 3) % 2) ? '#ff3b2f' : '#5a1a14'; g.beginPath(); g.arc(0, 0, 1.4, 0, TAU); g.fill(); g.restore(); }
  }
  drawBase(g, m, alive, time) {
    const x = 24 * CELL, y = 48 * CELL;
    g.save(); g.translate(x + 16, y + 16);
    if (alive) {
      g.fillStyle = '#20242b'; roundRect(g, -15, -15, 30, 30, 4); g.fill();
      const gl = g.createRadialGradient(0, 0, 2, 0, 0, 16); gl.addColorStop(0, 'rgba(255,210,90,0.45)'); gl.addColorStop(1, 'rgba(255,210,90,0)'); g.fillStyle = gl; g.fillRect(-16, -16, 32, 32);
      // stylised eagle emblem
      g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(0, -11); g.lineTo(3, -5); g.lineTo(12, -8); g.lineTo(8, 0); g.lineTo(12, 3); g.lineTo(4, 3); g.lineTo(2, 10); g.lineTo(-2, 10); g.lineTo(-4, 3); g.lineTo(-12, 3); g.lineTo(-8, 0); g.lineTo(-12, -8); g.lineTo(-3, -5); g.closePath(); g.fill();
      g.fillStyle = '#a77a1c'; g.beginPath(); g.arc(0, -3, 2.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.2 * Math.sin(time * 3)) + ')'; g.fillRect(-1, -10, 1.2, 5);
    } else {
      g.fillStyle = '#1a1a1a'; roundRect(g, -15, -15, 30, 30, 4); g.fill(); g.fillStyle = '#3a2a20'; g.beginPath(); g.moveTo(-10, 8); g.lineTo(-4, -2); g.lineTo(0, 4); g.lineTo(5, -6); g.lineTo(11, 8); g.closePath(); g.fill();
    }
    g.restore();
  }

  // ---------- frame ----------
  frame(view, meId, ui) { this.view = view; this.meId = meId; this.frameN = (this.frameN || 0) + 1;
    const g = this.ctx, W = this.W, H = this.H, dpr = this.dpr, m = view.map, time = this.t;
    if (m !== this.mapRef) this.setMap(m, view.mode);
    this.syncChanges();
    const me = view.tanks.find(t => t.id === meId) || null;
    // camera
    const cam = this.cam; const vp = ui.viewport; // {x,y,w,h} css px region for world
    cam.z = ui.zoom;
    let tx, ty;
    if (view.mode === 'classic') { tx = m.pw / 2; ty = m.ph / 2; }
    else {
      const f = me && me.alive ? me : (ui.spectate ? view.tanks.find(t => t.id === ui.spectate) : null) || me;
      tx = f ? f.x + Math.cos(f.ta) * 22 : m.pw / 2; ty = f ? f.y + Math.sin(f.ta) * 22 : m.ph / 2; if (ui.center) { tx = ui.center[0]; ty = ui.center[1]; }
      const q = ui.p2; if (q && q.alive && (!me || !me.alive)) { tx = q.x; ty = q.y; } else if (q && q.alive && me && me.alive) { tx = (me.x + q.x) / 2; ty = (me.y + q.y) / 2; cam.z = Math.max(ui.zoom * 0.45, Math.min(ui.zoom, vp.w / (Math.abs(me.x - q.x) + 140), vp.h / (Math.abs(me.y - q.y) + 220))); }
    }
    if (!this._camInit || ui.snap) { cam.x = tx; cam.y = ty; this._camInit = true; }
    { const kc = 1 - Math.exp(-(ui.dt || 0.016) * 6.5); cam.x += (tx - cam.x) * kc; cam.y += (ty - cam.y) * kc; }
    if (view.mode !== 'classic' && !q2(ui) && m.pw * cam.z < vp.w) cam.z = Math.min(ui.zoom * 2.2, vp.w / m.pw); // small maps: fill the width
    const vw = vp.w / cam.z, vh = vp.h / cam.z;
    if (view.mode !== 'classic') { cam.x = clamp(cam.x, vw / 2, m.pw - vw / 2); cam.y = clamp(cam.y, vh / 2, m.ph - vh / 2); if (vw > m.pw) cam.x = m.pw / 2; if (vh > m.ph) cam.y = m.ph / 2; }
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2, x1 = x0 + vw, y1 = y0 + vh;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = view.mode === 'classic' ? '#0b0c10' : '#151a12'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.save();
    g.beginPath(); g.rect(vp.x * dpr, vp.y * dpr, vp.w * dpr, vp.h * dpr); g.clip();
    g.setTransform(cam.z * dpr, 0, 0, cam.z * dpr, (vp.x + vp.w / 2 + sx) * dpr - cam.x * cam.z * dpr, (vp.y + vp.h / 2 + sy) * dpr - cam.y * cam.z * dpr);
    g.imageSmoothingEnabled = true;
    // outside map
    g.fillStyle = '#0d0f0b'; g.fillRect(x0 - 50, y0 - 50, vw + 100, vh + 100);
    if (x0 < 0 || y0 < 0 || x1 > m.pw || y1 > m.ph) this.drawOutside(g, m, x0, y0, x1, y1);
    this.drawLayer(false, x0, y0, x1, y1);
    this.drawWaterAnim(g, m, x0, y0, x1, y1, time);
    this.drawWrecks(g, x0, y0, x1, y1);
    this.drawFlags2(g, view, x0, y0, x1, y1, time); // decorative, under tanks/loot, no collision
    // decals
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.t += ui.dt; if (d.t > d.life) { this.decals.splice(i, 1); } }
    for (const d of this.decals) {
      if (d.x < x0 - 20 || d.x > x1 + 20 || d.y < y0 - 20 || d.y > y1 + 20) continue; const a = 1 - d.t / d.life;
      if (d.k === 'rubble') drawRubble(g, d, a);
      else if (d.k === 'tread') { g.save(); g.translate(d.x, d.y); g.rotate(d.a); g.fillStyle = d.d ? 'rgba(25,16,6,' + (0.42 * a) + ')' : 'rgba(0,0,0,' + (0.16 * a) + ')'; g.fillRect(-1.5, d.d ? -2 : -1.6, 3, d.d ? 4 : 3.2); g.restore(); }
      else { const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); gr.addColorStop(0, 'rgba(10,8,6,' + 0.55 * a + ')'); gr.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = gr; g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill(); }
    }
    if (view.mode === 'classic') this.drawBase(g, m, view.baseAlive, time);
    if (view.mode === 'team' && view.special !== 'race') this.drawTeamBases(g, m, time);
    for (const p of view.pickups) if (p.type === 'armor' && p.x > x0 - 30 && p.x < x1 + 30 && p.y > y0 - 80 && p.y < y1 + 30) drawArmorBeacon(g, p, time); // r36: armour crates glow + light column, visible from afar
    for (const p of view.pickups) if (p.x > x0 - 20 && p.x < x1 + 20 && p.y > y0 - 20 && p.y < y1 + 20) { /* r25: loot only visible up close — fades in by distance from our tank */ const fa = me && me.alive ? Math.max(0, Math.min(1, (LOOT_SEE - Math.sqrt((p.x - me.x) ** 2 + (p.y - me.y) ** 2)) / 35)) : 1; if (fa <= 0) continue; g.globalAlpha = fa; this.drawPickup(g, view.mode === 'br' && me && me.alive && p.type !== 'loot' && p.type !== 'armor' && (p.x - me.x) ** 2 + (p.y - me.y) ** 2 > LOOT_REVEAL * LOOT_REVEAL ? { ...p, type: 'loot', wid: null, tier: 1 } : p, time); g.globalAlpha = 1; }
    this.drawMines(g, view, me, time);
    drawFires(g, view, this, time); drawHTraps(g, view, me, time);
    for (const T of view.traps || []) { /* r25: rocket trap (top view) */ g.save(); g.translate(T.x, T.y); g.rotate(T.a || 0); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-4, -3.5, 9, 8); g.fillStyle = '#4a4f3c'; g.fillRect(-4.5, -3, 8, 6); for (let k = 0; k < (T.n || 0); k++) { const y = k ? -1.6 : 1.6; g.fillStyle = '#d9d8cf'; g.fillRect(-4, y - 0.8, 8, 1.6); g.fillStyle = '#b3261e'; g.fillRect(4, y - 0.8, 1.6, 1.6); } if ((time * 3 % 1) < 0.5) { g.fillStyle = '#ff3b2f'; g.fillRect(-1, -0.6, 1.2, 1.2); } g.restore(); }
    for (const t of view.tanks) if (t.alive && t.twinN > 0) { /* r25: mounted twin rockets (top view) */ g.save(); g.translate(t.x, t.y); g.rotate(t.a || 0); for (let k = 0; k < t.twinN; k++) { const y = k ? -5.8 : 5.8; g.fillStyle = '#dad9d0'; g.fillRect(-4, y - 0.9, 8, 1.8); g.fillStyle = '#b3261e'; g.fillRect(4, y - 0.9, 1.8, 1.8); } g.restore(); }
    for (const d of view.drones || []) { /* r25: drone (top view) — shadow on the ground + quadcopter with spinning rotors */ g.save(); g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(d.x + 6, d.y + 8, 6, 5, 0, 0, TAU); g.fill(); g.translate(d.x, d.y - 3); g.rotate(d.a || 0);
      g.strokeStyle = '#1b1d20'; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); } g.stroke();
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; g.fillStyle = 'rgba(190,200,210,0.28)'; g.beginPath(); g.arc(Math.cos(a) * 5, Math.sin(a) * 5, 3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(30,30,30,0.7)'; g.lineWidth = 0.5; const r0 = time * 40 + k; g.beginPath(); g.moveTo(Math.cos(a) * 5 + Math.cos(r0) * 3, Math.sin(a) * 5 + Math.sin(r0) * 3); g.lineTo(Math.cos(a) * 5 - Math.cos(r0) * 3, Math.sin(a) * 5 - Math.sin(r0) * 3); g.stroke(); }
      g.fillStyle = d.leg ? '#b8862e' : '#3a3e44'; g.fillRect(-2.6, -1.6, 5.2, 3.2); g.fillStyle = '#111'; g.fillRect(2, -0.4, 3, 0.8); g.fillStyle = (time * 2 % 1) < 0.5 ? '#ff3b2f' : '#3bff6a'; g.fillRect(-2.2, -0.4, 0.8, 0.8); g.restore(); }
    for (const s of view.sentries || []) { g.save(); g.translate(s.x, s.y); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(0.8, 1, 5, 0, TAU); g.fill(); g.strokeStyle = '#2a2e33'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); g.stroke(); } g.rotate(s.a || 0); g.fillStyle = s.team ? '#b84a44' : '#4673bd'; g.fillRect(-2.2, -1.8, 4.4, 3.6); g.fillStyle = '#111'; g.fillRect(2, -1, 5.5, 0.6); g.fillRect(2, 0.4, 5.5, 0.6); g.fillStyle = '#4ff0ff'; g.fillRect(-0.6, -0.6, 1.2, 1.2); g.rotate(-(s.a || 0)); g.fillStyle = '#000a'; g.fillRect(-5, -8, 10, 1.4); g.fillStyle = '#4ff0ff'; g.fillRect(-5, -8, 10 * Math.max(0, s.hp / (s.maxHp || 70)), 1.4); g.restore(); }
    // tanks
    const vis = [];
    for (const t of view.tanks) {
      if (!t.alive) continue; if (t.x < x0 - 30 || t.x > x1 + 30 || t.y < y0 - 30 || t.y > y1 + 30) continue;
      if (t.spawnT > 0) { this.drawSpawnFx(g, t, time); continue; }
      const rv = (t.rev || (t.revT > 0 && me && t.revTeam === me.team)); t._rv = rv;
      if (!rv && t.sub && me && t.id !== me.id && t.team !== me.team && Math.hypot(t.x - me.x, t.y - me.y) > (t.seeR || 14)) continue;
      if (!rv && t.inBush && me && t.id !== me.id && t.team !== me.team && Math.hypot(t.x - me.x, t.y - me.y) > (t.seeR || 48) && view.time - (t.lastFire ?? -9) > 1.2) continue;
      if (Math.hypot(t.vx || 0, t.vy || 0) > 10) this.addTread(t);
      this.drawTank(g, t, view.mode, me && t.id === me.id, time); vis.push(t); t._seenF = this.frameN;
      // damage smoke at low HP, dust when driving fast
      if (t.alive && t.maxHp && t.hp < t.maxHp * 0.55 && Math.random() < (t.hp < t.maxHp * 0.25 ? 0.5 : 0.18) * this.quality) this.addParticle({ k: 'smoke', x: t.x + (Math.random() - 0.5) * 6, y: t.y + (Math.random() - 0.5) * 6, vx: 2 + Math.random() * 3, vy: -9 - Math.random() * 6, life: 1.8, t: 0, r: 2.6, c: t.hp < t.maxHp * 0.25 ? '30,28,26' : '90,90,90' }); // r25: damaged-tank smoke (grey → black)
      if (this.ultra && t.alive && t.maxHp && t.hp < t.maxHp * 0.25 && Math.random() < 0.3) this.addParticle({ k: 'fire', x: t.x + (Math.random() - 0.5) * 6, y: t.y + (Math.random() - 0.5) * 6, vx: 0, vy: -10, life: 0.3, t: 0, r: 1.8 });
      if (t.alive && t.maxHp && t.hp < t.maxHp * 0.35 && Math.random() < 0.25 * this.quality) this.addParticle({ k: 'smoke', x: t.x + (Math.random() - 0.5) * 6, y: t.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 8, life: 0.9, t: 0, r: 2.4, c: t.hp < t.maxHp * 0.15 ? '40,40,40' : '90,90,90' });
      if (t.alive && (t.vx * t.vx + t.vy * t.vy) > 2500 && Math.random() < 0.12 * this.quality) this.addParticle({ k: 'smoke', x: t.x - Math.cos(t.a) * 10, y: t.y - Math.sin(t.a) * 10, vx: 0, vy: -3, life: 0.6, t: 0, r: 2, c: '150,130,95' });
    }
    this.drawSmokes(g, view, time);
    // bullets
    g.globalCompositeOperation = 'lighter';
    for (const b of view.bullets) {
      if (b.x < x0 - 30 || b.x > x1 + 30 || b.y < y0 - 30 || b.y > y1 + 30) continue;
      const wdef = WEAPONS[b.w] || WEAPONS.cannon, sp = Math.hypot(b.vx, b.vy) || 1, nx = b.vx / sp, ny = b.vy / sp;
      if (b.zap) { drawZapBullet(g, b, this); continue; }
      if (b.w === 'flame') { const k = Math.random(); g.fillStyle = k < 0.5 ? 'rgba(255,170,40,0.75)' : 'rgba(255,80,20,0.6)'; g.beginPath(); g.arc(b.x, b.y, 3 + k * 3.5, 0, TAU); g.fill(); continue; }
      if (b.w === 'mortar') { const ph = Math.sin(((b.id || 0) * 0.37 + performance.now() / 260) % Math.PI); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(b.x, b.y + 4, 2.6, 0, TAU); g.fill(); g.fillStyle = '#d8d8d8'; g.beginPath(); g.arc(b.x, b.y - 4 - ph * 9, 2.6 + ph * 1.4, 0, TAU); g.fill(); continue; }
      const len = b.w === 'rail' ? 26 : b.w === 'laser' ? 34 : b.w === 'shotgun' ? 4 : b.w === 'emp' ? 5 : b.w === 'mg' ? 6 : b.w === 'rocket' || b.w === 'salvo' ? 8 : b.w === 'heavy' ? 11 : 9;
      const gr = g.createLinearGradient(b.x, b.y, b.x - nx * len, b.y - ny * len); gr.addColorStop(0, hexA(wdef.color, 1)); gr.addColorStop(1, hexA(wdef.color, 0));
      g.strokeStyle = gr; g.lineWidth = b.w === 'rail' ? 2.4 : b.w === 'mg' ? 1.2 : 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - nx * len, b.y - ny * len); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, b.w === 'mg' || b.w === 'shotgun' ? 0.9 : 1.5, 0, TAU); g.fill();
      if (b.w === 'emp') { g.strokeStyle = 'rgba(93,240,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.arc(b.x, b.y, 3.5 + Math.random() * 2, 0, TAU); g.stroke(); }
      if (this.ultra && /rocket|salvo|homing|heavy|hrocket/.test(b.w)) { this.addParticle({ k: 'smoke', x: b.x - nx * 5, y: b.y - ny * 5, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 - 3, life: 2.2, t: 0, r: 2.6, c: '190,190,185' }); this.addParticle({ k: 'fire', x: b.x - nx * 4, y: b.y - ny * 4, vx: -nx * 30, vy: -ny * 30, life: 0.16, t: 0, r: 2.6 }); this.addParticle({ k: 'light', x: b.x, y: b.y, life: 0.06, t: 0, r: 26, c: '255,170,80' }); } // r25 Ultra: thick lingering smoke trail + exhaust glow
      else if (this.ultra && (b.w === 'cannon' || b.w === 'heavy' || b.w === 'shotgun') && Math.random() < 0.7) this.addParticle({ k: 'spark', x: b.x, y: b.y, vx: nx * 420, vy: ny * 420, life: 0.06, t: 0, c: 'rgba(255,236,170,1)' }); // r25 Ultra: shell tracer
      if ((b.w === 'rocket' || b.w === 'salvo' || b.w === 'heavy' || b.w === 'homing') && Math.random() < 0.6) this.addParticle({ k: 'smoke', x: b.x - nx * 4, y: b.y - ny * 4, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 0.5, t: 0, r: 1.8 });
    }
    g.globalCompositeOperation = 'source-over';
    // bushes on top (own tank visible through them)
    this.drawLayer(true, x0, y0, x1, y1);
    if (me && me.alive && me.inBush) { g.save(); g.globalAlpha = 0.55; this.drawTank(g, me, view.mode, true, time); g.restore(); }
    this.drawParticles(g, x0, y0, x1, y1);
    drawCrateTags(g, view, me, time, drawIcon);
    if (view.hill) this.drawHill(g, view.hill, time);
    if (view.flags) this.drawFlags(g, view, me, time);
    if (view.towers) this.drawTowers(g, view, me, time);
    if (view.special === 'race' && view.map.checkpoints) this.drawRace(g, view, me, time);
    // zone
    if (view.mode === 'br' && view.zone && !view.ffa) this.drawZone(g, view.zone, x0, y0, vw, vh, time);
    // nameplates & hp
    if (!this.mesh3d) { for (const t of vis) this.drawTeamRing(g, t, me, view); for (const t of vis) this.drawPlate(g, t, me, view); } // r19: 3D cameras draw screen-space plates instead
    // popups
    for (const p of this.popups) {
      const k = p.t / p.life, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, s = (p.big ? 1.45 : 1) * (k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, k));
      g.save(); g.translate(p.x, p.y - k * 16); g.scale(s / cam.z * 1.6, s / cam.z * 1.6); g.globalAlpha = a;
      g.font = (p.big ? '15px' : '11px') + ' "Russo One", system-ui, "Noto Sans Georgian", "Noto Sans Armenian", "Sylfaen", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(p.text, 0, 0); g.fillStyle = p.color; g.fillText(p.text, 0, 0); g.restore();
    }
    g.restore();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawAtmo(g, view, me, cam, vp, dpr, time, vis, view.bullets || []);
    // vignette & hurt
    const vg = g.createRadialGradient(vp.x + vp.w / 2, vp.y + vp.h / 2, Math.min(vp.w, vp.h) * 0.35, vp.x + vp.w / 2, vp.y + vp.h / 2, Math.max(vp.w, vp.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = vg; g.fillRect(vp.x, vp.y, vp.w, vp.h);
    const low = me && me.alive && me.hp < me.maxHp * 0.3 ? 0.25 + 0.15 * Math.sin(time * 6) : 0;
    const hurt = Math.max(this.hurtT * 2, low);
    if (hurt > 0) { const hg = g.createRadialGradient(vp.x + vp.w / 2, vp.y + vp.h / 2, Math.min(vp.w, vp.h) * 0.3, vp.x + vp.w / 2, vp.y + vp.h / 2, Math.max(vp.w, vp.h) * 0.7); hg.addColorStop(0, 'rgba(255,0,0,0)'); hg.addColorStop(1, 'rgba(200,0,0,' + Math.min(0.6, hurt) + ')'); g.fillStyle = hg; g.fillRect(vp.x, vp.y, vp.w, vp.h); }
    if (view.mode === 'br' && me && me.alive && view.zone && Math.hypot(me.x - view.zone.cx, me.y - view.zone.cy) > view.zone.r) { g.fillStyle = 'rgba(160,40,200,' + (0.12 + 0.06 * Math.sin(time * 5)) + ')'; g.fillRect(vp.x, vp.y, vp.w, vp.h); }
    if (this.flashT > 0) { g.fillStyle = 'rgba(255,255,255,' + this.flashT * 2 + ')'; g.fillRect(vp.x, vp.y, vp.w, vp.h); }
    return { me, cam: { x: cam.x, y: cam.y, z: cam.z, vw, vh } };
  }
  drawOutside(g, m, x0, y0, x1, y1) { // frame beyond the map edge: dark armour plating instead of an empty field
    g.save(); g.beginPath(); g.rect(x0 - 50, y0 - 50, x1 - x0 + 100, y1 - y0 + 100); g.rect(0, 0, m.pw, m.ph); g.clip('evenodd');
    g.fillStyle = '#23272d'; g.fillRect(x0 - 50, y0 - 50, x1 - x0 + 100, y1 - y0 + 100);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; const s = 32; g.beginPath();
    for (let x = Math.floor((x0 - 50) / s) * s; x < x1 + 50; x += s) { g.moveTo(x, y0 - 50); g.lineTo(x, y1 + 50); } for (let y = Math.floor((y0 - 50) / s) * s; y < y1 + 50; y += s) { g.moveTo(x0 - 50, y); g.lineTo(x1 + 50, y); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.07)'; for (let x = Math.floor((x0 - 50) / s) * s; x < x1 + 50; x += s) for (let y = Math.floor((y0 - 50) / s) * s; y < y1 + 50; y += s) { g.fillRect(x + 3, y + 3, 2, 2); g.fillRect(x + s - 5, y + s - 5, 2, 2); }
    g.restore(); g.save(); g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 18; g.strokeStyle = '#3a3f47'; g.lineWidth = 4; g.strokeRect(-2, -2, m.pw + 4, m.ph + 4); g.restore();
  }
  drawTeamBases(g, m, time) {
    for (let team = 0; team < 2; team++) {
      const x = team ? m.pw - 9 * CELL : 9 * CELL, y = m.ph / 2, c = team ? '255,90,90' : '90,150,255';
      const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, 'rgba(' + c + ',0.22)'); gr.addColorStop(1, 'rgba(' + c + ',0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 90, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(' + c + ',0.5)'; g.lineWidth = 1.2; g.setLineDash([4, 4]); g.lineDashOffset = time * 8; g.beginPath(); g.arc(x, y, 60, 0, TAU); g.stroke(); g.setLineDash([]);
    }
  }
  drawWaterAnim(g, m, x0, y0, x1, y1, time) { // r25: two travelling wave layers, sun glints (specular), breathing shoreline foam
    const c0 = Math.max(0, Math.floor(x0 / CELL)), c1 = Math.min(m.w - 1, Math.floor(x1 / CELL)), r0 = Math.max(0, Math.floor(y0 / CELL)), r1 = Math.min(m.h - 1, Math.floor(y1 / CELL));
    const W = (c, r) => m.t[r * m.w + c] === T_WATER;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (!W(c, r)) continue; const x = c * CELL, y = r * CELL;
      const p1 = Math.sin(time * 1.3 + c * 0.55 + r * 0.32), p2 = Math.sin(time * 0.9 - c * 0.31 + r * 0.61);
      g.fillStyle = 'rgba(160,215,245,' + (0.06 + 0.07 * (p1 + 1)) + ')'; g.fillRect(x, y + 2 + p1 * 1.2, CELL, 0.8);
      g.fillStyle = 'rgba(10,30,50,' + (0.05 + 0.05 * (p2 + 1)) + ')'; g.fillRect(x, y + 5.5 + p2, CELL, 0.9);
      const gl = Math.sin(time * 3.1 + c * 1.7 + r * 2.3); if (gl > 0.93) { g.fillStyle = 'rgba(255,255,240,' + ((gl - 0.93) * 12) + ')'; g.fillRect(x + 3 + p1 * 1.5, y + 3, 1.6, 0.6); g.fillRect(x + 3.5 + p1 * 1.5, y + 2.5, 0.6, 1.6); }
      const sh = (c > 0 && !W(c - 1, r)) || (c < m.w - 1 && !W(c + 1, r)) || (r > 0 && !W(c, r - 1)) || (r < m.h - 1 && !W(c, r + 1));
      if (sh) { const fo = 0.25 + 0.25 * Math.sin(time * 2 + c + r * 1.3); g.fillStyle = 'rgba(240,250,255,' + fo + ')';
        if (r > 0 && !W(c, r - 1)) g.fillRect(x, y + 1.5 + fo * 2, CELL, 0.6); if (r < m.h - 1 && !W(c, r + 1)) g.fillRect(x, y + CELL - 2 - fo * 2, CELL, 0.6);
        if (c > 0 && !W(c - 1, r)) g.fillRect(x + 1.5 + fo * 2, y, 0.6, CELL); if (c < m.w - 1 && !W(c + 1, r)) g.fillRect(x + CELL - 2 - fo * 2, y, 0.6, CELL); }
    }
  }
  splash(x, y, s = 1) { const n = Math.round((10 + 14 * s) * this.quality); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 70 * (0.5 + s); this.addParticle({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4, t: 0, rot: 0, vr: 0, c: Math.random() < 0.5 ? '#dff3ff' : '#9fd3ef', sz: 1.1 }); }
    for (let i = 0; i < 3; i++) this.addParticle({ k: 'smoke', x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: 0, vy: -4, life: 0.6, t: 0, r: 3 + s * 2, c: '215,238,255' });
    this.addParticle({ k: 'ring', x, y, life: 0.55, t: 0, r: 10 + 8 * s }); }
  tracer(x, y, tx, ty, c) { const dx = tx - x, dy = ty - y, L = Math.hypot(dx, dy) || 1; for (let i = 1; i <= 3; i++) { const k = i / 4; this.addParticle({ k: 'spark', x: x + dx * k, y: y + dy * k, vx: dx / L * 260, vy: dy / L * 260, life: 0.08, t: 0, r: 1.1, c }); } this.addParticle({ k: 'spark', x: tx, y: ty, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.18, t: 0, r: 1.4 }); }
  wake(x, y, a) { for (const sd of [-1, 1]) { const b = a + Math.PI + sd * 0.5; this.addParticle({ k: 'smoke', x: x - Math.cos(a) * 7, y: y - Math.sin(a) * 7, vx: Math.cos(b) * 14, vy: Math.sin(b) * 14, life: 0.9, t: 0, r: 2, c: '225,242,255' }); }
    this.addParticle({ k: 'debris', x: x + Math.cos(a) * 7, y: y + Math.sin(a) * 7, vx: Math.cos(a) * 30 + (Math.random() - 0.5) * 30, vy: Math.sin(a) * 30 + (Math.random() - 0.5) * 30, life: 0.3, t: 0, rot: 0, vr: 0, c: '#e6f6ff', sz: 1 }); }
  // r25: cannon blast — muzzle smoke cloud + dust kicked up around the hull
  blast(x, y, a, tx, ty, big) { const q = this.quality; for (let i = 0; i < (big ? 7 : 3) * q; i++) { const aa = a + (Math.random() - 0.5) * 0.9, v = 25 + Math.random() * 45; this.addParticle({ k: 'smoke', x, y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0.8 + Math.random() * 0.6, t: 0, r: 2.5 + Math.random() * 2.5, c: '170,165,155' }); }
    if (big) for (let i = 0; i < 8 * q; i++) { const aa = Math.random() * TAU; this.addParticle({ k: 'smoke', x: tx + Math.cos(aa) * 8, y: ty + Math.sin(aa) * 8, vx: Math.cos(aa) * 28, vy: Math.sin(aa) * 28, life: 0.9, t: 0, r: 3, c: '140,120,90' }); } }
  drawTowers(g, view, me, time) { // r15 «Оборона баз»: towers + HQ with HP bars; grey shield = not yet damageable
    const myT = me ? me.team : 0;
    for (const T of view.towers) { const col = T.team === myT ? '#5cc2ff' : '#ff6b6b', R = T.hq ? 15 : 10; g.save(); g.translate(T.x, T.y);
      if (!T.alive) { g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); g.fillStyle = '#555'; g.fillRect(-R * 0.6, -2, R * 1.2, 4); g.restore(); continue; }
      g.fillStyle = '#2b2f36'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; g.lineTo(Math.cos(a) * R, Math.sin(a) * R); } g.closePath(); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, R * 0.62, 0, 7); g.fill(); g.fillStyle = '#1b1e23'; g.beginPath(); g.arc(0, 0, R * 0.32, 0, 7); g.fill();
      if (T.hq) { g.strokeStyle = col; g.lineWidth = 1.5; g.globalAlpha = 0.25 + 0.15 * Math.sin(time * 3); g.beginPath(); g.arc(0, 0, 130, 0, 7); g.stroke(); g.globalAlpha = 1; }
      if (!T.vul) { g.strokeStyle = 'rgba(200,210,230,0.7)'; g.lineWidth = 1.4; g.setLineDash([3, 3]); g.beginPath(); g.arc(0, 0, R + 3, 0, 7); g.stroke(); g.setLineDash([]); }
      const bw = R * 2.4, f = T.hp / T.maxHp; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(-bw / 2, -R - 9, bw, 4); g.fillStyle = f > 0.5 ? '#58d36b' : f > 0.25 ? '#f2c14e' : '#ef5350'; g.fillRect(-bw / 2, -R - 9, bw * f, 4);
      g.restore(); } }
  drawFlags(g, view, me, time) {
    for (const F of view.flags) { const col = F.team === 0 ? '#5cc2ff' : '#ff6b6b';
      if (F.hx) { g.save(); g.strokeStyle = col; g.globalAlpha = 0.5; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(F.hx, F.hy, 26, 0, Math.PI * 2); g.stroke(); g.restore(); }
      const x = F.x + (F.carrier ? 6 : 0), y = F.y - (F.carrier ? 8 : 0), wv = Math.sin(time * 6 + F.team) * 2;
      g.save(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + 1, y + 2, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#eee'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y - 20); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 20); g.quadraticCurveTo(x + 7, y - 19 + wv, x + 14, y - 16 + wv); g.lineTo(x, y - 11); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
      if (!F.home && !F.carrier) { g.font = 'bold 9px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(Math.ceil(F.dropT || 0) > 0 ? '' : '', x, y + 12); }
      g.restore(); }
  }
  drawRace(g, view, me, time) {
    const cps = view.map.checkpoints, R = view.map.cpR, nx = me ? me.cp ?? 1 : 1;
    // start/finish line: checkered band across the left straight
    const s0 = cps[0]; g.save(); for (let i = -10; i < 10; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) & 1 ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.75)'; g.fillRect(s0[0] + i * 8, s0[1] - 8 + j * 8, 8, 8); } g.restore();
    cps.forEach((c, i) => { if (i === 0) return; const next = i === nx; g.save(); g.globalAlpha = next ? 0.85 : 0.25; g.strokeStyle = next ? '#ffd23d' : '#fff'; g.lineWidth = next ? 3 : 1.5; g.setLineDash(next ? [10, 6] : [4, 6]); g.lineDashOffset = -time * 20;
      g.beginPath(); g.arc(c[0], c[1], R * 0.55, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = next ? '#ffd23d' : '#fff'; g.fillText(String(i), c[0], c[1]); g.restore(); });
    if (me && me.alive && !me.finishT) { const c = cps[nx] || cps[0], a = Math.atan2(c[1] - me.y, c[0] - me.x), d = Math.hypot(c[0] - me.x, c[1] - me.y); if (d > 60) { const ax = me.x + Math.cos(a) * 34, ay = me.y + Math.sin(a) * 34;
      g.save(); g.translate(ax, ay); g.rotate(a); g.fillStyle = 'rgba(255,210,61,0.9)'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-5, -6); g.lineTo(-2, 0); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore(); } }
  }
  drawHill(g, H, time) {
    const col = H.owner === 0 ? '92,194,255' : H.owner === 1 ? '255,107,107' : H.contested ? '255,210,61' : '255,255,255';
    g.fillStyle = 'rgba(' + col + ',0.14)'; g.beginPath(); g.arc(H.x, H.y, H.r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(' + col + ',0.8)'; g.lineWidth = 2; g.setLineDash([8, 6]); g.lineDashOffset = -time * 14; g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(' + col + ',0.9)'; g.beginPath(); g.moveTo(H.x - 1, H.y - 14); g.lineTo(H.x + 11, H.y - 9); g.lineTo(H.x - 1, H.y - 4); g.fill(); g.fillRect(H.x - 2, H.y - 14, 2, 18);
  }
  drawZone(g, z, x0, y0, vw, vh, time) {
    g.save(); g.fillStyle = 'rgba(120,30,170,0.28)'; g.beginPath(); g.rect(x0 - 40, y0 - 40, vw + 80, vh + 80); g.arc(z.cx, z.cy, Math.max(0.1, z.r), 0, TAU, true); g.fill('evenodd');
    g.strokeStyle = 'rgba(220,120,255,0.95)'; g.lineWidth = 2.2; g.beginPath(); g.arc(z.cx, z.cy, Math.max(0.1, z.r), 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,200,255,0.35)'; g.lineWidth = 6; g.setLineDash([10, 14]); g.lineDashOffset = -time * 20; g.stroke(); g.setLineDash([]);
    if (z.state !== 'final' && z.tr > 0) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.setLineDash([6, 6]); g.beginPath(); g.arc(z.tcx, z.tcy, z.tr, 0, TAU); g.stroke(); g.setLineDash([]); }
    g.restore();
  }
  drawParticles(g, x0, y0, x1, y1) {
    for (const p of this.particles) { if (p.t < 0) continue;
      if (p.x < x0 - 40 || p.x > x1 + 40 || p.y < y0 - 40 || p.y > y1 + 40) continue; const k = p.t / p.life;
      switch (p.k) {
        case 'chunk': this.drawChunk(g, p, k); break;
        case 'ring': g.strokeStyle = 'rgba(' + (p.c || '200,230,200') + ',' + (0.6 * (1 - k)) + ')'; g.lineWidth = p.w || 0.8; g.beginPath(); g.arc(p.x, p.y, (p.r || 4) + k * (p.g || 10), 0, TAU); g.stroke(); break;
        case 'light': { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); gr.addColorStop(0, 'rgba(' + p.c + ',' + (0.55 * (1 - k) ** 2) + ')'); gr.addColorStop(1, 'rgba(' + p.c + ',0)'); g.fillStyle = gr; g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); g.globalCompositeOperation = 'source-over'; break; }
        case 'fball': { const r = p.r * (0.55 + 0.9 * Math.sqrt(k)), gr = g.createRadialGradient(p.x, p.y - k * 4, 0, p.x, p.y - k * 4, r); if (p.c) { gr.addColorStop(0, 'rgba(230,250,255,' + (1 - k) + ')'); gr.addColorStop(0.5, 'rgba(90,190,255,' + (0.7 * (1 - k)) + ')'); } else { gr.addColorStop(0, k < 0.25 ? 'rgba(255,250,225,1)' : 'rgba(255,190,90,' + (1 - k) + ')'); gr.addColorStop(0.45, 'rgba(255,120,30,' + (0.9 * (1 - k)) + ')'); gr.addColorStop(0.8, 'rgba(120,40,15,' + (0.7 * (1 - k)) + ')'); } gr.addColorStop(1, 'rgba(40,30,25,0)'); g.globalCompositeOperation = k < 0.5 ? 'lighter' : 'source-over'; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y - k * 4, r, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; break; }
        case 'dust': { const r = p.r * (0.3 + 0.9 * Math.sqrt(k)), gr = g.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r); gr.addColorStop(0, 'rgba(120,105,80,0)'); gr.addColorStop(0.7, 'rgba(120,105,80,' + (0.35 * (1 - k)) + ')'); gr.addColorStop(1, 'rgba(120,105,80,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill(); break; }
        case 'dirt': { const zz = p.z || 0; g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz * 0.6); g.globalAlpha = 1 - k * k; g.fillStyle = p.c; g.fillRect(p.x - p.sz / 2, p.y - zz * 0.35 - p.sz / 2, p.sz, p.sz); g.globalAlpha = 1; break; }
        case 'smoke': g.fillStyle = 'rgba(' + (p.c || '60,60,60') + ',' + (0.45 * (1 - k)) + ')'; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, TAU); g.fill(); break;
        case 'fire': { g.globalCompositeOperation = 'lighter'; const r = p.r * (1 - k * 0.6); g.fillStyle = k < 0.3 ? 'rgba(255,240,180,' + (1 - k) + ')' : k < 0.6 ? 'rgba(255,150,40,' + (1 - k) + ')' : 'rgba(200,50,20,' + (1 - k) + ')'; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; break; }
        case 'spark': g.globalCompositeOperation = 'lighter'; g.strokeStyle = p.c || 'rgba(255,220,120,1)'; g.globalAlpha = 1 - k; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; break;
        case 'debris': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = 1 - k * k; g.fillStyle = p.c; const s = p.sz || 2; g.fillRect(-s / 2, -s / 2, s, s * 0.7); g.restore(); break;
        case 'shock': g.strokeStyle = 'rgba(' + (p.c || '255,220,160') + ',' + (0.7 * (1 - k)) + ')'; g.lineWidth = 2 * (1 - k) + 0.5; g.beginPath(); g.arc(p.x, p.y, p.r * (0.2 + k), 0, TAU); g.stroke(); break;
        case 'flash': { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); gr.addColorStop(0, 'rgba(255,240,200,' + (0.9 * (1 - k)) + ')'); gr.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; break; }
        case 'muzzle': { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,230,140,' + (1 - k) + ')'; g.beginPath(); g.moveTo(0, -2.5); g.lineTo(p.w === 'rail' ? 14 : 8, 0); g.lineTo(0, 2.5); g.closePath(); g.fill(); g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.restore(); break; }
      }
    }
  }
  teamCol(view, t) { return view.mode === 'classic' ? null : (view.mode === 'team' && view.special !== 'race') ? (t.team ? '#ff4d4d' : '#4d8dff') : teamColor(t.team); }
  drawTeamRing(g, t, me, view) {
    const c = this.teamCol(view, t); if (!c || !t.alive) return;
    const own = me && t.team === me.team;
    g.save(); g.strokeStyle = c; g.globalAlpha = own ? 0.5 : 0.6; g.lineWidth = 0.9; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const a0 = k * TAU / 4 + 0.35; g.beginPath(); g.arc(t.x, t.y, 13.5, a0, a0 + 0.85); g.stroke(); }
    g.restore();
  }
  drawPlate(g, t, me, view) {
    if (t.cloaked && me && t.id !== me.id && (t.team !== me.team || view.mode === 'ffa')) return; // r26: no name/HP for a cloaked enemy
    const isMe = me && t.id === me.id; const ally = me && t.team === me.team && !isMe;
    const w = 26, y = t.y - 26, k = Math.max(0, Math.min(1, t.hp / t.maxHp));
    if (view.mode === 'classic' && t.team === 1 && t.maxHp <= 40) return;
    if (view.mode !== 'classic' && t.prk != null) { /* r26: rank insignia above every tank — chevrons (soldiers), bars (officers), stars (generals / marshal) */ const r = t.prk | 0, cx = t.x - w / 2 - 7, cy = y - 1; g.save(); g.fillStyle = r >= 14 ? '#ffd23d' : r >= 7 ? '#e8e8f0' : '#d9a44a'; g.strokeStyle = '#000a'; g.lineWidth = 0.8;
      g.beginPath(); g.rect(cx - 4, cy - 4, 8, 8); g.fillStyle = '#1b2330'; g.fill(); g.fillStyle = r >= 14 ? '#ffd23d' : r >= 7 ? '#e8e8f0' : '#d9a44a';
      if (r >= 14) { const n = Math.min(4, r - 13); for (let i = 0; i < n; i++) g.fillRect(cx - 3 + i * 1.8, cy - 1, 1.3, 1.3); } else if (r >= 7) { const n = 1 + (r - 7) % 4; for (let i = 0; i < n; i++) g.fillRect(cx - 3 + i * 1.7, cy - 3, 1, 6); } else { const n = Math.min(3, 1 + (r % 4)); for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(cx - 3, cy - 2 + i * 2); g.lineTo(cx, cy + i * 2); g.lineTo(cx + 3, cy - 2 + i * 2); g.stroke(); g.strokeStyle = g.fillStyle; g.stroke(); } }
      g.restore(); }
    // r15: clearer HP bar — dark frame in team colour, fill green→yellow→red, a tick every 100 HP, armour strip on top
    const tc = this.teamCol(view, t);
    if (this.screenPlates) { if (t.slowT > 0) { g.strokeStyle = 'rgba(93,240,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.arc(t.x, t.y, 13, 0, TAU); g.stroke(); } return; } // r22: name/HP drawn in screen space by main.js
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(t.x - w / 2 - 0.8, y - 0.8, w + 1.6, 4.6);
    if (tc) { g.strokeStyle = tc; g.lineWidth = 0.6; g.strokeRect(t.x - w / 2 - 0.8, y - 0.8, w + 1.6, 4.6); }
    g.fillStyle = k > 0.6 ? '#5dff8a' : k > 0.3 ? '#ffd23d' : '#ff4d4d'; g.fillRect(t.x - w / 2, y, w * k, 3);
    if (t.maxHp > 120) { g.fillStyle = 'rgba(0,0,0,0.55)'; for (let h = 100; h < t.maxHp; h += 100) g.fillRect(t.x - w / 2 + w * h / t.maxHp - 0.25, y, 0.5, 3); }
    if (t.armorT > 0 && t.armorHp > 0) { g.fillStyle = (TIERS[t.armorT - 1] || TIERS[0]).color; g.fillRect(t.x - w / 2, y - 2.2, w * Math.min(1, t.armorHp / armorMax(t.armorT)), 1.2); }
    if (t.shield > 0) { g.fillStyle = '#7fd8ff'; g.fillRect(t.x - w / 2, y - 3.6, w * Math.min(1, t.shield / 140), 1.1); }
    if (t.slowT > 0) { g.strokeStyle = 'rgba(93,240,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.arc(t.x, t.y, 13, 0, TAU); g.stroke(); }
    if (t.regenT > 0) { g.fillStyle = '#7dff8a'; g.fillRect(t.x + w / 2 + 1.5, y - 0.5, 1, 4); g.fillRect(t.x + w / 2, y + 1, 4, 1); }
    if (view.mode !== 'classic' && !isMe) {
      g.save(); g.translate(t.x, y - 2.5); g.scale(1 / this.cam.z, 1 / this.cam.z); g.font = '10px "Russo One", system-ui, "Noto Sans Georgian", "Noto Sans Armenian", "Sylfaen", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif'; g.textAlign = 'center';
      const lbl = (view.mode === 'br' && view.squad > 1 ? teamTag(t.team) + ' ' : '') + t.name + (ally ? ' ◆' : ''); g.lineWidth = 2.6; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.strokeText(lbl, 0, 0); g.fillStyle = liteCol2(this.teamCol(view, t)) || '#fff'; g.fillText(lbl, 0, 0); g.restore();
    }
  }
}

export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
const q2 = (ui) => !!(ui.p2 && ui.p2.alive);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function drawIcon(g, type, wid, lid) {
  if (type === 'lx') { const L = LOOTX[lid]; if (!L) return; switch (L.cat) {
      case 'shell': g.fillRect(-1.6, -2, 3.2, 6); g.beginPath(); g.arc(0, -2, 1.6, Math.PI, 0); g.fill(); g.font = '700 3.4px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(L.g, 0, -4.6 + 9.6); break;
      case 'rocket': g.fillRect(-1.4, -4, 2.8, 6.5); g.beginPath(); g.moveTo(-1.4, -4); g.lineTo(0, -6); g.lineTo(1.4, -4); g.fill(); g.fillRect(-3, 1.5, 6, 1.3); g.fillStyle = '#fff'; g.fillRect(-0.5, -2.5, 1, 1 + (L.i % 4)); break;
      case 'mine': g.beginPath(); g.arc(0, 0, 3.2, 0, TAU); g.fill(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + L.i * 0.3; g.fillRect(Math.cos(a) * 4 - 0.6, Math.sin(a) * 4 - 0.6, 1.2, 1.2); } break;
      case 'wvar': g.fillRect(-5, -1, 10, 2); g.fillRect(-5, -2.6, 4, 5.2); g.fillRect(3 + (L.i % 4) * 0.5, -1.7, 2, 3.4); break;
      case 'spare': g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, r = k % 2 ? 3 : 4.4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); g.fillStyle = '#14171c'; g.beginPath(); g.arc(0, 0, 1.3, 0, TAU); g.fill(); break;
      case 'perk': g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, r = k % 2 ? 2 : 4.6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); break;
      case 'fmod': g.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, r = k % 2 ? 3.6 : 4.8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); g.fillStyle = '#14171c'; g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill(); g.font = '800 2.6px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = L.col; g.fillText(L.g, 0, 0.2); break; // r37 field mod: cog + «+N%»
      default: g.fillRect(-3.5, -3.5, 7, 7); g.fillStyle = '#14171c'; g.fillRect(-1.8, -1.8, 3.6, 3.6); for (let k = -3; k <= 3; k += 2) { g.fillStyle = L.col; g.fillRect(k - 0.4, -5, 0.8, 1.5); g.fillRect(k - 0.4, 3.5, 0.8, 1.5); } } return; }
  switch (type) {
    case 'med': g.fillRect(-1.3, -4, 2.6, 8); g.fillRect(-4, -1.3, 8, 2.6); break;
    case 'beacon': g.beginPath(); g.moveTo(0, -5); g.lineTo(3, 4); g.lineTo(-3, 4); g.closePath(); g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 0.8; g.beginPath(); g.arc(0, -5, 2.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(0, -5, 4.2, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); break;
    case 'hrocket': g.fillRect(-1.6, -4, 3.2, 7); g.beginPath(); g.moveTo(-1.6, -4); g.lineTo(0, -6); g.lineTo(1.6, -4); g.fill(); g.fillRect(-3, 1.5, 6, 1.5); break;
    case 'radar': g.beginPath(); g.arc(0, 1, 4, Math.PI, 0); g.fill(); g.fillRect(-0.6, -4, 1.2, 4); g.beginPath(); g.arc(0, -4, 1.4, 0, TAU); g.fill(); break;
    case 'part_tur': g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill(); g.fillRect(2, -0.8, 4, 1.6); break;
    case 'part_gun': g.fillRect(-5, -1, 10, 2); g.fillRect(4, -1.8, 2, 3.6); break;
    case 'part_trk': for (let k = -4; k <= 4; k += 2) g.fillRect(k - 0.6, -3, 1.2, 6); g.fillRect(-5, -3, 10, 1); g.fillRect(-5, 2, 10, 1); break;
    case 'part_eng': g.fillRect(-4, -3, 8, 6); g.fillStyle = '#14171c'; for (let k = -3; k < 4; k += 2) g.fillRect(k, -2, 1, 4); break;
    case 'part_pl': g.beginPath(); g.moveTo(-4, -4); g.lineTo(4, -3); g.lineTo(3, 4); g.lineTo(-4, 3); g.closePath(); g.fill(); break;
    case 'med_s': g.fillRect(-0.9, -2.8, 1.8, 5.6); g.fillRect(-2.8, -0.9, 5.6, 1.8); break;
    case 'med_l': g.fillRect(-1.8, -5, 3.6, 10); g.fillRect(-5, -1.8, 10, 3.6); g.fillStyle = '#14171c'; g.fillRect(-0.6, -0.6, 1.2, 1.2); break;
    case 'repair': g.fillRect(-4, -1, 8, 2); g.beginPath(); g.arc(-3.6, 0, 2.2, 0, TAU); g.arc(3.6, 0, 2.2, 0, TAU); g.fill(); g.fillStyle = '#14171c'; g.fillRect(-4.6, -0.5, 1.6, 1); g.fillRect(3, -0.5, 1.6, 1); break;
    case 'med_team': g.fillRect(-1, -3, 2, 6); g.fillRect(-3, -1, 6, 2); g.beginPath(); g.arc(-4, 3.6, 1.4, 0, TAU); g.arc(4, 3.6, 1.4, 0, TAU); g.arc(0, -4.6, 1.4, 0, TAU); g.fill(); break;
    case 'shield': g.beginPath(); g.moveTo(0, -4.5); g.lineTo(4, -2.5); g.lineTo(3.2, 2); g.lineTo(0, 4.5); g.lineTo(-3.2, 2); g.lineTo(-4, -2.5); g.closePath(); g.fill(); break;
    case 'speed': g.beginPath(); g.moveTo(1, -4.5); g.lineTo(-3, 0.5); g.lineTo(0, 0.5); g.lineTo(-1, 4.5); g.lineTo(3, -0.5); g.lineTo(0, -0.5); g.closePath(); g.fill(); break;
    case 'power': g.beginPath(); g.arc(0, 0, 3.2, 0, TAU); g.fill(); g.fillStyle = '#14171c'; g.beginPath(); g.arc(0, 0, 1.5, 0, TAU); g.fill(); break;
    case 'weapon': g.fillRect(-4, -1, 6, 2); g.fillRect(-1, -2.5, 3.5, 5); g.fillRect(2.5, -0.6, 2, 1.2); break;
    case 'star': star(g, 0, 0, 4.5, 2); g.fill(); break;
    case 'helmet': g.beginPath(); g.arc(0, 1, 4, Math.PI, 0); g.fill(); g.fillRect(-4.5, 1, 9, 1.4); break;
    case 'grenade': g.beginPath(); g.arc(0, 1, 3.4, 0, TAU); g.fill(); g.fillRect(-1, -4.2, 2, 2); break;
    case 'life': g.fillRect(-4, -1, 8, 4); g.fillRect(-2, -3, 4, 2); g.fillRect(0, -2.4, 4, 1); break;
    case 'shovel': g.fillRect(-0.6, -4.5, 1.2, 5); g.beginPath(); g.moveTo(-2.5, 0.5); g.lineTo(2.5, 0.5); g.lineTo(0, 4.5); g.closePath(); g.fill(); break;
    case 'armor': g.beginPath(); g.moveTo(-4.5, -3.5); g.lineTo(0, -5); g.lineTo(4.5, -3.5); g.lineTo(4, 1.5); g.lineTo(0, 5); g.lineTo(-4, 1.5); g.closePath(); g.fill(); g.fillStyle = '#14171c'; g.fillRect(-0.8, -3, 1.6, 6); break;
    case 'ammo': for (const ox of [-3, 0, 3]) { g.fillRect(ox - 1, -2, 2, 6); g.beginPath(); g.arc(ox, -2, 1, Math.PI, 0); g.fill(); } break;
    case 'smoke': g.beginPath(); g.arc(-1.8, 0.8, 2.6, 0, TAU); g.arc(1.8, 0.2, 2.8, 0, TAU); g.arc(0, -2.2, 2.4, 0, TAU); g.fill(); break;
    case 'mine': g.beginPath(); g.arc(0, 0.8, 3.6, 0, TAU); g.fill(); g.fillRect(-0.7, -4.5, 1.4, 2.4); g.fillRect(-4.6, 0.1, 1.6, 1.4); g.fillRect(3, 0.1, 1.6, 1.4); break;
    case 'wreck': case 'upg': case 'mupg':
    case 'loot': g.fillRect(-4, -2, 8, 6); g.fillRect(-4.6, -3.4, 9.2, 1.8); g.fillStyle = '#14171c'; g.fillRect(-0.8, -3.4, 1.6, 7.4); break;
    case 'mod_scope': g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.stroke(); g.fillRect(-0.5, -4.6, 1, 9.2); g.fillRect(-4.6, -0.5, 9.2, 1); break;
    case 'mod_barrel': g.fillRect(-4.5, -1.6, 9, 3.2); g.fillRect(2.5, -2.6, 2, 5.2); break;
    case 'mod_loader': g.beginPath(); g.arc(0, 0, 3.8, 0.4, TAU - 0.4); g.stroke(); g.beginPath(); g.moveTo(4.6, -2.4); g.lineTo(4.6, 1); g.lineTo(1.6, -0.6); g.closePath(); g.fill(); break;
    case 'mod_mag': g.fillRect(-2.6, -4.5, 5.2, 9); g.fillStyle = '#14171c'; for (const yy of [-2.5, 0, 2.5]) g.fillRect(-1.6, yy - 0.4, 3.2, 0.8); break;
    case 'clock': g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.stroke(); g.fillRect(-0.5, -3, 1, 3); g.fillRect(-0.5, -0.5, 2.5, 1); break;
  }
}
function star(g, x, y, R, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }

installFx(Renderer);
installFlags(Renderer);
function liteCol2(c) { const m = /^#([0-9a-f]{6})$/i.exec(c || ''); if (!m) return c; const n = parseInt(m[1], 16), f = (v) => Math.round(v + (255 - v) * 0.45); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
