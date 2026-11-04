// 15 themed battle maps for team / arena / duel / special modes, plus custom (editor) maps.
import { T_MUD, T_SWAMP, T_EMPTY, T_BRICK, T_STEEL, T_WATER, T_BUSH, T_ICE, T_CRATE } from './defs.js';
import { TileMap } from './map.js';
import { makeRng } from './rng.js';

// p: lake (0..1.6), cover (walls count multiplier), steel (share), bush, crates, ice (lake → ice share), river (vertical river with bridges)
export const MAPS = [
  { id: 'steppe',   name: 'Степь',            g: ['#7d6a48', '#8a764f', '#6f5d3e'], p: { lake: 1, cover: 1, steel: 0.22, bush: 1, crates: 1 } },
  { id: 'forest',   name: 'Тайга',            g: ['#2f4526', '#365029', '#283c21'], p: { lake: 0.6, cover: 0.7, steel: 0.1, bush: 2.6, crates: 1 } },
  { id: 'desert',   name: 'Пустыня',          g: ['#b89a62', '#c4a66c', '#a88b56'], p: { lake: 0.3, cover: 0.8, steel: 0.35, bush: 0.3, crates: 1.4 } },
  { id: 'winter',   name: 'Зима',             g: ['#c9d3dc', '#d5dee6', '#b9c4ce'], p: { lake: 1.3, ice: 1, cover: 0.9, steel: 0.2, bush: 0.6, crates: 1 } },
  { id: 'city',     name: 'Руины города',     g: ['#5a5a5e', '#646468', '#4f4f53'], p: { lake: 0, cover: 2, steel: 0.3, bush: 0.3, crates: 1.6 } },
  { id: 'swamp',    name: 'Болото',           g: ['#4a4d30', '#535637', '#40432a'], p: { lake: 1.6, cover: 0.6, steel: 0.1, bush: 1.8, crates: 0.8 } },
  { id: 'canyon',   name: 'Каньон',           g: ['#8a4f32', '#965a3a', '#7a452b'], p: { lake: 0, cover: 1.4, steel: 0.55, bush: 0.2, crates: 0.8 } },
  { id: 'river',    name: 'Река',             g: ['#5e7040', '#677a46', '#536338'], p: { lake: 0, river: 1, cover: 1, steel: 0.2, bush: 1.2, crates: 1 } },
  { id: 'fortress', name: 'Крепость',         g: ['#6b6250', '#756b58', '#5f5747'], p: { lake: 0.5, cover: 1.2, steel: 0.6, bush: 0.5, crates: 1, fort: 1 } },
  { id: 'islands',  name: 'Острова',          g: ['#6f8a4c', '#789452', '#637c43'], p: { lake: 0.4, islands: 1, cover: 0.7, steel: 0.2, bush: 1, crates: 1 } },
  { id: 'glacier',  name: 'Ледник',           g: ['#a9c2d6', '#b5cddf', '#9cb5c9'], p: { lake: 1.5, ice: 1, iceField: 1, cover: 0.5, steel: 0.4, bush: 0.1, crates: 0.8 } },
  { id: 'jungle',   name: 'Джунгли',          g: ['#24452a', '#2a4f31', '#1f3c24'], p: { lake: 0.8, cover: 0.5, steel: 0.05, bush: 3.4, crates: 1.2 } },
  { id: 'factory',  name: 'Завод',            g: ['#4a4f57', '#535861', '#42464e'], p: { lake: 0, cover: 1.8, steel: 0.7, bush: 0, crates: 2 } },
  { id: 'volcano',  name: 'Вулкан',           g: ['#3b2a26', '#45312c', '#33241f'], p: { lake: 1.2, lava: 1, cover: 1, steel: 0.45, bush: 0, crates: 1 } },
  { id: 'labyrinth',name: 'Лабиринт',         g: ['#3a4a5c', '#425366', '#334152'], p: { lake: 0, maze: 1, cover: 0.4, steel: 0.4, bush: 0.4, crates: 0.6 } },
];

function blob(m, rng, cx, cy, r, v, rough, mirror) {
  for (let dy = -r - 2; dy <= r + 2; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
    const d = Math.hypot(dx, dy) + (rng() - 0.5) * r * rough; if (d > r) continue;
    m.set(cx + dx, cy + dy, v, true); if (mirror) m.set(m.w - 1 - (cx + dx), cy + dy, v, true);
  }
}

// W/H in cells; default full team map (150x96). Mirror-symmetric so both sides are fair.
export function genArena(seed, mapIdx = 0, W = 150, H = 96) {
  const def = MAPS[((mapIdx % MAPS.length) + MAPS.length) % MAPS.length], p = def.p, rng = makeRng(seed * 31 + mapIdx * 977), m = new TileMap(W, H), half = W / 2;
  const area = (W * H) / (150 * 96), put = (c, r, v) => { m.set(c, r, v, true); m.set(W - 1 - c, r, v, true); };
  const rectM = (c0, r0, w, h, v) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) put(c, r, v); };
  const bw = Math.min(16, Math.floor(W * 0.11));
  if (p.lake) { const lr = Math.max(3, Math.round(9 * Math.sqrt(area) * p.lake)); blob(m, rng, Math.floor(half), Math.floor(H / 2), lr, T_WATER, 0.25);
    if (p.ice) { for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (m.get(c, r) === T_WATER && rng() < 0.55) m.set(c, r, T_ICE, true); }
    else for (let c = Math.floor(half - lr - 4); c < half + lr + 4; c++) for (const r of [H / 2 - 2, H / 2 - 1, H / 2, H / 2 + 1]) if (m.get(c, r) === T_WATER) m.set(c, r, T_ICE, true); }
  if (p.iceField) for (let i = 0; i < 8 * area; i++) blob(m, rng, rng.int(bw + 4, half - 4), rng.int(6, H - 6), rng.int(2, 5), T_ICE, 0.4, true);
  if (p.river) { for (let r = 0; r < H; r++) { const c0 = Math.floor(half - 3 + Math.sin(r / 7) * 2); for (let c = c0; c < c0 + 6; c++) m.set(c, r, T_WATER, true); }
    for (const fr of [0.2, 0.5, 0.8]) { const r0 = Math.floor(H * fr) - 2; for (let r = r0; r < r0 + 4; r++) for (let c = Math.floor(half - 6); c < half + 6; c++) if (m.get(c, r) === T_WATER) m.set(c, r, T_ICE, true); } }
  if (p.islands) for (let i = 0; i < 7 * area; i++) { const c = rng.int(bw + 8, half - 6), r = rng.int(8, H - 8); blob(m, rng, c, r, rng.int(4, 7), T_WATER, 0.3, true); blob(m, rng, c, r, rng.int(2, 3), T_EMPTY, 0.2, true); }
  if (p.lava) for (let i = 0; i < 6 * area; i++) blob(m, rng, rng.int(bw + 6, half - 4), rng.int(6, H - 6), rng.int(2, 4), T_WATER, 0.5, true);
  if (p.maze) { for (let r = 6; r < H - 6; r += 8) for (let c = bw + 4; c < half - 2; c += 8) { if (rng() < 0.5) rectM(c, r, 8, 1, rng() < p.steel ? T_STEEL : T_BRICK); else rectM(c, r, 1, 8, rng() < p.steel ? T_STEEL : T_BRICK); } }
  if (p.fort) { const c = Math.floor(half - 10), r = Math.floor(H / 2 - 10); for (let k = 0; k < 20; k++) { if (k < 8 || k > 11) { put(c, r + k, T_STEEL); } } }
  const walls = Math.round(64 * area * p.cover);
  for (let i = 0; i < walls; i++) {
    const c = rng.int(bw, Math.max(bw + 1, half - 6)), r = rng.int(4, H - 8), horiz = rng() < 0.5, len = rng.int(3, 10), v = rng() < p.steel ? T_STEEL : T_BRICK;
    for (let k = 0; k < len; k++) { const cc = horiz ? c + k : c, rr = horiz ? r : r + k; if (cc < half - 3 && m.get(cc, rr) === T_EMPTY) rectM(cc, rr, 1, 2, v); }
  }
  for (let i = 0; i < Math.round(12 * area * p.bush); i++) { const c = rng.int(bw, Math.max(bw + 1, half - 8)), r = rng.int(6, H - 10); for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (a * a + b * b < 14 + rng() * 6 && m.get(c + a, r + b) === T_EMPTY) put(c + a, r + b, T_BUSH); }
  // r15: mud patches + a few swamps on every arena (mirrored by finishSides)
  for (let i = 0; i < Math.round(3 * area); i++) { const c = rng.int(bw + 4, Math.max(bw + 5, half - 8)), r = rng.int(6, H - 8); blob(m, rng, c, r, rng.int(2, 4), T_MUD, 0.4, true); if (rng() < 0.5) blob(m, rng, c, r, rng.int(1, 3), T_SWAMP, 0.3, true); }
  for (let i = 0; i < Math.round(17 * area * p.crates); i++) { const c = rng.int(bw + 2, Math.max(bw + 3, half - 6)), r = rng.int(4, H - 6); if (m.get(c, r) === T_EMPTY && m.get(c + 1, r + 1) === T_EMPTY) rectM(c, r, 2, 2, T_CRATE); }
  finishSides(m, bw);
  m.theme = { ground: def.g[0], g2: def.g[1], g3: def.g[2] }; m.mapName = def.name; m.mapId = def.id;
  return m;
}

function finishSides(m, bw) {
  const W = m.w, H = m.h, cl = (c0, r0, w, h) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) { m.set(c, r, T_EMPTY, true); m.set(W - 1 - c, r, T_EMPTY, true); } };
  const sh = Math.min(32, H - 8); cl(2, Math.floor(H / 2 - sh / 2), bw - 2, sh);
  if (H >= 60) { for (const [r0, len] of [[H / 2 - 18, 10], [H / 2 + 8, 10]]) for (let r = r0; r < r0 + len; r++) for (let c = bw - 2; c < bw; c++) { m.set(c, r, T_STEEL, true); m.set(W - 1 - c, r, T_STEEL, true); } }
  m.rect(0, 0, W, 2, T_STEEL); m.rect(0, H - 2, W, 2, T_STEEL); m.rect(0, 0, 2, H, T_STEEL); m.rect(W - 2, 0, 2, H, T_STEEL);
  m.spawns = [[], []]; const span = Math.min(26, sh - 6);
  for (let k = 0; k < 10; k++) { const y = (H / 2 - span / 2 + (k % 5) * (span / 4)) * 8, x = (4 + Math.floor(k / 5) * Math.max(2, Math.min(5, bw / 3))) * 8; m.spawns[0].push([x, y]); m.spawns[1].push([m.pw - x, y]); }
}

// ---------- race track: a closed ring around a central island, with checkpoints ----------
export function genRace(seed, mapIdx = 0) {
  const W = 128, H = 88, TW = 20, def = MAPS[((mapIdx % MAPS.length) + MAPS.length) % MAPS.length], rng = makeRng(seed * 17 + 5), m = new TileMap(W, H);
  m.rect(0, 0, W, 2, T_STEEL); m.rect(0, H - 2, W, 2, T_STEEL); m.rect(0, 0, 2, H, T_STEEL); m.rect(W - 2, 0, 2, H, T_STEEL);
  const i0 = 2 + TW, i1 = W - 2 - TW, j0 = 2 + TW, j1 = H - 2 - TW;
  m.rect(i0, j0, i1 - i0, j1 - j0, T_STEEL); m.rect(i0 + 2, j0 + 2, i1 - i0 - 4, j1 - j0 - 4, T_BUSH);
  for (let k = 0; k < 6; k++) { const c = rng.int(i0 + 6, i1 - 10), r = rng.int(j0 + 6, j1 - 8); m.rect(c, r, rng.int(3, 7), rng.int(2, 5), T_WATER); }
  // obstacles on the straights: never closing more than half the track width
  const lanes = [[2, j0 + 4, TW, j1 - j0 - 8, 'v'], [i1, j0 + 4, TW, j1 - j0 - 8, 'v'], [i0 + 4, 2, i1 - i0 - 8, TW, 'h'], [i0 + 4, j1, i1 - i0 - 8, TW, 'h']];
  for (const [c0, r0, w, h, d] of lanes) for (let k = 0; k < 4; k++) {
    const along = d === 'v' ? r0 + Math.floor((k + 0.5) * h / 4) : c0 + Math.floor((k + 0.5) * w / 4), side = rng() < 0.5, len = Math.floor(TW * (0.3 + rng() * 0.2)), v = rng() < 0.5 ? T_CRATE : rng() < 0.6 ? T_BRICK : T_STEEL;
    if (rng() < 0.3) { const ic = d === 'v' ? c0 + 3 : along - 4, ir = d === 'v' ? along - 4 : r0 + 3; m.rect(ic, ir, d === 'v' ? TW - 6 : 8, d === 'v' ? 8 : TW - 6, T_ICE); continue; }
    if (d === 'v') { const c = side ? c0 : c0 + TW - len; m.rect(c, along, len, 2, v); } else { const r = side ? r0 : r0 + TW - len; m.rect(along, r, 2, len, v); }
  }
  for (let k = 0; k < 10; k++) { const c = rng.int(3, W - 6), r = rng.int(3, H - 6); if (m.get(c, r) === T_EMPTY && (c < i0 || c > i1 || r < j0 || r > j1)) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b < 6 && m.get(c + a, r + b) === T_EMPTY) m.set(c + a, r + b, T_BUSH, true); }
  const L = (2 + TW / 2) * 8, R = m.pw - L, T = L, B = m.ph - L, cx = m.pw / 2, cy = m.ph / 2;
  // clockwise: start on the left straight going up
  m.checkpoints = [[L, cy], [L, T], [cx, T], [R, T], [R, cy], [R, B], [cx, B], [L, B]]; m.cpR = TW * 4 + 6;
  const onTrack = (c, r) => c >= 2 && r >= 2 && c < W - 2 && r < H - 2 && (c < i0 || c >= i1 || r < j0 || r >= j1);
  for (const [x, y] of m.checkpoints) { const c = Math.floor(x / 8), r = Math.floor(y / 8); for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const v = m.get(c + a, r + b); if (onTrack(c + a, r + b) && v !== T_ICE && v !== T_BUSH) m.set(c + a, r + b, T_EMPTY, true); } }
  const grid = []; for (let k = 0; k < 12; k++) { const x = L + ((k % 3) - 1) * 44, y = cy + 40 + Math.floor(k / 3) * 30; grid.push([x, y]); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) m.set(Math.floor(x / 8) + a, Math.floor(y / 8) + b, T_EMPTY, true); }
  m.spawns = [grid, grid]; m.theme = { ground: def.g[0], g2: def.g[1], g3: def.g[2] }; m.mapName = 'Трасса «' + def.name + '»'; m.mapId = 'race-' + def.id;
  return m;
}

// ---------- custom maps (editor) ----------
export const EDIT_W = 60, EDIT_H = 40;
const CH = { '.': T_EMPTY, B: T_BRICK, S: T_STEEL, W: T_WATER, T: T_BUSH, I: T_ICE, C: T_CRATE, M: T_MUD, P: T_SWAMP };
const RC = Object.fromEntries(Object.entries(CH).map(([k, v]) => [v, k]));
export function encodeMap(tiles, w = EDIT_W, h = EDIT_H) {
  let out = 'P1-' + w + 'x' + h + '-', i = 0;
  while (i < tiles.length) { const v = tiles[i]; let n = 1; while (i + n < tiles.length && tiles[i + n] === v) n++; out += (RC[v] || '.') + (n > 1 ? n.toString(36) : ''); i += n; }
  return out;
}
export function decodeMap(code) {
  const mt = /^P1-(\d+)x(\d+)-(.*)$/.exec(String(code || '').trim()); if (!mt) return null;
  const w = +mt[1], h = +mt[2]; if (w < 20 || h < 16 || w > 160 || h > 120) return null;
  const tiles = new Uint8Array(w * h); let i = 0; const re = /([.BSWTICMP])([0-9a-z]*)/g; let g;
  while ((g = re.exec(mt[3])) && i < tiles.length) { const n = g[2] ? parseInt(g[2], 36) : 1; tiles.fill(CH[g[1]], i, Math.min(tiles.length, i + n)); i += n; }
  return i >= tiles.length ? { w, h, tiles } : null;
}
export function genCustom(code) {
  const d = decodeMap(code); if (!d) return null; const m = TileMap.from({ w: d.w, h: d.h, t: d.tiles });
  finishSides(m, 6); m.theme = { ground: '#6b5e44', g2: '#76684c', g3: '#5f533c' }; m.mapName = 'Своя карта'; m.mapId = 'custom';
  return m;
}
