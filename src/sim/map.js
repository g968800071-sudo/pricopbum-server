import { T_MUD, T_SWAMP, CELL, T_EMPTY, T_BRICK, T_STEEL, T_WATER, T_BUSH, T_ICE, T_CRATE, T_BASE } from './defs.js';
import { makeRng } from './rng.js';

export class TileMap {
  constructor(w, h) {
    this.w = w; this.h = h; this.t = new Uint8Array(w * h); this.hp = new Float32Array(w * h);
    this.pw = w * CELL; this.ph = h * CELL; this.changes = []; this.version = 0;
  }
  get(c, r) { return (c < 0 || r < 0 || c >= this.w || r >= this.h) ? T_STEEL : this.t[r * this.w + c]; }
  set(c, r, v, silent) {
    if (c < 0 || r < 0 || c >= this.w || r >= this.h) return;
    const i = r * this.w + c; if (this.t[i] === v) return;
    this.t[i] = v; this.hp[i] = v === T_BRICK ? 1 : v === T_CRATE ? 1 : 0;
    if (!silent) { this.changes.push(i); this.version++; }
  }
  rect(c0, r0, cw, ch, v) { for (let r = r0; r < r0 + ch; r++) for (let c = c0; c < c0 + cw; c++) this.set(c, r, v, true); }
  solidForTank(v) { return v === 11 || v === T_BRICK || v === T_STEEL || v === T_CRATE || v === T_BASE; }
  solidForBullet(v) { return v === 11 || v === T_BRICK || v === T_STEEL || v === T_CRATE || v === T_BASE; }
  tankBlockedAt(x, y, r) {
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r - 0.001) / CELL);
    const r0 = Math.floor((y - r) / CELL), r1 = Math.floor((y + r - 0.001) / CELL);
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      if (!this.solidForTank(this.get(cc, rr))) continue;
      // circle vs cell AABB
      const nx = Math.max(cc * CELL, Math.min(x, cc * CELL + CELL)), ny = Math.max(rr * CELL, Math.min(y, rr * CELL + CELL));
      const dx = x - nx, dy = y - ny; if (dx * dx + dy * dy < r * r * 0.92) return true;
    }
    return false;
  }
  // line of sight: bricks/steel/crates block; returns true if clear
  los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 5);
    for (let i = 1; i < n; i++) {
      const x = x0 + dx * i / n, y = y0 + dy * i / n; const v = this.get(Math.floor(x / CELL), Math.floor(y / CELL));
      if (v === T_STEEL || v === T_BRICK || v === T_CRATE) return false;
    }
    return true;
  }
  serialize() { return { w: this.w, h: this.h, t: Array.from(this.t) }; }
  static from(o) { const m = new TileMap(o.w, o.h); m.t.set(o.t); for (let i = 0; i < m.t.length; i++) m.hp[i] = (m.t[i] === T_BRICK || m.t[i] === T_CRATE) ? 1 : 0; return m; }
  encodeRLE() { const out = []; let p = this.t[0], n = 0; for (let i = 0; i < this.t.length; i++) { if (this.t[i] === p && n < 65535) n++; else { out.push(p, n); p = this.t[i]; n = 1; } } out.push(p, n); return { w: this.w, h: this.h, rle: out }; }
  static decodeRLE(o) { const m = new TileMap(o.w, o.h); let k = 0; for (let i = 0; i < o.rle.length; i += 2) { m.t.fill(o.rle[i], k, k + o.rle[i + 1]); k += o.rle[i + 1]; } for (let i = 0; i < m.t.length; i++) m.hp[i] = (m.t[i] === T_BRICK || m.t[i] === T_CRATE) ? 1 : 0; return m; }
}

function blob(m, rng, cx, cy, rad, v, noise = 0.35, onlyEmpty = true) {
  for (let r = Math.floor(cy - rad - 2); r <= cy + rad + 2; r++) for (let c = Math.floor(cx - rad - 2); c <= cx + rad + 2; c++) {
    const a = Math.atan2(r - cy, c - cx), d = Math.hypot(c - cx, r - cy);
    const rr = rad * (1 + noise * (Math.sin(a * 3 + cx) * 0.5 + Math.sin(a * 5 + cy) * 0.3));
    if (d < rr && (!onlyEmpty || m.get(c, r) === T_EMPTY)) m.set(c, r, v, true);
  }
}
function building(m, rng, c0, r0, w, h) {
  // brick walls (2 cells thick) with door gaps, steel corners, maybe crate inside
  for (let c = c0; c < c0 + w; c++) for (let r = r0; r < r0 + h; r++) {
    const edge = c < c0 + 2 || c >= c0 + w - 2 || r < r0 + 2 || r >= r0 + h - 2;
    if (!edge) { m.set(c, r, T_EMPTY, true); continue; }
    const corner = (c < c0 + 2 || c >= c0 + w - 2) && (r < r0 + 2 || r >= r0 + h - 2);
    m.set(c, r, corner ? T_STEEL : T_BRICK, true);
  }
  // doors
  const doors = rng.int(2, 3), sides = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, doors);
  for (const s of sides) {
    const dw = 6;
    if (s < 2) { const c = c0 + Math.floor((w - dw) / 2); const r = s === 0 ? r0 : r0 + h - 2; m.rect(c, r, dw, 2, T_EMPTY); }
    else { const r = r0 + Math.floor((h - dw) / 2); const c = s === 2 ? c0 : c0 + w - 2; m.rect(c, r, 2, dw, T_EMPTY); }
  }
  if (rng() < 0.85) m.rect(c0 + Math.floor(w / 2) - 1, r0 + Math.floor(h / 2) - 1, 2, 2, T_CRATE);
}

export function genBR(seed, size = 340) {
  const rng = makeRng(seed), m = new TileMap(size, size), K = (size / 280) ** 2;
  // lakes
  for (let i = 0; i < 9 * K; i++) blob(m, rng, rng.int(20, size - 20), rng.int(20, size - 20), rng.int(6, 13), T_WATER, 0.4);
  // bridges across lakes: carve a few horizontal/vertical strips through water as ice (walkable, slippery)
  for (let i = 0; i < 9; i++) { const r = rng.int(10, size - 10); for (let c = 0; c < size; c++) if (m.get(c, r) === T_WATER || m.get(c, r + 1) === T_WATER || m.get(c, r + 2) === T_WATER) { m.set(c, r, T_ICE, true); m.set(c, r + 1, T_ICE, true); m.set(c, r + 2, T_ICE, true); m.set(c, r + 3, T_ICE, true); } }
  // towns: grids of buildings
  for (let t = 0; t < 7 * K; t++) {
    const tc = rng.int(30, size - 60), tr = rng.int(30, size - 60), n = rng.int(3, 6);
    for (let k = 0; k < n; k++) { const w = rng.int(12, 20), h = rng.int(12, 18); const c0 = tc + rng.int(-24, 24), r0 = tr + rng.int(-24, 24); let ok = true; for (let r = r0 - 3; r < r0 + h + 3 && ok; r++) for (let c = c0 - 3; c < c0 + w + 3; c++) { const v = m.get(c, r); if (v === T_WATER || v === T_BRICK || v === T_STEEL) { ok = false; break; } } if (ok) building(m, rng, c0, r0, w, h); }
  }
  // forests
  for (let i = 0; i < 26 * K; i++) blob(m, rng, rng.int(10, size - 10), rng.int(10, size - 10), rng.int(4, 10), T_BUSH, 0.5);
  // scattered cover: brick walls & steel blocks
  for (let i = 0; i < 160 * K; i++) {
    const c = rng.int(4, size - 8), r = rng.int(4, size - 8), horiz = rng() < 0.5, len = rng.int(4, 12), v = rng() < 0.2 ? T_STEEL : T_BRICK;
    for (let k = 0; k < len; k++) { const cc = horiz ? c + k : c, rr = horiz ? r : r + k; if (m.get(cc, rr) === T_EMPTY && m.get(cc + 1, rr + 1) === T_EMPTY) { m.set(cc, rr, v, true); m.set(cc + (horiz ? 0 : 1), rr + (horiz ? 1 : 0), v, true); } }
  }
  // ruins: broken buildings (random missing wall chunks), steel pillars and a crate inside
  for (let i = 0; i < 34 * K; i++) {
    const c0 = rng.int(6, size - 22), r0 = rng.int(6, size - 22), w = rng.int(8, 14), h = rng.int(8, 12); let ok = true;
    for (let r = r0 - 1; r < r0 + h + 1 && ok; r++) for (let c = c0 - 1; c < c0 + w + 1; c++) if (m.get(c, r) !== T_EMPTY && m.get(c, r) !== T_BUSH) { ok = false; break; }
    if (!ok) continue;
    for (let c = c0; c < c0 + w; c++) for (let r = r0; r < r0 + h; r++) { const edge = c < c0 + 2 || c >= c0 + w - 2 || r < r0 + 2 || r >= r0 + h - 2; if (!edge) continue;
      const n = Math.sin(c * 1.7 + r * 0.9 + i) + Math.sin(c * 0.6 - r * 1.3); if (n > -0.35) m.set(c, r, (c - c0) % 6 < 2 && (r - r0) % 6 < 2 ? T_STEEL : T_BRICK, true); }
    m.rect(c0 + (w >> 1) - 1, r0 + (h >> 1) - 1, 2, 2, T_CRATE);
  }
  // r15: mud flats with swamp hearts (navigable, never on spawn/roads since only empty cells are converted)
  for (let i = 0; i < 16 * K; i++) { const c = rng.int(14, size - 14), r = rng.int(14, size - 14), rd = rng.int(4, 8); blob(m, rng, c, r, rd + 3, T_MUD, 0.45); if (rng() < 0.7) blob(m, rng, c, r, rd, T_SWAMP, 0.35, false); }
  for (let i = 0; i < 26 * K; i++) blob(m, rng, rng.int(10, size - 10), rng.int(10, size - 10), rng.int(2, 5), T_MUD, 0.5);
  // small ponds and bush clumps for extra cover / sight blockers
  for (let i = 0; i < 22 * K; i++) blob(m, rng, rng.int(10, size - 10), rng.int(10, size - 10), rng.int(2, 4), T_WATER, 0.3);
  for (let i = 0; i < 40 * K; i++) blob(m, rng, rng.int(10, size - 10), rng.int(10, size - 10), rng.int(2, 4), T_BUSH, 0.4);
  // sandbag-style L-shaped brick nests and steel tank traps
  for (let i = 0; i < 70 * K; i++) { const c = rng.int(6, size - 10), r = rng.int(6, size - 10), dx = rng() < 0.5 ? 1 : -1, dy = rng() < 0.5 ? 1 : -1;
    const cells = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [0, 2], [0, 3]]; if (cells.every(([a, b]) => m.get(c + a * dx, r + b * dy) === T_EMPTY)) for (const [a, b] of cells) m.set(c + a * dx, r + b * dy, T_BRICK, true); }
  for (let i = 0; i < 60 * K; i++) { const c = rng.int(6, size - 8), r = rng.int(6, size - 8); if (m.get(c, r) === T_EMPTY && m.get(c + 1, r + 1) === T_EMPTY) { m.set(c, r, T_STEEL, true); m.set(c + 1, r + 1, T_STEEL, true); } }
  // loot crates (2x2)
  for (let i = 0; i < 300 * K; i++) { const c = rng.int(4, size - 6), r = rng.int(4, size - 6); if ([0, 1].every(a => [0, 1].every(b => m.get(c + a, r + b) === T_EMPTY))) m.rect(c, r, 2, 2, T_CRATE); }
  // border
  m.rect(0, 0, size, 2, T_STEEL); m.rect(0, size - 2, size, 2, T_STEEL); m.rect(0, 0, 2, size, T_STEEL); m.rect(size - 2, 0, 2, size, T_STEEL);
  return m;
}

export function genTeam(seed) {
  const W = 150, H = 96, rng = makeRng(seed), m = new TileMap(W, H), half = W / 2;
  const put = (c, r, v) => { m.set(c, r, v, true); m.set(W - 1 - c, r, v, true); };
  const rectM = (c0, r0, w, h, v) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) put(c, r, v); };
  // central lake with ice crossings
  blob(m, rng, half, H / 2, 9, T_WATER, 0.2);
  for (let c = half - 14; c < half + 14; c++) for (const r of [H / 2 - 2, H / 2 - 1, H / 2, H / 2 + 1]) if (m.get(c, r) === T_WATER) m.set(c, r, T_ICE, true);
  // symmetric cover
  for (let i = 0; i < 46; i++) {
    const c = rng.int(16, half - 6), r = rng.int(4, H - 8), horiz = rng() < 0.5, len = rng.int(4, 10), v = rng() < 0.22 ? T_STEEL : T_BRICK;
    for (let k = 0; k < len; k++) { const cc = horiz ? c + k : c, rr = horiz ? r : r + k; if (cc < half - 3 && m.get(cc, rr) === T_EMPTY) { rectM(cc, rr, 1, 2, v); } }
  }
  for (let i = 0; i < 9; i++) { const c = rng.int(16, half - 8), r = rng.int(6, H - 10); for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (a * a + b * b < 14 + rng() * 6 && m.get(c + a, r + b) === T_EMPTY) put(c + a, r + b, T_BUSH); }
  for (let i = 0; i < 10; i++) { const c = rng.int(18, half - 6), r = rng.int(4, H - 6); if (m.get(c, r) === T_EMPTY && m.get(c + 1, r + 1) === T_EMPTY) rectM(c, r, 2, 2, T_CRATE); }
  // bases: clear zones at the far left / right, steel bunker walls with openings
  rectM(2, H / 2 - 16, 13, 32, T_EMPTY);
  rectM(14, H / 2 - 18, 2, 10, T_STEEL); rectM(14, H / 2 + 8, 2, 10, T_STEEL);
  m.rect(0, 0, W, 2, T_STEEL); m.rect(0, H - 2, W, 2, T_STEEL); m.rect(0, 0, 2, H, T_STEEL); m.rect(W - 2, 0, 2, H, T_STEEL);
  m.spawns = [[], []];
  for (let k = 0; k < 10; k++) { const y = (H / 2 - 13 + (k % 5) * 6.5) * 8, x = (5 + Math.floor(k / 5) * 5) * 8; m.spawns[0].push([x, y]); m.spawns[1].push([m.pw - x, y]); }
  return m;
}

export const CLASSIC_LEVELS = [
  { name: 'Кирпичный город', mix: { b: 18, f: 2, p: 0, a: 0 }, map: ['.............', '.B.B.B.B.B.B.', '.B.B.B.B.B.B.', '.B.B.BSB.B.B.', '.B.B.B.B.B.B.', '.B.B.t.t.B.B.', '.....B.B.....', 't.tt.....tt.t', 'S....B.B....S', '.B.B.BBB.B.B.', '.B.B.B.B.B.B.', '.B.B.....B.B.', '.............'] },
  { name: 'Стальной лес', mix: { b: 10, f: 5, p: 3, a: 2 }, map: ['...S...S.....', '.B.S...B.B.B.', '.B...BB.B.SB.', '.S..TT.B..S..', '...TTTB...B.S', 'SBB.TT.B.TT..', '.B.B..SS.B.B.', '..B..B.B..B..', '.TT..B.B..TT.', '.BB.BB.BB.BB.', '.B.........B.', '.B..B...B..B.', '.............'] },
  { name: 'Озёра', mix: { b: 6, f: 6, p: 4, a: 4 }, map: ['.............', '.TT.B...B.TT.', '.TBBB.S.BBBT.', '.T...B.B...T.', '..WW.....WW..', 'BB.WW.S.WW.BB', '...B.TTT.B...', 'S..B.TTT.B..S', '..WW.....WW..', '.B..B.B.B..B.', '.BB.BB.BB.BB.', '.B.........B.', '.............'] },
  { name: 'Крепость', mix: { b: 4, f: 6, p: 5, a: 5 }, map: ['.............', '.SBS.S.S.SBS.', '.B.B.....B.B.', '.B.B.TTT.B.B.', '...S.TTT.S...', 'BB...TTT...BB', '..S.......S..', '.BBB.WWW.BBB.', '.B.........B.', '.B.BBS.SBB.B.', '...B.....B...', 'TT.B.....B.TT', '.............'] },
  { name: 'Ледяная пустошь', mix: { b: 4, f: 8, p: 4, a: 4 }, map: ['.............', '.B.IIIIIII.B.', '.B.I.S.S.I.B.', '...I.....I...', 'SS.I.BBB.I.SS', '...IIIIIIII..', '.B..T...T..B.', '.BB.T.S.T.BB.', '....T...T....', '.SBB.....BBS.', '.B...B.B...B.', '.B.B.....B.B.', '.............'] },
  { name: 'Лабиринт', mix: { b: 2, f: 6, p: 6, a: 6 }, map: ['.............', '.BBBB.S.BBBB.', '.B.........B.', '.B.SBBBBBS.B.', '.B.B.....B.B.', '...B.TTT.B...', 'SB.B.TST.B.BS', '...B.TTT.B...', '.B.B.....B.B.', '.B.SBB.BBS.B.', '.B.........B.', '.BBBB...BBBB.', '.............'] },
];
// classic: each legacy 16px tile becomes 4x4 cells (32px) → 52x52 cell map (416px)
export function genClassic(levelIdx) {
  const L = CLASSIC_LEVELS[levelIdx % CLASSIC_LEVELS.length], m = new TileMap(52, 52);
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) {
    const ch = L.map[r][c], x = c * 4, y = r * 4;
    const v = { B: T_BRICK, S: T_STEEL, W: T_WATER, T: T_BUSH, I: T_ICE, t: T_BRICK, M: T_MUD, P: T_SWAMP }[ch];
    if (!v) continue;
    if (ch === 't') m.rect(x, y, 4, 2, v); else m.rect(x, y, 4, 4, v);
  }
  // clear spawns & base area
  for (const [c, r] of [[0, 0], [24, 0], [48, 0], [16, 48], [32, 48]]) m.rect(c, r, 4, 4, T_EMPTY);
  m.rect(22, 44, 8, 8, T_EMPTY);
  classicRing(m, T_BRICK);
  m.rect(24, 48, 4, 4, T_BASE);
  m.spawns = [[24 * 8 - 48, 50 * 8], [32 * 8 + 48, 50 * 8]];
  m.enemySpawns = [[16, 16], [208, 16], [400, 16]];
  m.base = { x: 26 * 8, y: 50 * 8 };
  return m;
}
export function classicRing(m, v) {
  m.rect(22, 46, 8, 2, v); m.rect(22, 48, 2, 4, v); m.rect(28, 48, 2, 4, v);
}
