// r18: realistic MBT art. Each tank look (palette, class, kit, turret, weapon) is painted once at high resolution into an
// offscreen sprite — hull+tracks, turret, barrel and a blurred contact shadow — and then blitted every frame. Painting is
// procedural: facet lighting (top light + slope falloff), panel lines, ambient occlusion, edge wear, camo and dirt masks.
// Local units: x forward, y right; 1 unit = 1 sim px before TANK_VIS scaling.
const S = 12; // sprite pixels per unit
const cache = new Map(); const MAXC = 160;
const rgb = (c) => { if (Array.isArray(c)) return c; if (typeof c !== 'string') return [90, 96, 70]; if (c[0] === '#') { const n = parseInt(c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; } const m = c.match(/(\d+)\D+(\d+)\D+(\d+)/); return m ? [+m[1], +m[2], +m[3]] : [90, 96, 70]; };
const css = (a, k = 1, al) => { const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return al == null ? 'rgb(' + f(a[0]) + ',' + f(a[1]) + ',' + f(a[2]) + ')' : 'rgba(' + f(a[0]) + ',' + f(a[1]) + ',' + f(a[2]) + ',' + al + ')'; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); }
function vnoise(seed) { const r = rng(seed), P = new Float32Array(256); for (let i = 0; i < 256; i++) P[i] = r(); const at = (x, y) => P[((x & 15) * 16 + (y & 15)) & 255];
  const sm = (t) => t * t * (3 - 2 * t); return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi); const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; }; }
function mk(wu, hu) { const c = document.createElement('canvas'); c.width = Math.ceil(wu * S); c.height = Math.ceil(hu * S); const g = c.getContext('2d'); return { c, g }; }
const poly = (g, P) => { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
// facet: fill polygon with base colour lit by slope k (1 = flat deck facing the sun)
function facet(g, P, base, k, grad) { poly(g, P); if (grad) { const [x0, y0, x1, y1] = grad, G = g.createLinearGradient(x0, y0, x1, y1); G.addColorStop(0, css(base, k * 1.06)); G.addColorStop(1, css(base, k * 0.9)); g.fillStyle = G; } else g.fillStyle = css(base, k); g.fill(); }
function edge(g, P, al = 0.35, w = 0.18) { poly(g, P); g.strokeStyle = 'rgba(12,12,10,' + al + ')'; g.lineWidth = w; g.stroke(); }
function wearEdge(g, a, b, r, al = 0.32) { g.strokeStyle = 'rgba(200,196,178,' + al + ')'; g.lineWidth = 0.12; g.beginPath(); const n = 8; for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; if (r() < 0.55) { g.moveTo(x, y); g.lineTo(x + (b[0] - a[0]) / n * 0.6, y + (b[1] - a[1]) / n * 0.6); } } g.stroke(); }
// camo + grime over the current clip
function paintSurface(g, x0, y0, w, h, pal, camo, seed, dirt) {
  const n1 = vnoise(seed), n2 = vnoise(seed + 7), r = rng(seed + 3), base = pal.body;
  if (camo) { const C = camo === 2 ? [mix(base, [40, 36, 28], 0.55), mix(base, [150, 130, 95], 0.35)] : [mix(base, [30, 34, 22], 0.5), mix(base, [120, 105, 72], 0.4)];
    const st = 0.5; for (let y = y0; y < y0 + h; y += st) for (let x = x0; x < x0 + w; x += st) { const v = n1(x * 0.22, y * 0.22) * 0.7 + n2(x * 0.5, y * 0.5) * 0.3; if (v > 0.64) { g.fillStyle = css(C[0], 1, 0.85); g.fillRect(x, y, st + 0.05, st + 0.05); } else if (v < 0.3) { g.fillStyle = css(C[1], 1, 0.7); g.fillRect(x, y, st + 0.05, st + 0.05); } } }
  // fine paint grain
  for (let i = 0; i < w * h * 1.6; i++) { const x = x0 + r() * w, y = y0 + r() * h; g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,240,0.05)'; g.fillRect(x, y, 0.22, 0.22); }
  // dust / mud: heavier towards the sides and rear
  const st = 0.45; for (let y = y0; y < y0 + h; y += st) for (let x = x0; x < x0 + w; x += st) { const side = Math.abs((y - (y0 + h / 2)) / (h / 2)), rear = Math.max(0, -(x - (x0 + w * 0.3)) / w); const v = n2(x * 0.7 + 9, y * 0.7) * 0.6 + side * 0.35 + rear * 0.3 - 0.55 + dirt * 0.25;
    if (v > 0) { g.fillStyle = 'rgba(92,74,48,' + Math.min(0.45, v * 0.9) + ')'; g.fillRect(x, y, st + 0.05, st + 0.05); } }
}
function hullSpec(cls) { return cls === 'H' ? { L: 19.6, W: 11.4, tw: 2.3 } : cls === 'L' ? { L: 16.4, W: 9.6, tw: 1.9 } : { L: 18.2, W: 10.6, tw: 2.15 }; }
export function tankDims(cls) { const h = hullSpec(cls); return h; }
function buildHull(key, pal, cls, kit, camo, seed) {
  const { L, W, tw } = hullSpec(cls), M = 1.6, cw = L + M * 2, ch = W + M * 2, { c, g } = mk(cw, ch); g.scale(S, S); g.translate(cw / 2, ch / 2);
  const hx = L / 2, hy = W / 2, r = rng(seed), base = pal.body;
  // tracks: links with guide horns, visible at both ends and between skirt gaps
  g.fillStyle = '#1b1c1b'; g.fillRect(-hx, -hy, L, tw); g.fillRect(-hx, hy - tw, L, tw);
  for (const sd of [-1, 1]) { const y0 = sd < 0 ? -hy : hy - tw; for (let x = -hx; x < hx; x += 0.62) { g.fillStyle = '#2c2d2b'; g.fillRect(x, y0 + 0.08, 0.42, tw - 0.16); g.fillStyle = '#3d3e3a'; g.fillRect(x + 0.05, y0 + 0.1, 0.12, tw - 0.2); g.fillStyle = 'rgba(80,66,46,0.35)'; g.fillRect(x, y0 + tw * 0.35, 0.42, tw * 0.3); }
    // sprocket (rear) and idler (front)
    for (const ex of [-hx + 0.9, hx - 0.9]) { const G = g.createRadialGradient(ex - 0.2, y0 + tw / 2 - 0.2, 0.1, ex, y0 + tw / 2, 1.05); G.addColorStop(0, '#5a5c57'); G.addColorStop(1, '#232422'); g.fillStyle = G; g.beginPath(); g.arc(ex, y0 + tw / 2, 1.0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#151615'; g.beginPath(); g.arc(ex, y0 + tw / 2, 0.32, 0, Math.PI * 2); g.fill(); } }
  // side skirts: segmented armour plates over the tracks, rubber flaps at the front
  const sx0 = -hx + 1.7, sx1 = hx - 1.5;
  for (const sd of [-1, 1]) { const y0 = sd < 0 ? -hy - 0.05 : hy - tw - 0.05, segs = cls === 'L' ? 5 : 6, sl = (sx1 - sx0) / segs;
    for (let i = 0; i < segs; i++) { const x = sx0 + i * sl, front = i === segs - 1, k = kit === 2 ? 0.96 : 0.92; const P = [[x + 0.04, y0], [x + sl - 0.04, y0], [x + sl - 0.04, y0 + tw + 0.1], [x + 0.04, y0 + tw + 0.1]];
      facet(g, P, front && kit === 1 ? mix(base, [70, 72, 60], 0.25) : base, k, [x, y0 + (sd < 0 ? 0 : tw), x, y0 + (sd < 0 ? tw : 0)]); edge(g, P, 0.45, 0.1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + 0.35, y0 + tw / 2, 0.08, 0, 7); g.arc(x + sl - 0.35, y0 + tw / 2, 0.08, 0, 7); g.fill(); // bolts
      if (kit === 1) { g.fillStyle = css(mix(base, [60, 62, 52], 0.2), 0.86); for (let q = 0; q < 2; q++) { const bx = x + 0.12 + q * (sl / 2), P2 = [[bx, y0 + 0.15], [bx + sl / 2 - 0.2, y0 + 0.15], [bx + sl / 2 - 0.2, y0 + tw - 0.05], [bx, y0 + tw - 0.05]]; facet(g, P2, mix(base, [64, 66, 54], 0.22), 0.95); edge(g, P2, 0.5, 0.08); } } }
    if (kit === 3) { g.strokeStyle = 'rgba(28,28,26,0.85)'; g.lineWidth = 0.14; for (let x = -hx + 0.4; x < -hx + 4.2; x += 0.45) { g.beginPath(); g.moveTo(x, y0 - 0.25); g.lineTo(x, y0 + tw + 0.3); g.stroke(); } } }
  // hull top between the skirts: rear engine deck, mid fighting compartment, sloped upper glacis
  const iy = hy - tw + 0.05, gx = hx - 3.2; // glacis break line
  const deck = [[-hx + 0.3, -iy], [gx, -iy], [gx, iy], [-hx + 0.3, iy]];
  facet(g, deck, base, 1.0, [0, -iy, 0, iy]);
  const glacis = [[gx, -iy], [hx - 0.15, -iy + 0.5], [hx - 0.15, iy - 0.5], [gx, iy]]; facet(g, glacis, base, 0.84, [gx, 0, hx, 0]); edge(g, glacis, 0.4);
  // fenders over the track tops in front / rear of the skirts
  for (const sd of [-1, 1]) { const y0 = sd < 0 ? -hy : hy - tw; facet(g, [[hx - 1.5, y0], [hx - 0.1, y0 + (sd < 0 ? 0.3 : 0)], [hx - 0.1, y0 + tw - (sd > 0 ? 0.3 : 0)], [hx - 1.5, y0 + tw]], base, 0.8); facet(g, [[-hx, y0], [-hx + 1.7, y0], [-hx + 1.7, y0 + tw], [-hx, y0 + tw]], base, 0.86); }
  g.save(); poly(g, deck); g.clip(); paintSurface(g, -hx, -hy, L, W, pal, camo, seed, 0.6);
  // engine deck: louvred grilles, access panels, exhaust on the left rear
  for (let k = 0; k < 2; k++) { const gx0 = -hx + 0.7 + k * 2.4; g.fillStyle = 'rgba(16,16,14,0.75)'; g.fillRect(gx0, -iy + 0.6, 2.0, 2 * iy - 1.2); g.fillStyle = 'rgba(150,150,135,0.28)'; for (let y = -iy + 0.75; y < iy - 0.6; y += 0.34) g.fillRect(gx0 + 0.1, y, 1.8, 0.1); }
  g.fillStyle = 'rgba(30,26,22,0.8)'; g.fillRect(-hx + 0.35, -iy + 0.1, 1.2, 0.6); g.fillStyle = 'rgba(70,50,30,0.5)'; g.fillRect(-hx + 0.35, -iy + 0.05, 1.6, 0.2);
  g.strokeStyle = 'rgba(10,10,8,0.4)'; g.lineWidth = 0.1; g.strokeRect(-hx + 0.5, -iy + 0.4, 5.2, 2 * iy - 0.8); g.beginPath(); g.moveTo(-hx + 5.9, -iy); g.lineTo(-hx + 5.9, iy); g.stroke();
  g.restore();
  // AO where the turret ring sits and along the skirts
  { const G = g.createRadialGradient(0.6, 0, 1, 0.6, 0, 4.8); G.addColorStop(0, 'rgba(0,0,0,0.38)'); G.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = G; g.beginPath(); g.arc(0.6, 0, 4.8, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-hx + 0.3, -iy, L - 0.4, 0.22); g.fillRect(-hx + 0.3, iy - 0.22, L - 0.4, 0.22);
  // driver hatch + periscopes, headlights with guards, tow hooks, stowage, tow cable
  g.fillStyle = css(base, 0.78); g.beginPath(); g.ellipse(gx - 0.3, -0.9, 0.75, 0.65, 0, 0, 7); g.fill(); edge(g, [[gx - 1, -1.5], [gx + 0.4, -1.5], [gx + 0.4, -0.3], [gx - 1, -0.3]], 0.0);
  g.fillStyle = 'rgba(40,60,70,0.85)'; for (let k = -1; k <= 1; k++) g.fillRect(gx + 0.2, -0.95 + k * 0.42 - 0.12, 0.3, 0.24);
  for (const sd of [-1, 1]) { g.fillStyle = '#20211f'; g.fillRect(hx - 0.9, sd * (iy - 0.55) - 0.3, 0.55, 0.6); g.fillStyle = 'rgba(220,215,170,0.55)'; g.fillRect(hx - 0.55, sd * (iy - 0.55) - 0.2, 0.2, 0.4);
    g.fillStyle = css(base, 0.72); g.fillRect(-hx + 6.3, sd * (iy - 0.75) - 0.5, 2.4, 1.0); edge(g, [[-hx + 6.3, sd * (iy - 0.75) - 0.5], [-hx + 8.7, sd * (iy - 0.75) - 0.5], [-hx + 8.7, sd * (iy - 0.75) + 0.5], [-hx + 6.3, sd * (iy - 0.75) + 0.5]], 0.45, 0.08); }
  g.strokeStyle = 'rgba(25,25,22,0.8)'; g.lineWidth = 0.16; g.beginPath(); g.moveTo(hx - 0.4, -iy + 1); g.bezierCurveTo(gx - 1, -iy + 0.4, gx - 3, -iy + 0.5, -hx + 6.2, -iy + 0.4); g.stroke();
  if (kit === 4) { for (let k = 0; k < 5; k++) { const G = g.createRadialGradient(hx - 1.6, -iy + 0.8 + k * 1.6, 0.1, hx - 1.6, -iy + 0.8 + k * 1.6, 0.9); G.addColorStop(0, '#9a8a62'); G.addColorStop(1, '#5c5036'); g.fillStyle = G; g.beginPath(); g.ellipse(hx - 1.6, -iy + 0.9 + k * 1.6, 0.9, 0.7, 0, 0, 7); g.fill(); } }
  if (kit === 1) { for (let y = -iy + 0.3; y < iy - 0.6; y += 1.15) { const P = [[gx + 0.3, y], [gx + 2.3, y + 0.1], [gx + 2.3, y + 0.95], [gx + 0.3, y + 0.95]]; facet(g, P, mix(base, [70, 72, 60], 0.2), 0.8); edge(g, P, 0.55, 0.08); } }
  wearEdge(g, [gx, -iy], [gx, iy], r); wearEdge(g, [hx - 0.15, -iy + 0.5], [hx - 0.15, iy - 0.5], r, 0.4); wearEdge(g, [-hx + 0.3, -iy], [gx, -iy], r, 0.2); wearEdge(g, [-hx + 0.3, iy], [gx, iy], r, 0.2);
  edge(g, [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]], 0.0);
  return { c, ox: cw / 2, oy: ch / 2, w: cw, h: ch, L, W };
}
// turret types: 0 modern wedge (Leopard 2A6-like), 1 cast rounded + ERA (T-90-like), 2 flat angular (Abrams-like), 3 compact, 4 long bustle, 5 low dome
function turretShape(tt, cls) { const k = cls === 'H' ? 1.1 : cls === 'L' ? 0.88 : 1;
  const P = [
    [[5.2, 0], [3.9, -3.3], [-3.2, -3.7], [-4.6, -3.0], [-4.6, 3.0], [-3.2, 3.7], [3.9, 3.3]],
    [[4.0, -1.6], [2.6, -3.5], [-1.2, -3.9], [-3.8, -2.6], [-4.3, 0], [-3.8, 2.6], [-1.2, 3.9], [2.6, 3.5], [4.0, 1.6]],
    [[4.6, -1.2], [3.8, -3.7], [-3.8, -3.9], [-5.2, -2.6], [-5.2, 2.6], [-3.8, 3.9], [3.8, 3.7], [4.6, 1.2]],
    [[3.6, -2.0], [2.6, -3.1], [-2.8, -3.2], [-3.6, -2.0], [-3.6, 2.0], [-2.8, 3.2], [2.6, 3.1], [3.6, 2.0]],
    [[4.2, -1.8], [3.2, -3.4], [-3.5, -3.4], [-6.2, -2.4], [-6.2, 2.4], [-3.5, 3.4], [3.2, 3.4], [4.2, 1.8]],
    [[3.8, -1.4], [2.2, -3.3], [-1.6, -3.7], [-3.6, -2.2], [-3.6, 2.2], [-1.6, 3.7], [2.2, 3.3], [3.8, 1.4]]][tt % 6];
  return P.map(p => [p[0] * k, p[1] * k]); }
function buildTurret(key, pal, cls, tt, w, camo, seed) {
  const P = turretShape(tt, cls), M = 2.4, xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs) - M, x1 = Math.max(...xs) + M, y0 = Math.min(...ys) - M, y1 = Math.max(...ys) + M;
  const { c, g } = mk(x1 - x0, y1 - y0); g.scale(S, S); g.translate(-x0, -y0); const base = pal.body, r = rng(seed + 11);
  // bustle rack / stowage basket at the rear
  const bx = Math.min(...xs); g.strokeStyle = 'rgba(25,25,22,0.9)'; g.lineWidth = 0.14; g.strokeRect(bx - 1.6, -2.6, 1.8, 5.2); for (let y = -2.4; y < 2.6; y += 0.6) { g.beginPath(); g.moveTo(bx - 1.6, y); g.lineTo(bx + 0.2, y); g.stroke(); }
  g.fillStyle = 'rgba(70,64,46,0.9)'; g.fillRect(bx - 1.4, -2.2, 1.2, 1.7); g.fillStyle = 'rgba(55,60,40,0.9)'; g.beginPath(); g.ellipse(bx - 0.8, 1.2, 0.7, 1.0, 0, 0, 7); g.fill();
  // main facets: split along the centre for a ridge + darker sloped cheeks
  facet(g, P, base, 1.0, [0, y0, 0, y1]);
  const front = P.filter(p => p[0] > 1.5); if (front.length >= 2) { const cheek = [[1.6, P[1][1] * 0.95], ...P.filter(p => p[0] > 1.5 && p[1] < 0), ...P.filter(p => p[0] > 1.5 && p[1] >= 0), [1.6, -P[1][1] * 0.95]]; }
  g.save(); poly(g, P); g.clip(); paintSurface(g, x0, y0, x1 - x0, y1 - y0, pal, camo, seed + 5, 0.25);
  // sloped cheek shading: darker towards the front and outer edges
  const G = g.createLinearGradient(-4, 0, 5.5, 0); G.addColorStop(0, 'rgba(0,0,0,0)'); G.addColorStop(0.6, 'rgba(0,0,0,0)'); G.addColorStop(1, 'rgba(0,0,0,0.28)'); g.fillStyle = G; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const G2 = g.createLinearGradient(0, y0 + 1.5, 0, y1 - 1.5); G2.addColorStop(0, 'rgba(0,0,0,0.22)'); G2.addColorStop(0.25, 'rgba(255,255,240,0.05)'); G2.addColorStop(0.5, 'rgba(255,255,240,0.08)'); G2.addColorStop(0.75, 'rgba(0,0,0,0.02)'); G2.addColorStop(1, 'rgba(0,0,0,0.26)'); g.fillStyle = G2; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (tt === 1) { // ERA «Kontakt»-style blocks on the front arc
    for (let k = -3; k <= 3; k++) { if (!k) continue; const a = k * 0.36, rr = 3.5, cx = Math.cos(a) * rr * 0.92 + 0.2, cy = Math.sin(a) * rr; g.save(); g.translate(cx, cy); g.rotate(a); facet(g, [[-0.45, -0.5], [0.45, -0.5], [0.45, 0.5], [-0.45, 0.5]], mix(base, [72, 74, 62], 0.2), 0.88); edge(g, [[-0.45, -0.5], [0.45, -0.5], [0.45, 0.5], [-0.45, 0.5]], 0.6, 0.08); g.restore(); } }
  g.restore(); edge(g, P, 0.55, 0.14);
  for (let i = 0; i < P.length; i++) wearEdge(g, P[i], P[(i + 1) % P.length], r, 0.28);
  // gun mantlet
  const mx = Math.max(...xs) - 0.4; facet(g, [[mx - 1.6, -1.2], [mx + 0.6, -0.95], [mx + 0.6, 0.95], [mx - 1.6, 1.2]], base, 0.78, [mx - 1.6, 0, mx + 0.6, 0]); edge(g, [[mx - 1.6, -1.2], [mx + 0.6, -0.95], [mx + 0.6, 0.95], [mx - 1.6, 1.2]], 0.6, 0.1);
  // commander cupola (right) with periscopes, loader hatch (left), gunner's sight box, CITV
  const cx = -1.2, cy = 1.5; { const G3 = g.createRadialGradient(cx - 0.3, cy - 0.3, 0.1, cx, cy, 1.25); G3.addColorStop(0, css(base, 1.08)); G3.addColorStop(1, css(base, 0.62)); g.fillStyle = G3; g.beginPath(); g.arc(cx, cy, 1.2, 0, 7); g.fill(); g.strokeStyle = 'rgba(10,10,8,0.6)'; g.lineWidth = 0.1; g.stroke();
    g.fillStyle = 'rgba(40,62,72,0.9)'; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; g.fillRect(cx + Math.cos(a) * 1.0 - 0.12, cy + Math.sin(a) * 1.0 - 0.12, 0.24, 0.24); } g.fillStyle = css(base, 0.7); g.beginPath(); g.arc(cx, cy, 0.62, 0, 7); g.fill(); }
  g.fillStyle = css(base, 0.8); g.beginPath(); g.ellipse(-1.0, -1.6, 0.85, 0.75, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(10,10,8,0.5)'; g.lineWidth = 0.08; g.stroke();
  facet(g, [[1.4, -2.6], [2.6, -2.6], [2.6, -1.6], [1.4, -1.6]], mix(base, [50, 52, 48], 0.2), 0.85); g.fillStyle = 'rgba(60,90,110,0.9)'; g.fillRect(2.35, -2.45, 0.22, 0.7);
  if (cls !== 'L') { g.fillStyle = '#2a2c2a'; g.fillRect(-0.4, 2.4, 1.0, 0.9); g.fillStyle = 'rgba(70,100,120,0.9)'; g.fillRect(0.45, 2.55, 0.15, 0.6); }
  // roof MG on the loader's ring
  g.fillStyle = '#1c1d1c'; g.fillRect(-1.2, -1.75, 3.0, 0.22); g.fillRect(-1.4, -1.95, 0.8, 0.6);
  // smoke grenade launchers (4 tubes per side)
  for (const sd of [-1, 1]) { const yy = sd * (Math.max(...ys) - 0.45); for (let k = 0; k < 4; k++) { const G4 = g.createRadialGradient(0.6 + k * 0.5, yy, 0.02, 0.6 + k * 0.5, yy, 0.25); G4.addColorStop(0, '#0e0f0e'); G4.addColorStop(1, css(base, 0.6)); g.fillStyle = G4; g.beginPath(); g.arc(0.6 + k * 0.5, yy + sd * 0.05, 0.22, 0, 7); g.fill(); } }
  // antennas (bases + whip shadow lines)
  g.fillStyle = '#1a1b1a'; g.beginPath(); g.arc(bx + 0.6, -2.4, 0.22, 0, 7); g.arc(bx + 0.6, 2.4, 0.22, 0, 7); g.fill(); g.strokeStyle = 'rgba(15,15,14,0.55)'; g.lineWidth = 0.07; g.beginPath(); g.moveTo(bx + 0.6, -2.4); g.lineTo(bx - 1.9, -3.4); g.moveTo(bx + 0.6, 2.4); g.lineTo(bx - 2.3, 3.0); g.stroke();
  // weapon-specific turret kit (muted, realistic)
  if (w === 'rocket' || w === 'salvo' || w === 'homing') { const yy = -(Math.max(...ys) + 0.2); facet(g, [[-2.2, yy - 1.3], [2.8, yy - 1.3], [2.8, yy + 0.4], [-2.2, yy + 0.4]], mix(base, [50, 54, 46], 0.3), 0.86); edge(g, [[-2.2, yy - 1.3], [2.8, yy - 1.3], [2.8, yy + 0.4], [-2.2, yy + 0.4]], 0.6, 0.1); g.fillStyle = '#121312'; for (let k = 0; k < (w === 'salvo' ? 4 : 2); k++) { g.beginPath(); g.arc(2.5, yy - 1.0 + k * (w === 'salvo' ? 0.36 : 0.7), 0.16, 0, 7); g.fill(); } }
  if (w === 'mg') { facet(g, [[0.6, -0.9], [2.4, -0.9], [2.4, 0.9], [0.6, 0.9]], [52, 54, 50], 0.9); }
  if (w === 'flame') { g.fillStyle = '#3a3a34'; g.beginPath(); g.ellipse(bx + 0.4, 0, 0.9, 1.9, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.08; g.stroke(); }
  if (w === 'emp' || w === 'laser') { g.fillStyle = '#2a2d2e'; g.beginPath(); g.arc(-2.4, 0, 1.0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,140,150,0.5)'; g.lineWidth = 0.1; for (let k = 0.3; k < 1; k += 0.3) { g.beginPath(); g.arc(-2.4, 0, k, 0, 7); g.stroke(); } }
  return { c, ox: -x0, oy: -y0, w: x1 - x0, h: y1 - y0, front: Math.max(...xs) };
}
// barrel: cylindrical shading, thermal sleeve bands, fume extractor, muzzle brake / reference sensor
function buildBarrel(key, w, len, bar) {
  const R = w === 'heavy' || w === 'mortar' ? 0.62 : w === 'mg' ? 0.26 : w === 'shotgun' ? 0.7 : w === 'flame' ? 0.5 : 0.46, L = len, { c, g } = mk(L + 1, 3); g.scale(S, S); g.translate(0, 1.5);
  const tube = (x0, x1, rr, k = 1) => { const G = g.createLinearGradient(0, -rr, 0, rr); G.addColorStop(0, css([70, 72, 66], 0.8 * k)); G.addColorStop(0.32, css([125, 128, 116], k)); G.addColorStop(0.55, css([70, 72, 66], k)); G.addColorStop(1, css([22, 23, 22], k)); g.fillStyle = G; g.fillRect(x0, -rr, x1 - x0, rr * 2); };
  if (w === 'twin') { for (const sd of [-0.55, 0.55]) { g.save(); g.translate(0, sd); tube(0, L * 0.85, 0.3); g.restore(); } return { c, ox: 0, oy: 1.5, w: L + 1, h: 3 }; }
  tube(0, L, R); // thermal sleeve segments
  g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 1.2; x < L - 1.5; x += L / 4.2) g.fillRect(x, -R, 0.12, R * 2);
  if (w === 'cannon' || w === 'heavy' || w === 'rail' || w === 'ricochet') { const fx = L * (bar === 2 ? 0.45 : 0.55); tube(fx - 0.9, fx + 0.9, R * 1.45, 0.95); }
  if (w === 'cannon' || w === 'heavy') { tube(L - 0.9, L, R * (bar === 1 ? 1.25 : 1.12), 0.85); g.fillStyle = '#0b0b0a'; g.fillRect(L - 0.08, -R * 0.55, 0.08, R * 1.1); }
  if (w === 'shotgun') { tube(L - 1.2, L, R * 1.2, 0.8); }
  if (w === 'flame') { tube(L - 0.8, L, R * 1.35, 0.7); g.fillStyle = 'rgba(160,70,20,0.6)'; g.fillRect(L - 0.2, -R, 0.2, R * 2); }
  if (w === 'rail') { g.fillStyle = '#3c3e44'; g.fillRect(1, -R - 0.25, L - 1.5, 0.22); g.fillRect(1, R + 0.03, L - 1.5, 0.22); }
  if (w === 'laser' || w === 'emp') { tube(L - 1.4, L, R * 1.5, 0.75); g.fillStyle = w === 'emp' ? 'rgba(90,180,200,0.6)' : 'rgba(200,80,80,0.55)'; g.fillRect(L - 0.25, -R * 0.9, 0.25, R * 1.8); }
  return { c, ox: 0, oy: 1.5, w: L + 1, h: 3 };
}
function shadowOf(sp) { // blurred silhouette, cached alongside the sprite
  const pad = 1.6, cw = Math.ceil((sp.w + pad * 2) * S), ch = Math.ceil((sp.h + pad * 2) * S), c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
  try { g.filter = 'blur(' + Math.round(S * 0.5) + 'px)'; } catch (e) {} g.drawImage(sp.c, pad * S, pad * S); g.filter = 'none'; g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(8,10,6,0.62)'; g.fillRect(0, 0, cw, ch);
  return { c, ox: sp.ox + pad, oy: sp.oy + pad, w: sp.w + pad * 2, h: sp.h + pad * 2 }; }
function get(key, fn) { let v = cache.get(key); if (v) { cache.delete(key); cache.set(key, v); return v; } v = fn(); v.sh = shadowOf(v); cache.set(key, v); if (cache.size > MAXC) cache.delete(cache.keys().next().value); return v; }
const blit = (g, sp, x = 0, y = 0) => g.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h);
// public: draw a tank in local units at the current transform (already translated to the tank and scaled by TANK_VIS)
export function drawMBT(g, t, look, rc) {
  const { pal, cls, kit, camo, tt, bar } = look, w = t.weapon || 'cannon', seed = (look.seed | 0) % 6;
  const pk = (pal.body | 0) + ',' + pal.body.join(',');
  const hull = get('h|' + pk + '|' + cls + kit + camo + seed, () => buildHull(0, pal, cls, kit, camo, seed + 1));
  const tur = get('t|' + pk + '|' + cls + tt + w + camo + seed, () => buildTurret(0, pal, cls, tt, w, camo, seed + 1));
  const bl = w === 'mortar' ? 6 : w === 'rail' ? 14 : w === 'mg' ? 8 : (cls === 'H' ? 13 : cls === 'L' ? 10.5 : 12) + (bar === 1 ? 1.5 : 0);
  const brl = get('b|' + w + bl + bar, () => buildBarrel(0, w, bl, bar));
  const a = t.a || 0, ta = t.ta ?? a;
  // contact shadows (sun from the north-west: shadow falls south-east, in world space)
  g.save(); g.translate(1.5, 2.0); g.rotate(a); blit(g, hull.sh); g.restore();
  g.save(); g.translate(2.6, 3.2); g.rotate(ta); blit(g, tur.sh); g.save(); g.translate(tur.front - 0.6 + rc, 0); blit(g, brl.sh); g.restore(); g.restore();
  g.save(); g.rotate(a); blit(g, hull); g.restore();
  g.save(); g.rotate(ta); g.save(); g.translate(tur.front - 0.6 + rc, 0); blit(g, brl); g.restore(); blit(g, tur); g.restore();
  return { hull, tur };
}
export function lookOf(t, col, V, cls) {
  const pal = { body: rgb(col.body), dark: rgb(col.dark), light: rgb(col.light) };
  return { pal, cls, kit: V ? V.kit | 0 : (t.id % 3 === 0 ? 1 : 0), camo: V ? (V.camo ? 1 : 0) : (t.id % 2), tt: V ? V.tur | 0 : (cls === 'H' ? 2 : cls === 'L' ? 3 : 0), bar: V ? V.bar | 0 : 0, seed: t.id | 0 };
}
