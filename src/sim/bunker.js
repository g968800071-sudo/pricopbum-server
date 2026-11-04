// r15: underground bunkers («ПОДЗЕМЕЛЬЕ»). A second TileMap in the same coordinates: rock everywhere, carved tunnels and rooms
// joining hatches (T_HATCH) spread over the surface. t.layer 0 = surface, 1 = underground. Deterministic from seed + surface map,
// so online clients rebuild it locally; layer-aware simulation lives in sim.js (near(), map swap), snapshots in protocol.js.
import { CELL, T_EMPTY, T_STEEL, T_HATCH, T_BUSH, T_MUD } from './defs.js';
import { TileMap } from './map.js';
import { makeRng } from './rng.js';

export function genBunker(surf, seed) {
  const W = surf.w, H = surf.h, rng = makeRng((seed ^ 0xb0b0) >>> 0), u = new TileMap(W, H); u.t.fill(T_STEEL); u.hard = true; u.theme = { ground: '#5a5248', g2: '#655c50', g3: '#4b443b', speck: '#6f665a', dark: '#3a342d' }; u.mapName = 'Подземелье'; const rng2 = makeRng((seed ^ 0xcafe) >>> 0); u.mapId = 'bunker'; u.under = true;
  const open = (c, r) => { for (let dc = -2; dc <= 3; dc++) for (let dr = -2; dr <= 3; dr++) { const v = surf.get(c + dc, r + dr); if (v !== T_EMPTY && v !== T_BUSH && v !== T_MUD && v !== T_HATCH) return false; } return true; };
  let hatches = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (surf.get(c, r) === T_HATCH && surf.get(c - 1, r) !== T_HATCH && surf.get(c, r - 1) !== T_HATCH) hatches.push({ c, r });
  if (!hatches.length) { const N = Math.max(4, Math.min(W * H > 200000 ? 32 : 12, Math.round(W * H / 9000))), cx = W / 2, cy = H / 2;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + rng() * 0.4, rad = 0.28 + rng() * 0.12; for (let k = 0; k < 60; k++) { const c = Math.round(cx + Math.cos(a) * W * rad + (rng() - 0.5) * k * 1.5), r = Math.round(cy + Math.sin(a) * H * rad + (rng() - 0.5) * k * 1.5);
      if (c > 8 && r > 8 && c < W - 9 && r < H - 9 && open(c, r) && !hatches.some(h => Math.abs(h.c - c) + Math.abs(h.r - r) < 20)) { hatches.push({ c, r }); break; } } } }
  for (const h of hatches) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) surf.set(h.c + a, h.r + b, T_HATCH, true);
  const carve = (c0, r0, c1, r1, w) => { const sc = Math.sign(c1 - c0), sr = Math.sign(r1 - r0); let c = c0, r = r0; const cell = () => { for (let a = -w; a <= w; a++) for (let b = -w; b <= w; b++) if (c + a > 1 && r + b > 1 && c + a < W - 2 && r + b < H - 2) u.set(c + a, r + b, T_EMPTY, true); };
    const horizFirst = rng2() < 0.5; if (horizFirst) { while (c !== c1) { cell(); c += sc; } while (r !== r1) { cell(); r += sr; } } else { while (r !== r1) { cell(); r += sr; } while (c !== c1) { cell(); c += sc; } } cell(); };
  const rooms = [];
  const room = (c, r, s) => { for (let a = -s; a <= s; a++) for (let b = -s; b <= s; b++) if (c + a > 1 && r + b > 1 && c + a < W - 2 && r + b < H - 2) u.set(c + a, r + b, T_EMPTY, true); rooms.push({ x: c * CELL + 4, y: r * CELL + 4 });
    for (const [a, b] of [[-s + 2, -s + 2], [s - 2, -s + 2], [-s + 2, s - 2], [s - 2, s - 2]]) if (s >= 5) u.set(c + a, r + b, T_STEEL, true); }; // pillars = cover
  hatches.sort((a, b) => Math.atan2(a.r - H / 2, a.c - W / 2) - Math.atan2(b.r - H / 2, b.c - W / 2));
  for (let i = 0; i < hatches.length; i++) { const a = hatches[i], b = hatches[(i + 1) % hatches.length]; carve(a.c, a.r, b.c, b.r, 2); const mc = Math.round((a.c + b.c) / 2), mr = Math.round((a.r + b.r) / 2); room(mc, mr, 6); }
  for (let i = 0; i + 2 < hatches.length; i += 3) { const a = hatches[i], b = hatches[(i + Math.floor(hatches.length / 2)) % hatches.length]; carve(a.c, a.r, b.c, b.r, 2); } // cross tunnels = flanking routes
  for (const h of hatches) { room(h.c, h.r, 4); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) u.set(h.c + a, h.r + b, T_HATCH, true); }
  u.rooms = rooms; u.hatches = hatches.map(h => ({ x: h.c * CELL + 8, y: h.r * CELL + 8 })); surf.hatches = u.hatches; return u;
}
export function onHatch(w, t) { const m = w.map, v = m.get(Math.floor(t.x / CELL), Math.floor(t.y / CELL)); if (v === T_HATCH) return true; const H = m.hatches; if (H) for (const h of H) if ((h.x - t.x) ** 2 + (h.y - t.y) ** 2 < 14 * 14) return true; return false; } // r17: bigger tanks — 14 px tolerance around the hatch centre
// BFS flow field over the bunker grid toward a target cell (cached per target) so bots follow tunnels instead of hugging rock
function flowTo(u, x, y) { const c0 = Math.floor(x / CELL), r0 = Math.floor(y / CELL), key = c0 + ',' + r0, F = u._flow || (u._flow = new Map()); let D = F.get(key); if (D) return D;
  const W = u.w, H = u.h; D = new Int32Array(W * H).fill(1e9); const q = new Int32Array(W * H); let qh = 0, qt = 0; D[r0 * W + c0] = 0; q[qt++] = r0 * W + c0;
  while (qh < qt) { const i = q[qh++], c = i % W, r = (i / W) | 0, d = D[i] + 1; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue; const j = nr * W + nc; if (D[j] <= d) continue; const v = u.get(nc, nr); if (v !== T_EMPTY && v !== 10) continue; if (u.tankBlockedAt((nc + 0.5) * CELL, (nr + 0.5) * CELL, 8.5) && Math.abs(nc - c0) + Math.abs(nr - r0) > 2) continue; /* r19: only cells a (bigger) tank fits through */ D[j] = d; q[qt++] = j; } }
  if (F.size > 64) F.clear(); F.set(key, D); return D; }
function flowAng(u, t, x, y) { const D = flowTo(u, x, y), W = u.w, c = Math.floor(t.x / CELL), r = Math.floor(t.y / CELL); let best = null, bd = D[r * W + c] ?? 1e9;
  for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= W || nr >= u.h) continue; const v = D[nr * W + nc] + Math.hypot(dc, dr) * 0.15; if (v < bd) { const mx = (t.x + (nc + 0.5) * CELL) / 2, my = (t.y + (nr + 0.5) * CELL) / 2; if ((dc || dr) && Math.max(Math.abs(dc), Math.abs(dr)) > 1 && u.tankBlockedAt(mx, my, 8.5)) continue; bd = v; best = [nc, nr]; } }
  return best ? Math.atan2((best[1] + 0.5) * CELL - t.y, (best[0] + 0.5) * CELL - t.x) : Math.atan2(y - t.y, x - t.x); }
// bots: go loot the bunker, ambush in tunnels a while, come back up
export function bunkerBot(w, t, ai, tg) {
  if (!w.under || tg) return null; const H = w.under.hatches; if (!H || !H.length) return null;
  ai.bkT = (ai.bkT ?? (20 + Math.random() * 60)) - 1 / 30;
  if (!t.layer) { if (ai.bkT > 0 || ai.bkSkip) { if (ai.bkT <= 0) { ai.bkSkip = false; ai.bkT = 40 + Math.random() * 60; } return null; }
    let best = null, bd = 260 * 260; for (const h of H) { const d = (h.x - t.x) ** 2 + (h.y - t.y) ** 2; if (d < bd) { bd = d; best = h; } } if (!best) { ai.bkT = 15; return null; }
    if (bd < 144) { ai.bkGo = 1; ai.bkIn = 18 + Math.random() * 25; return { act: 'bunker' }; } if (Math.random() < 0.002) { ai.bkSkip = true; ai.bkT = 30; } return { moveA: Math.atan2(best.y - t.y, best.x - t.x), speedK: 1 }; }
  ai.bkIn = (ai.bkIn ?? 25) - 1 / 30;
  if (ai.bkIn > 0) { const R = w.under.rooms; ai.room = ai.room ?? Math.floor(Math.random() * R.length); const p = R[ai.room % R.length]; if (Math.hypot(p.x - t.x, p.y - t.y) < 24) ai.room = Math.floor(Math.random() * R.length); return { moveA: flowAng(w.under, t, p.x, p.y), speedK: 0.9 }; }
  let best = null, bd = 1e12; for (const h of H) { const d = (h.x - t.x) ** 2 + (h.y - t.y) ** 2; if (d < bd) { bd = d; best = h; } }
  if (bd < 144) { ai.bkT = 60 + Math.random() * 90; ai.room = null; return { act: 'bunker' }; } return { moveA: flowAng(w.under, t, best.x, best.y), speedK: 1 };
}
