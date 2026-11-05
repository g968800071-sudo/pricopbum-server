// r37 «Траншеи»: big muddy front with trench lines, forests and a village in no-man's land.
// New tiles: houses / fences / trees are crushable (tanks drive through them, they collapse with debris & dust);
// trenches give cover (less damage from afar, hard to spot) but slow tanks and can get them stuck.
import { TileMap } from './map.js';
import { makeRng } from './rng.js';
import { CELL, T_EMPTY, T_BRICK, T_STEEL, T_BUSH, T_CRATE, T_MUD, T_SWAMP } from './defs.js';
export const T_HOUSE = 12, T_FENCE = 13, T_TREE = 14, T_TRENCH = 15, TRENCH_SPD = 0.55, TRENCH_SEE = 100;
export const isCrush = (v) => v === T_HOUSE || v === T_FENCE || v === T_TREE;

export function genTrench(seed, W = 220, H = 130, def = null) {
  const rng = makeRng(seed * 131 + 7), m = new TileMap(W, H), half = Math.floor(W / 2), sx = W / 220, sy = H / 130;
  const put = (c, r, v) => { if (c < 2 || r < 2 || c >= W - 2 || r >= H - 2) return; m.set(c, r, v, true); m.set(W - 1 - c, r, v, true); };
  const getL = (c, r) => m.get(c, r), free = (c, r) => { const v = m.get(c, r); return v === T_EMPTY || v === T_MUD; };
  const bw = Math.max(8, Math.round(14 * sx));
  // 1) mud everywhere in no-man's land + shell craters (mud ring, puddle centre)
  const blob = (cx, cy, rad, v, only) => { for (let r = cy - rad - 1; r <= cy + rad + 1; r++) for (let c = cx - rad - 1; c <= cx + rad + 1; c++) { const d = Math.hypot(c - cx, r - cy) + (rng() - 0.5) * rad * 0.5; if (d < rad && c < half && (!only || m.get(c, r) === only)) put(c, r, v); } };
  for (let i = 0; i < Math.round(26 * sx * sy); i++) blob(rng.int(Math.round(26 * sx), half - 1), rng.int(6, H - 7), rng.int(3, 7), T_MUD, T_EMPTY);
  for (let i = 0; i < Math.round(10 * sx * sy); i++) { const c = rng.int(Math.round(40 * sx), half - 3), r = rng.int(8, H - 9); blob(c, r, rng.int(2, 3), T_MUD); if (rng() < 0.55) blob(c, r, 1, T_SWAMP); }
  // 2) trench lines (zig-zag, 3 cells wide, crossings), communication trenches between them, parapets on the enemy side
  const cover = [];
  const line = (base, ph, front) => { for (let r = 5; r < H - 5; r++) { if (r % 28 >= 25) continue; const cc = Math.round(base + Math.sin(r / 5 + ph) * 2 + (((r / 7) | 0) % 2 ? 1.5 : -1.5));
    for (let k = 0; k < 3; k++) if (m.get(cc + k, r) !== T_STEEL) put(cc + k, r, T_TRENCH);
    if (r % 3 === 0) cover.push([(cc + 1) * CELL + 4, r * CELL + 4, front]);
    if (front && rng() < 0.38 && free(cc + 3, r)) put(cc + 3, r, T_BRICK); } };
  const A = Math.round(30 * sx), B = Math.round(58 * sx); line(A, 0.3, 0); line(B, 1.7, 1);
  for (const fr of [0.3, 0.7]) { const r0 = Math.round(H * fr); for (let c = A + 2; c <= B; c++) for (let k = 0; k < 2; k++) if (m.get(c, r0 + k) !== T_TRENCH) put(c, r0 + k, T_TRENCH); }
  // 3) forests north & south: trees with undergrowth
  for (const [r0, r1] of [[4, Math.round(36 * sy)], [H - Math.round(36 * sy), H - 4]]) for (let i = 0; i < Math.round(6 * sx); i++) { const cx = rng.int(bw + 3, half - 6), cy = rng.int(r0, r1), rad = rng.int(4, 9);
    for (let r = cy - rad; r <= cy + rad; r++) for (let c = cx - rad; c <= cx + rad; c++) { if (Math.hypot(c - cx, r - cy) > rad * (0.8 + rng() * 0.3) || c >= half || !free(c, r)) continue; const q = rng(); if (q < 0.34) put(c, r, T_TREE); else if (q < 0.62) put(c, r, T_BUSH); } }
  // 4) village in the middle: houses (crushable blocks), fenced yards, a road, garden trees
  const houses = [], hid = new Int16Array(W * H), V0 = half - Math.round(28 * sx), Vr0 = Math.round(H / 2 - 34 * sy), Vr1 = Math.round(H / 2 + 34 * sy);
  for (let r = Math.floor(H / 2) - 1; r <= Math.floor(H / 2) + 1; r++) for (let c = V0 - 6; c < half; c++) if (m.get(c, r) !== T_TRENCH) put(c, r, T_EMPTY);
  const okRect = (c0, r0, w, h) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) { const v = m.get(c, r); if (c >= half - 1 || !(v === T_EMPTY || v === T_MUD || v === T_BUSH)) return false; } return true; };
  for (let i = 0, tries = 0; i < Math.round(8 * sx * sy) && tries < 500; tries++) { const w = rng.int(5, 8), h = rng.int(4, 6), c = rng.int(V0, half - w - 3), r = rng.int(Vr0, Vr1 - h); if (Math.abs(r + h / 2 - H / 2) < h / 2 + 3) continue;
    if (!okRect(c - 3, r - 3, w + 6, h + 6)) continue;
    for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) put(cc, rr, T_HOUSE);
    const id = houses.length; houses.push([c, r, w, h], [W - c - w, r, w, h]);
    for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) { hid[rr * W + cc] = id + 1; hid[rr * W + (W - 1 - cc)] = id + 2; }
    const gate = rng.int(0, 3); // fenced yard with a gate
    for (let cc = c - 2; cc < c + w + 2; cc++) for (const rr of [r - 2, r + h + 1]) if (free(cc, rr) && !(gate < 2 && rr === (gate ? r + h + 1 : r - 2) && Math.abs(cc - (c + w / 2)) < 1.5)) put(cc, rr, T_FENCE);
    for (let rr = r - 1; rr < r + h + 1; rr++) for (const cc of [c - 2, c + w + 1]) if (free(cc, rr) && !(gate >= 2 && cc === (gate === 3 ? c + w + 1 : c - 2) && Math.abs(rr - (r + h / 2)) < 1.5)) put(cc, rr, T_FENCE);
    if (rng() < 0.7 && free(c + w + 3, r + 1)) put(c + w + 3, r + 1, T_TREE); i++; }
  // 5) ruins, crates
  for (let i = 0; i < Math.round(12 * sx * sy); i++) { const c = rng.int(bw + 2, half - 5), r = rng.int(5, H - 7), horiz = rng() < 0.5, len = rng.int(2, 5); for (let k = 0; k < len; k++) { const cc = horiz ? c + k : c, rr = horiz ? r : r + k; if (free(cc, rr)) put(cc, rr, T_BRICK); } }
  for (let i = 0; i < Math.round(20 * sx * sy); i++) { const c = rng.int(bw + 2, half - 4), r = rng.int(4, H - 6); if (free(c, r) && free(c + 1, r) && free(c, r + 1) && free(c + 1, r + 1)) { put(c, r, T_CRATE); put(c + 1, r, T_CRATE); put(c, r + 1, T_CRATE); put(c + 1, r + 1, T_CRATE); } }
  // 6) borders, spawn yards (15 per team)
  m.rect(0, 0, W, 2, T_STEEL); m.rect(0, H - 2, W, 2, T_STEEL); m.rect(0, 0, 2, H, T_STEEL); m.rect(W - 2, 0, 2, H, T_STEEL);
  const sh = Math.min(64, H - 10); for (let r = Math.floor(H / 2 - sh / 2); r < H / 2 + sh / 2; r++) for (let c = 2; c < bw; c++) put(c, r, T_EMPTY);
  m.spawns = [[], []]; for (let k = 0; k < 15; k++) { const col = Math.floor(k / 5), row = k % 5, x = (4 + col * Math.max(2, Math.floor((bw - 5) / 2))) * CELL, y = Math.round(H / 2 - sh / 2 + 6 + row * (sh - 12) / 4) * CELL; m.spawns[0].push([x, y]); m.spawns[1].push([m.pw - x, y]); }
  m.cover = cover.concat(cover.map(([x, y, f]) => [m.pw - x, y, f])); m.coverSide = cover.length; // first half belongs to team 0 (west)
  m.houses = houses; m.hid = hid; m.hleft = houses.map(([c, r, w, h]) => w * h); m.trench = 1; m.crush = 1;
  const g = def && def.g ? def.g : ['#56603a', '#5f6a40', '#4b5432'];
  m.theme = { ground: g[0], g2: g[1], g3: g[2], speck: 'rgba(255,250,220,0.05)', dark: 'rgba(30,20,5,0.12)' }; m.mapName = def ? def.name : 'Траншеи'; m.mapId = 'trenches';
  return m;
}

// tank ↔ crushable tiles: called after every move; returns the slowdown to apply
export function crushTank(w, t) {
  let bd = -1e9, bc = 0, br = 0, bv = 0; const m = w.map, R = 11, c0 = Math.floor((t.x - R) / CELL), c1 = Math.floor((t.x + R) / CELL), r0 = Math.floor((t.y - R) / CELL), r1 = Math.floor((t.y + R) / CELL); let slow = 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = m.get(c, r); if (!isCrush(v)) continue;
    const nx = Math.max(c * CELL, Math.min(t.x, c * CELL + CELL)), ny = Math.max(r * CELL, Math.min(t.y, r * CELL + CELL)); if ((t.x - nx) ** 2 + (t.y - ny) ** 2 > R * R) continue;
    slow = Math.max(slow, v === T_HOUSE ? 0.5 : v === T_TREE ? 0.32 : 0.12); if (v === T_FENCE) { collapse(w, c, r, t.a, 0); continue; } // fences snap at once; walls and trunks give way after a push
    const d = (c * CELL + 4 - t.x) * Math.cos(t.a) + (r * CELL + 4 - t.y) * Math.sin(t.a); if (d > bd) { bd = d; bc = c; br = r; bv = v; } }
  if (bv) { const i = br * m.w + bc; m.hp[i] -= (bv === T_HOUSE ? 1.3 : 4.5) / 30; if (m.hp[i] <= 0.001) collapse(w, bc, br, t.a, bv === T_HOUSE && (w.time * 7 | 0) % 3 === 0 ? 1 : 0); } // only the wall/trunk the hull pushes against gives way
  if (slow) t.crushT = Math.max(t.crushT || 0, slow);
}
// knock a crushable cell down (and its neighbours of the same house); the whole house falls once < 45% stands
export function collapse(w, c, r, a, rad) {
  const m = w.map, v0 = m.get(c, r); if (!isCrush(v0)) return; let n = 0, sx = 0, sy = 0;
  const down = (cc, rr) => { const v = m.get(cc, rr); if (!isCrush(v)) return; m.set(cc, rr, T_EMPTY); n++; sx += cc; sy += rr; if (v === T_HOUSE && m.hid) { const h = m.hid[rr * m.w + cc] - 1; if (h >= 0) m.hleft[h]--; } };
  if (v0 === T_HOUSE && m.hid) { const h = m.hid[r * m.w + c] - 1; for (let rr = r - rad; rr <= r + rad; rr++) for (let cc = c - rad; cc <= c + rad; cc++) if (m.get(cc, rr) === T_HOUSE && m.hid[rr * m.w + cc] - 1 === h && Math.hypot(cc - c, rr - r) <= rad + 0.3) down(cc, rr);
    if (h >= 0) { const [hc, hr, hw, hh] = m.houses[h]; if (m.hleft[h] > 0 && m.hleft[h] < hw * hh * 0.3) { for (let rr = hr; rr < hr + hh; rr++) for (let cc = hc; cc < hc + hw; cc++) if (m.get(cc, rr) === T_HOUSE) down(cc, rr); } } }
  else down(c, r);
  if (n) w.ev({ k: 'crumble', x: (sx / n) * CELL + 4, y: (sy / n) * CELL + 4, kd: v0 === T_HOUSE ? 0 : v0 === T_FENCE ? 1 : 2, n, a: +(a || 0).toFixed(2) });
}
