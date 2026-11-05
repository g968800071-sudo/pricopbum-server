// r37 relief for the big Королевская битва only (variant 'br'): hills / mountains and pits / craters.
// A coarse per-cell height grid (Float32, O(1) lookup) — cheap enough for 150 tanks on phones.
// Effects: slopes slow climbing / speed descent, hill crests block low shots (cover), tanks deep in a crater are hidden from
// afar (ambush), high ground sees further. Everything deterministic from the map seed, so online clients rebuild it too.
import { CELL } from './defs.js';
function mul(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function addTerrain(m, seed) {
  const R = mul((seed ^ 0x5EED7E11) >>> 0), W = m.w, H = m.h, pw = m.pw, ph = m.ph, hz = [];
  const nH = Math.round(pw * ph / 160000) + 6, nP = Math.round(pw * ph / 190000) + 5;
  const far = (x, y, r) => hz.every(f => Math.hypot(f.x - x, f.y - y) > f.r + r + 30);
  for (let k = 0, n = 0; k < nH * 20 && n < nH; k++) { const r = 70 + R() * 110, x = r + 40 + R() * (pw - 2 * r - 80), y = r + 40 + R() * (ph - 2 * r - 80); if (!far(x, y, r)) continue; hz.push({ x, y, r, h: 18 + R() * 18 + (r > 150 ? 8 : 0), k: r > 150 ? 'mtn' : 'hill' }); n++; }
  for (let k = 0, n = 0; k < nP * 20 && n < nP; k++) { const r = 34 + R() * 46, x = r + 40 + R() * (pw - 2 * r - 80), y = r + 40 + R() * (ph - 2 * r - 80); if (!far(x, y, r)) continue; hz.push({ x, y, r, h: -(12 + R() * 8), k: 'pit' }); n++; }
  const g = new Float32Array(W * H);
  for (const f of hz) { const c0 = Math.max(0, Math.floor((f.x - f.r) / CELL)), c1 = Math.min(W - 1, Math.ceil((f.x + f.r) / CELL)), r0 = Math.max(0, Math.floor((f.y - f.r) / CELL)), r1 = Math.min(H - 1, Math.ceil((f.y + f.r) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const d = Math.hypot((c + 0.5) * CELL - f.x, (r + 0.5) * CELL - f.y) / f.r; if (d >= 1) continue;
      const v = f.h > 0 ? f.h * (0.5 + 0.5 * Math.cos(Math.PI * d)) : f.h * (d < 0.7 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (d - 0.7) / 0.3)) + (f.h < 0 && d > 0.8 ? 3 * Math.sin(Math.PI * (d - 0.8) / 0.2) : 0); // crater: flat floor + small rim
      g[r * W + c] += v; } }
  m.hz = hz; m.hgt = g; return m;
}
export function hAt(m, x, y) { const g = m.hgt; if (!g) return 0; const c = (x / CELL) | 0, r = (y / CELL) | 0; if (c < 0 || r < 0 || c >= m.w || r >= m.h) return 0; return g[r * m.w + c]; }
// slope speed factor along heading a: uphill slower, downhill a bit faster
export function slopeK(m, x, y, a, dir) { if (!m.hgt) return 1; const s = (hAt(m, x + Math.cos(a) * 10 * dir, y + Math.sin(a) * 10 * dir) - hAt(m, x, y)) / 10; return Math.max(0.6, Math.min(1.18, 1 - s * 1.5)); }
// crest between two points higher than both ends (+tolerance) → no line of fire / sight
export function crestBlocks(m, x0, y0, x1, y1) { if (!m.hgt) return false; const h0 = hAt(m, x0, y0), h1 = hAt(m, x1, y1), top = Math.max(h0, h1) + 8; for (let k = 1; k < 4; k++) { const f = k / 4; if (hAt(m, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f) > top) return true; } return false; }
