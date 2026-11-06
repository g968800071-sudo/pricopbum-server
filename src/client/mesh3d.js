// r21: realistic MBT meshes for every camera. Parts (hull / turret / gun) are built once per visual key and cached as
// GPU buffers; per frame only a transform is sent. Vertex = local pos(3), normal(3), rgb(3), material(1), track param(1).
// Materials: 0 camo paint, 1 gun steel, 2 rubber, 3 glass, 4 plain paint, 5 emissive, 6 fabric, 7 bare metal, 8 track links.
export const VSTRIDE = 11;
const DIM = { H: [19.6, 11.4, 2.3], L: [16.4, 9.6, 1.9], M: [18.2, 10.6, 2.15] };
const nz = v => { const l = Math.hypot(v[0], v[1], v[2]); return l < 1e-9 ? [0, 0, 1] : [v[0] / l, v[1] / l, v[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const shc = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
export function X(tx = 0, ty = 0, tz = 0, rz = 0, ry = 0) { const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry);
  const r = (x, y, z) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1 * cz - y * sz, x1 * sz + y * cz, z1]; };
  return { p: (x, y, z) => { const q = r(x, y, z); return [q[0] + tx, q[1] + ty, q[2] + tz]; }, n: r }; }
const I = X();
const vt = (o, p, n, c, m, q = 0) => o.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], m, q);
// convex/fan polygon (already transformed points), normal from winding, flipped away from ctr when given
function face(o, P, c, m, ctr) { let n = nz(crs(sub(P[1], P[0]), sub(P[P.length - 1], P[0]))); if (P.length > 3) n = nz(crs(sub(P[2], P[0]), sub(P[3], P[1])));
  if (ctr) { let mx = 0, my = 0, mz = 0; for (const p of P) { mx += p[0]; my += p[1]; mz += p[2]; } const k = P.length; if ((mx / k - ctr[0]) * n[0] + (my / k - ctr[1]) * n[1] + (mz / k - ctr[2]) * n[2] < 0) n = [-n[0], -n[1], -n[2]]; }
  for (let i = 1; i + 1 < P.length; i++) { vt(o, P[0], n, c, m); vt(o, P[i], n, c, m); vt(o, P[i + 1], n, c, m); } }
// loft along +x: S = sections (each a CCW ring in (y,z), right half bottom->top then mirrored); smooth = averaged normals
function loft(o, T, S, c, m, smooth, caps = true) { const K = S[0].length, P = S.map(r => r.map(p => T.p(p[0], p[1], p[2])));
  const FN = []; for (let s = 0; s + 1 < S.length; s++) { const row = []; for (let i = 0; i < K; i++) { const j = (i + 1) % K, A = P[s][i], B = P[s][j], C = P[s + 1][j], D = P[s + 1][i]; row.push(nz(crs(sub(C, A), sub(D, B)))); } FN.push(row); }
  const VN = (s, i) => { let a = [0, 0, 0]; for (const ss of [s - 1, s]) if (ss >= 0 && ss < FN.length) for (const ii of [i, (i - 1 + K) % K]) { const f = FN[ss][ii]; a = [a[0] + f[0], a[1] + f[1], a[2] + f[2]]; } return nz(a); };
  for (let s = 0; s + 1 < S.length; s++) for (let i = 0; i < K; i++) { const j = (i + 1) % K, Q = [[s, i], [s, j], [s + 1, j], [s + 1, i]], A = Q.map(([a, b]) => P[a][b]);
    if (Math.hypot(...crs(sub(A[2], A[0]), sub(A[3], A[1]))) < 1e-7) continue;
    const N = smooth ? Q.map(([a, b]) => VN(a, b)) : Q.map(() => FN[s][i]); for (const k of [0, 1, 2, 0, 2, 3]) vt(o, A[k], N[k], c, m); }
  if (caps) for (const [s, sg] of [[0, -1], [S.length - 1, 1]]) { const r = P[s], h = K / 2, n = nz(T.n(sg, 0, 0)); for (let i = 0; i + 1 < h; i++) { const q = [r[i], r[i + 1], r[K - 2 - i], r[K - 1 - i]]; for (const k of [0, 1, 2, 0, 2, 3]) vt(o, q[k], n, c, m); } } }
const sym = (R, x) => { const r = R.map(([y, z]) => [x, y, z]); for (let i = R.length - 1; i >= 0; i--) r.push([x, -R[i][0], R[i][1]]); return r; };
// chamfered box
function bb(o, T, cx, cy, cz, hx, hy, hz, b, c, m = 0, ti = 0) { b = Math.min(b, 0.45 * Math.min(hx, hy, hz)); const ring = (k, x) => { const H = hy * k, Z = hz * k, B = b * k;
    return sym([[H - B, -Z], [H, -Z + B], [H * (1 - ti), Z - B], [H * (1 - ti) - B, Z]], x).map(p => [cx + p[0], cy + p[1], cz + p[2]]); };
  const ki = Math.max(0.2, 1 - b / Math.min(hy, hz)); loft(o, T, [ring(ki, -hx), ring(1, -hx + b), ring(1, hx - b), ring(ki, hx)], c, m, false); }
// cylinder p0->p1 with smooth radial normals
function cyl(o, T, p0, p1, r0, r1, n, c, m = 0, caps = true, capC) { const d = nz(sub(p1, p0)); let u = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; const v = nz(crs(d, u)); u = crs(v, d);
  const R = (p, r) => { const a = []; for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t), dir = [u[0] * ca + v[0] * sa, u[1] * ca + v[1] * sa, u[2] * ca + v[2] * sa]; a.push([T.p(p[0] + dir[0] * r, p[1] + dir[1] * r, p[2] + dir[2] * r), nz(T.n(...dir))]); } return a; };
  const A = R(p0, r0), B = R(p1, r1); for (let i = 0; i < n; i++) for (const [q, k] of [[A, i], [A, i + 1], [B, i + 1], [A, i], [B, i + 1], [B, i]]) vt(o, q[k][0], q[k][1], c, m);
  if (caps) { const cc = capC || shc(c, 0.85), C0 = T.p(...p0), C1 = T.p(...p1), n0 = nz(T.n(-d[0], -d[1], -d[2])), n1 = nz(T.n(...d)); for (let i = 0; i < n; i++) { vt(o, C0, n0, cc, m); vt(o, A[i + 1][0], n0, cc, m); vt(o, A[i][0], n0, cc, m); vt(o, C1, n1, cc, m); vt(o, B[i][0], n1, cc, m); vt(o, B[i + 1][0], n1, cc, m); } } }
function hull2(pts) { pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } up.pop(); lo.pop(); return lo.concat(up); }
// track belt around circles [x,z,r] at lateral centre yc, width tw, thickness tb
function belt(o, circ, yc, tw, tb) { const pts = []; for (const [x, z, r] of circ) for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
  const H = hull2(pts), K = H.length, NR = H.map((p, i) => { const a = H[(i - 1 + K) % K], b = H[(i + 1) % K], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dz / l, -dx / l]; });
  const Lc = [0]; for (let i = 1; i <= K; i++) Lc.push(Lc[i - 1] + Math.hypot(H[i % K][0] - H[i - 1][0], H[i % K][1] - H[i - 1][1]));
  const tc = [0.13, 0.125, 0.118], y0 = yc - tw / 2, y1 = yc + tw / 2;
  for (let i = 0; i < K; i++) { const j = (i + 1) % K, A = H[i], B = H[j], na = NR[i], nb = NR[j], ta = Lc[i], tb2 = Lc[i + 1];
    const oa = [A[0] + na[0] * tb, A[1] + na[1] * tb], ob = [B[0] + nb[0] * tb, B[1] + nb[1] * tb];
    const Q = (p, q, n1, n2, ya, yb) => { vt(o, [p[0], ya, p[1]], n1, tc, 8, ta); vt(o, [q[0], ya, q[1]], n2, tc, 8, tb2); vt(o, [q[0], yb, q[1]], n2, tc, 8, tb2); vt(o, [p[0], ya, p[1]], n1, tc, 8, ta); vt(o, [q[0], yb, q[1]], n2, tc, 8, tb2); vt(o, [p[0], yb, p[1]], n1, tc, 8, ta); };
    Q(oa, ob, [na[0], 0, na[1]], [nb[0], 0, nb[1]], y0, y1); Q(A, B, [-na[0], 0, -na[1]], [-nb[0], 0, -nb[1]], y0, y1);
    for (const [y, s] of [[y0, -1], [y1, 1]]) { const n = [0, s, 0], c = shc(tc, 0.8); vt(o, [A[0], y, A[1]], n, c, 8, ta); vt(o, [B[0], y, B[1]], n, c, 8, tb2); vt(o, [ob[0], y, ob[1]], n, c, 8, tb2); vt(o, [A[0], y, A[1]], n, c, 8, ta); vt(o, [ob[0], y, ob[1]], n, c, 8, tb2); vt(o, [oa[0], y, oa[1]], n, c, 8, ta); } } }
function wheel(o, x, z, r, yc, sd, tw, body, kind) { const yo = yc + sd * tw * 0.5, yi = yc - sd * tw * 0.5, rub = [0.07, 0.07, 0.066], st = [0.2, 0.2, 0.19];
  if (kind === 's') { cyl(o, I, [x, yi, z], [x, yo, z], r * 0.82, r * 0.82, 18, body, 0); for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2; bb(o, X(x + Math.cos(a) * r * 0.9, yc, z + Math.sin(a) * r * 0.9, 0, -a), 0, 0, 0, r * 0.16, tw * 0.32, r * 0.1, 0.02, st, 7); }
    cyl(o, I, [x, yo, z], [x, yo + sd * 0.15 * r, z], r * 0.42, r * 0.3, 12, st, 1); return; }
  for (const [a, b] of [[yc + sd * tw * 0.06, yo], [yi, yc - sd * tw * 0.06]]) { cyl(o, I, [x, a, z], [x, b, z], r, r, 18, rub, 2, false); cyl(o, I, [x, b, z], [x, b, z], r, r * 0.84, 18, rub, 2, false); }
  cyl(o, I, [x, yo, z], [x, yo - sd * 0.12 * r, z], r * 0.84, r * 0.5, 18, body, 0, false); cyl(o, I, [x, yo - sd * 0.12 * r, z], [x, yo - sd * 0.12 * r, z], r * 0.5, 0.001, 14, shc(body, 0.85), 0, false);
  cyl(o, I, [x, yo - sd * 0.12 * r, z], [x, yo + sd * 0.1 * r, z], r * 0.26, r * 0.2, 12, st, 7, true, [0.3, 0.3, 0.28]); }

function buildHull(o, m, D, u) { const L = D[0] * m.sx * u, W = D[1] * m.sy * u, tw = D[2] * m.sy * u * (m.tw || 1), hx = L / 2, hy = W / 2, body = m.body, dark = m.dark, st = [0.17, 0.17, 0.16];
  const rw = 0.78 * u, tb = 0.26 * u, wz = tb + rw, th = 2.35 * u, cls = m.cls, nw = m.nw || (cls === 'L' ? 6 : 7);
  for (const sd of [-1, 1]) { const yc = sd * (hy - tw / 2), C = [], xs = [];
    for (let i = 0; i < nw; i++) xs.push(-hx + 2.3 * u + i * (L - 4.7 * u) / (nw - 1));
    for (const x of xs) C.push([x, wz, rw]); C.push([hx - 1.05 * u, 1.35 * u, 0.72 * u], [-hx + 1.0 * u, 1.45 * u, 0.78 * u]);
    belt(o, C, yc, tw, tb); for (const x of xs) wheel(o, x, wz, rw, yc, sd, tw * 0.92, body);
    wheel(o, hx - 1.05 * u, 1.35 * u, 0.72 * u, yc, sd, tw * 0.9, body); wheel(o, -hx + 1.0 * u, 1.45 * u, 0.78 * u, yc, sd, tw * 0.9, body, 's');
    for (let i = 0; i < 3; i++) cyl(o, I, [-hx + 4 * u + i * L * 0.27, yc - tw * 0.3, 2.05 * u - 0.2 * u], [-hx + 4 * u + i * L * 0.27, yc + tw * 0.3, 1.85 * u], 0.18 * u, 0.18 * u, 10, st, 1);
    const ys = sd * (hy + 0.08 * u);
    if (cls !== 'L') { const s0 = -hx + 1.4 * u, s1 = hx - 0.5 * u, n = 6, sl = (s1 - s0) / n; for (let i = 0; i < n; i++) { const fr = i === n - 1, hzz = th * 0.32;
        bb(o, I, s0 + (i + 0.5) * sl, ys + (fr ? sd * 0.12 * u : 0), th - hzz + 0.12 * u, sl / 2 - 0.04 * u, (fr ? 0.24 : 0.09) * u, hzz, 0.06 * u, shc(body, fr ? 0.97 : 1), 0); }
      bb(o, I, (s0 + s1) / 2, ys, th * 0.3, (s1 - s0) / 2, 0.04 * u, th * 0.06, 0.01, [0.08, 0.08, 0.075], 2); }
    else { bb(o, I, 0.2 * u, ys, th - 0.15 * u, hx - 1.6 * u, 0.05 * u, 0.32 * u, 0.02 * u, [0.09, 0.09, 0.085], 2); bb(o, I, hx - 0.6 * u, ys, th * 0.75, 0.5 * u, 0.05 * u, 0.55 * u, 0.02 * u, [0.09, 0.09, 0.085], 2); } }
  // hull loft
  const hwL = hy - tw - 0.05 * u, zf = th + 0.05 * u, zt = th + 1.45 * u, zb = 0.95 * u, xg = hx - 4.8 * u * m.sx, hs = hy - 0.1 * u, ch = 0.4 * u;
  const top = x => x > xg ? zt + (th + 0.2 * u - zt) * (x - xg) / (hx - xg) : x < -hx + 0.7 * u ? zt - 0.4 * u * (-hx + 0.7 * u - x) / (0.7 * u) : zt;
  const bot = x => x > hx - 2.4 * u ? zb + (th * 0.62 - zb) * (x - (hx - 2.4 * u)) / (2.4 * u) : x < -hx + 1.5 * u ? zb + (th * 0.7 - zb) * ((-hx + 1.5 * u) - x) / (1.5 * u) : zb;
  const sec = x => { const t = top(x), stp = Math.max(zf + 0.01 * u, t - ch); return sym([[hwL, bot(x)], [hwL, zf], [hs, zf], [hs, stp], [hs - Math.min(ch, t - stp + 0.001), t]], x); };
  const XS = [-hx, -hx + 0.7 * u, -hx + 1.5 * u, -hx + 2.5 * u, xg, (xg + hx) / 2, hx - 2.4 * u, hx - 0.3 * u, hx].sort((a, b) => a - b);
  loft(o, I, XS.map(sec), body, 0, false);
  const ga = Math.atan2(zt - (th + 0.2 * u), hx - xg), gl = (x, y, z) => X(x, y, top(x) + z, 0, ga);
  // glacis details: driver hatch + periscopes, headlights with guards, tow hooks
  cyl(o, gl(xg + 0.9 * u, hy * 0.3, 0), [0, 0, 0], [0, 0, 0.14 * u], 0.62 * u, 0.58 * u, 16, shc(body, 0.95), 0);
  for (let k = -1; k <= 1; k++) bb(o, gl(xg + 1.75 * u, hy * 0.3 + k * 0.42 * u, 0.06 * u), 0, 0, 0, 0.12 * u, 0.16 * u, 0.1 * u, 0.02 * u, [0.05, 0.08, 0.1], 3);
  for (const sd of [-1, 1]) { const x = hx - 0.9 * u, y = sd * (hy - 0.9 * u), z = top(x) + 0.25 * u; bb(o, I, x, y, z, 0.3 * u, 0.38 * u, 0.24 * u, 0.06 * u, st, 1); bb(o, I, x + 0.31 * u, y, z, 0.02 * u, 0.3 * u, 0.17 * u, 0.01, [0.95, 0.9, 0.75], 5);
    cyl(o, I, [x + 0.45 * u, y - 0.45 * u, z - 0.25 * u], [x + 0.45 * u, y - 0.45 * u, z + 0.35 * u], 0.04 * u, 0.04 * u, 6, st, 1, false); cyl(o, I, [x + 0.45 * u, y + 0.45 * u, z - 0.25 * u], [x + 0.45 * u, y + 0.45 * u, z + 0.35 * u], 0.04 * u, 0.04 * u, 6, st, 1, false);
    cyl(o, I, [hx - 0.2 * u, sd * hwL * 0.6, th * 0.7], [hx + 0.25 * u, sd * hwL * 0.6, th * 0.7], 0.16 * u, 0.16 * u, 10, st, 7);
    // fender stowage bins, rear tail light, exhaust
    bb(o, I, -hx * 0.2, sd * (hs - 0.45 * u), zt + 0.35 * u, hx * 0.34, 0.42 * u, 0.35 * u, 0.08 * u, shc(body, 0.92), 0);
    bb(o, I, -hx + 0.02 * u, sd * (hs - 0.4 * u), zt - 0.5 * u, 0.06 * u, 0.22 * u, 0.12 * u, 0.02 * u, [0.8, 0.08, 0.05], 5); }
  bb(o, I, -hx + 0.05 * u, 0, zt - 0.9 * u, 0.1 * u, hwL * 0.7, 0.35 * u, 0.04 * u, [0.06, 0.06, 0.06], 1);
  // engine deck grilles
  for (let i = 0; i < 2; i++) { const x = -hx + 1.7 * u + i * 2.3 * u; bb(o, I, x, 0, zt + 0.03 * u, 0.95 * u, hy * 0.62, 0.06 * u, 0.02 * u, [0.08, 0.08, 0.075], 1); for (let k = -3; k <= 3; k++) bb(o, I, x, k * hy * 0.17, zt + 0.08 * u, 0.9 * u, 0.04 * u, 0.04 * u, 0.01, shc(body, 0.8), 0); }
  cyl(o, I, [-hx - 0.1 * u, -hwL * 0.9, zt - 0.3 * u], [-hx - 0.1 * u, hwL * 0.9, zt - 0.3 * u], 0.07 * u, 0.07 * u, 6, st, 7, false);
  if (cls === 'L') { for (const y of [-0.55, 0.55]) cyl(o, I, [-hx - 0.4 * u, y * hy - 0.9 * u, zt + 0.1 * u], [-hx - 0.4 * u, y * hy + 0.9 * u, zt + 0.1 * u], 0.55 * u, 0.55 * u, 16, shc(dark, 0.9), 0);
    for (let k = -2; k <= 2; k++) bb(o, gl(xg + 2.6 * u, k * 0.9 * u, 0.08 * u), 0, 0, 0, 0.3 * u, 0.4 * u, 0.07 * u, 0.03 * u, [0.13, 0.125, 0.118], 8); }
  if (m.kit) for (let r = 0; r < 2; r++) for (let k = -3; k <= 3; k++) if (k) bb(o, gl(xg + 1.3 * u + r * 1.3 * u, k * 0.82 * u, 0.12 * u), 0, 0, 0, 0.55 * u, 0.36 * u, 0.12 * u, 0.04 * u, shc(body, 0.9), 0);
  return { zt, hx, L }; }

function buildTurret(o, m, D, u, zt) { const body = m.body, dark = m.dark, st = [0.17, 0.17, 0.16], gls = [0.05, 0.08, 0.1], cls = m.cls, tl = m.tl, TS = tl ? tl.shape : 0;
  const tz0 = zt + 0.22 * u, Hh = (cls === 'H' ? 2.2 : 1.85) * u * (tl ? tl.h : 1), tz1 = tz0 + Hh, TLk = tl ? tl.s : 1;
  const TL = (cls === 'H' ? 9.4 : cls === 'L' ? 7.2 : 8.4) * u * m.sx * TLk, TW = (cls === 'H' ? 7.6 : cls === 'L' ? 5.8 : 6.8) * u * m.sy * TLk * (TS === 2 ? 1.1 : 1), f = TL * 0.5, b = -TL * 0.5, w2 = TW / 2;
  const tb = tl ? shc(body, 1.02 + (tl.tint || 0)) : body, c = 0.25 * u;
  cyl(o, I, [0, 0, zt - 0.05 * u], [0, 0, tz0 + 0.05 * u], w2 * 0.78, w2 * 0.74, 24, shc(body, 0.8), 0, false);
  const S = (x, w, roof, base = tz0, kt = 0.86) => sym([[w * 0.86, base], [w, base + 0.32 * (roof - base)], [w * kt, roof - c], [w * kt - c, roof]], x);
  let secs, smooth = false;
  if (TS === 4) { smooth = true; secs = []; const n = 10; for (let i = 0; i <= n; i++) { const x = b + (f - b) * i / n, e = Math.max(0.28, Math.sqrt(Math.max(0, 1 - ((x - (f + b) * 0.5 + TL * 0.05) / (TL * 0.56)) ** 2))), R = [];
      for (let k = 0; k <= 6; k++) { const a = -0.25 + k / 6 * (Math.PI / 2 + 0.25); R.push([w2 * e * Math.cos(a) * (k === 6 ? 0.02 : 1), tz0 + 0.1 * u + Hh * 1.05 * Math.pow(e, 0.6) * Math.max(0, Math.sin(Math.max(0, a)))]); } R[0][1] = tz0; secs.push(sym(R, x)); } }
  else if (TS === 1) secs = [S(b, w2 * 0.88, tz1 - 0.1 * u), S(b + TL * 0.3, w2, tz1), S(f * 0.15, w2, tz1), S(f * 0.5, w2 * 0.72, tz1 - Hh * 0.18, tz0 + Hh * 0.08), S(f * 0.9, w2 * 0.42, tz1 - Hh * 0.33, tz0 + Hh * 0.16), S(f * 1.25, w2 * 0.16, tz0 + Hh * 0.55, tz0 + Hh * 0.25)];
  else if (TS === 2) secs = [S(b, w2, tz1, tz0, 0.95), S(f - 0.4 * u, w2, tz1, tz0, 0.95), S(f, w2 * 0.92, tz1 - 0.3 * u, tz0 + 0.2 * u, 0.95)];
  else if (TS === 3) secs = [S(b, w2 * 0.85, tz1 - 0.15 * u, tz0, 0.72), S(b * 0.4, w2, tz1, tz0, 0.72), S(f * 0.1, w2, tz1 - Hh * 0.05, tz0, 0.72), S(f * 0.6, w2 * 0.62, tz0 + Hh * 0.6, tz0 + Hh * 0.08, 0.7), S(f * 1.05, w2 * 0.3, tz0 + Hh * 0.32, tz0 + Hh * 0.15, 0.7)];
  else secs = [S(b - 0.2 * u, w2 * 0.86, tz1 - 0.12 * u), S(b + TL * 0.3, w2 * 0.98, tz1), S(f * 0.1, w2, tz1), S(f * 0.75, w2 * 0.8, tz1 - Hh * 0.15), S(f, w2 * 0.7, tz1 - Hh * 0.25, tz0 + Hh * 0.05), S(f + 0.35 * u, w2 * 0.6, tz1 - Hh * 0.38, tz0 + Hh * 0.18)];
  loft(o, I, secs, tb, 0, smooth);
  const mz = tz0 + Hh * 0.48;
  if (TS === 4) for (const sd of [-1, 1]) bb(o, X(f * 0.5, sd * w2 * 0.52, tz0 + Hh * 0.5, sd * 0.45), 0, 0, 0, f * 0.42, 0.5 * u, Hh * 0.4, 0.1 * u, shc(tb, 0.95), 0, 0.15);
  bb(o, I, f + (TS === 4 ? 0.1 : 0.45) * u, 0, mz, 0.5 * u, (TS === 4 ? 0.8 : 1.05) * u, Hh * 0.34, 0.15 * u, shc(tb, 0.92), 0);
  const rf = tz1 - (TS === 4 ? 0.15 * u : 0);
  // sights, cupola with vision blocks, hatch, roof MG, smoke dischargers, antennas, wind sensor
  bb(o, I, f * 0.35, w2 * 0.5, rf + 0.35 * u, 0.55 * u, 0.42 * u, 0.36 * u, 0.08 * u, shc(tb, 0.95), 0); bb(o, I, f * 0.35 + 0.56 * u, w2 * 0.5, rf + 0.4 * u, 0.02 * u, 0.3 * u, 0.2 * u, 0.01, gls, 3);
  const cx = b * 0.2, cy = -w2 * 0.45; cyl(o, I, [cx, cy, rf - 0.1 * u], [cx, cy, rf + 0.5 * u], 0.85 * u, 0.8 * u, 18, shc(tb, 0.97), 0, true);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; bb(o, X(cx + Math.cos(a) * 0.8 * u, cy + Math.sin(a) * 0.8 * u, rf + 0.32 * u, a), 0, 0, 0, 0.04 * u, 0.18 * u, 0.09 * u, 0.01, gls, 3); }
  cyl(o, I, [cx, cy, rf + 0.5 * u], [cx, cy, rf + 0.62 * u], 0.6 * u, 0.55 * u, 16, shc(tb, 0.9), 0);
  cyl(o, I, [b * 0.2, w2 * 0.42, rf], [b * 0.2, w2 * 0.42, rf + 0.12 * u], 0.6 * u, 0.56 * u, 16, shc(tb, 0.93), 0);
  cyl(o, I, [b * 0.55, -w2 * 0.1, rf], [b * 0.55, -w2 * 0.1, rf + 0.8 * u], 0.18 * u, 0.15 * u, 10, st, 1); bb(o, I, b * 0.55, -w2 * 0.1, rf + 1.05 * u, 0.32 * u, 0.32 * u, 0.26 * u, 0.06 * u, shc(tb, 0.95), 0); bb(o, I, b * 0.55 + 0.33 * u, -w2 * 0.1, rf + 1.05 * u, 0.01, 0.24 * u, 0.16 * u, 0.005, gls, 3);
  bb(o, I, cx + 0.3 * u, cy + 0.9 * u, rf + 0.95 * u, 0.45 * u, 0.16 * u, 0.16 * u, 0.04 * u, [0.09, 0.09, 0.085], 1); cyl(o, I, [cx + 0.7 * u, cy + 0.9 * u, rf + 0.97 * u], [cx + 2.6 * u, cy + 0.9 * u, rf + 0.97 * u], 0.06 * u, 0.05 * u, 8, [0.07, 0.07, 0.07], 1);
  bb(o, I, cx + 0.1 * u, cy + 1.25 * u, rf + 0.85 * u, 0.22 * u, 0.14 * u, 0.15 * u, 0.03 * u, [0.3, 0.32, 0.2], 4); cyl(o, I, [cx, cy + 0.9 * u, rf + 0.4 * u], [cx, cy + 0.9 * u, rf + 0.8 * u], 0.05 * u, 0.05 * u, 6, st, 1, false);
  for (const sd of [-1, 1]) { for (let i = 0; i < 4; i++) { const x = f * 0.05 + i * 0.36 * u, y = sd * (w2 * 0.98 + 0.1 * u), z = tz0 + Hh * 0.72; cyl(o, I, [x, y, z], [x + 0.55 * u, y + sd * 0.3 * u, z + 0.35 * u], 0.15 * u, 0.15 * u, 10, shc(dark, 0.8), 1, true, [0.02, 0.02, 0.02]); }
    cyl(o, I, [b * 0.88, sd * w2 * 0.62, rf], [b * 0.88, sd * w2 * 0.62, rf + 0.25 * u], 0.18 * u, 0.16 * u, 10, st, 1); cyl(o, I, [b * 0.88, sd * w2 * 0.62, rf + 0.25 * u], [b * 0.88 - 0.4 * u, sd * w2 * 0.62, rf + 5.5 * u], 0.035 * u, 0.02 * u, 5, [0.06, 0.06, 0.06], 1, false);
    if (TS === 0 || TS === 2) bb(o, I, b * 0.55, sd * (w2 + 0.25 * u), tz0 + Hh * 0.55, TL * 0.16, 0.25 * u, Hh * 0.28, 0.06 * u, shc(tb, 0.93), 0); }
  cyl(o, I, [b + 0.3 * u, 0, rf], [b + 0.3 * u, 0, rf + 1.2 * u], 0.04 * u, 0.04 * u, 6, st, 1, false);
  // bustle basket: rails + tarp roll + box
  const bx0 = b - 1.6 * u, bx1 = b + 0.05 * u, by = w2 * 0.8, z0 = tz0 + Hh * 0.35, z1 = tz0 + Hh * 0.8, rail = (p, q) => cyl(o, I, p, q, 0.06 * u, 0.06 * u, 6, st, 7, false);
  rail([bx0, -by, z1], [bx0, by, z1]); rail([bx0, -by, z1], [bx1, -by, z1]); rail([bx0, by, z1], [bx1, by, z1]); rail([bx0, -by, z0], [bx0, by, z0]);
  for (const y of [-by, -by / 3, by / 3, by]) rail([bx0, y, z0], [bx0, y, z1]); bb(o, I, (bx0 + bx1) / 2, 0, z0, (bx1 - bx0) / 2, by, 0.05 * u, 0.01, st, 1);
  cyl(o, I, [bx0 + 0.65 * u, -by * 0.9, z0 + 0.5 * u], [bx0 + 0.65 * u, by * 0.2, z0 + 0.5 * u], 0.45 * u, 0.45 * u, 14, [0.33, 0.31, 0.22], 6); bb(o, I, bx0 + 0.7 * u, by * 0.55, z0 + 0.4 * u, 0.55 * u, by * 0.4, 0.35 * u, 0.05 * u, shc(dark, 0.95), 0);
  if (m.kit) for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) bb(o, I, f * 0.25 + i * f * 0.22, sd * w2 * 0.86, tz1 - 0.2 * u, f * 0.1, 0.4 * u, 0.32 * u, 0.04 * u, shc(tb, 0.88), 0);
  // r19: mounted extra guns and visible mods
  if (m.mts) m.mts.forEach(([wid, pos, mr], i) => { const sd = pos === 'side' ? (i % 2 ? 1 : -1) : pos === 'pod' ? -1 : pos === 'coax' ? -0.35 : 0, rk = wid === 'rocket' || wid === 'hrocket' || wid === 'mortar', y = sd * (w2 + (rk ? 0.85 : 0.5) * u), zx = tz1 + (pos === 'coax' ? -0.2 : 0.35) * u, rear = pos === 'rear', x0 = rear ? b * 0.6 : f * 0.15, dir = rear ? -1 : 1;
    const col = rk ? [0.36, 0.3, 0.18] : mr >= 3 ? (mr === 4 ? [0.55, 0.12, 0.2] : [0.6, 0.42, 0.1]) : [0.14, 0.15, 0.15];
    bb(o, I, x0, y, zx, (rk ? 1.7 : 1.2) * u, (rk ? 0.85 : 0.5) * u, (rk ? 0.65 : 0.45) * u, 0.1 * u, col, mr >= 3 ? 7 : 1); cyl(o, I, [x0, y, zx - (rk ? 0.6 : 0.4) * u], [x0, y, tz1 - 0.3 * u], 0.18 * u, 0.2 * u, 10, st, 1);
    if (rk) { for (const dy of [-0.45, 0.45]) for (const dz of [-0.3, 0.3]) cyl(o, I, [x0 + dir * 1.6 * u, y + dy * u, zx + dz * u], [x0 + dir * 1.75 * u, y + dy * u, zx + dz * u], 0.26 * u, 0.26 * u, 10, [0.05, 0.05, 0.05], 1, true, [0.01, 0.01, 0.01]); }
    else { const L2 = (wid === 'mg' ? 4.5 : wid === 'rail' || wid === 'laser' ? 7 : 5.5) * u; cyl(o, I, [x0 + dir * 1.1 * u, y, zx], [x0 + dir * (1.1 * u + L2), y, zx], (wid === 'mg' ? 0.16 : 0.24) * u, (wid === 'mg' ? 0.13 : 0.2) * u, 10, [0.08, 0.08, 0.08], 1, true, [0.01, 0.01, 0.01]); } });
  const MD = m.md; if (MD) { if (MD.radar) { cyl(o, I, [b * 0.55, w2 * 0.3, rf], [b * 0.55, w2 * 0.3, rf + 1.6 * u], 0.1 * u, 0.1 * u, 8, st, 1, false); bb(o, I, b * 0.55, w2 * 0.3, rf + 1.75 * u, 0.2 * u, 1.5 * u, 0.45 * u, 0.08 * u, [0.7, 0.72, 0.72], 4); }
    if (MD.scope) { bb(o, I, f * 0.45, -w2 * 0.15, rf + 0.5 * u, 1.0 * u, 0.4 * u, 0.4 * u, 0.1 * u, [0.08, 0.09, 0.1], 1); bb(o, I, f * 0.45 + 1.01 * u, -w2 * 0.15, rf + 0.5 * u, 0.01, 0.28 * u, 0.28 * u, 0.005, gls, 3); }
    if (MD.ammo) for (const sd of [-1, 1]) bb(o, I, b + 0.1 * u, sd * (w2 + 0.5 * u), tz0 + Hh * 0.5, 0.9 * u, 0.4 * u, 0.6 * u, 0.06 * u, [0.3, 0.33, 0.2], 4);
    if (MD.spd) for (const sd of [-1, 1]) cyl(o, I, [b * 1.2, sd * w2 * 0.3, tz0 + 0.1 * u], [b * 1.2 - 0.9 * u, sd * w2 * 0.3, tz0 + 0.3 * u], 0.25 * u, 0.3 * u, 12, [0.12, 0.12, 0.12], 7, true, [0.02, 0.02, 0.02]); }
  return { f, mz, TS }; }

function buildGun(o, m, u, w, f, mz, TS) { const tl = m.tl, cls = m.cls, body = m.body, st = [0.14, 0.14, 0.135], bore = [0.01, 0.01, 0.01];
  const bl = (w === 'mortar' ? 6 : w === 'rail' ? 14 : w === 'mg' ? 8 : (cls === 'H' ? 13 : cls === 'L' ? 10.5 : 12) * (tl ? tl.bl : 1)) * u * (m.md && m.md.lb ? 1.18 : 1), br = (w === 'mg' ? 0.2 : (cls === 'H' ? 0.4 : 0.34) * (tl ? tl.br : 1)) * u;
  const x0 = f + (TS === 4 ? 0.4 : 0.8) * u, x1 = x0 + bl;
  if (w === 'twin' || w === 'mg') { for (const sd of [-1, 1]) { const y = sd * 0.42 * u; cyl(o, I, [x0, y, mz], [x0 + bl * 0.6, y, mz], br * 1.6, br * 1.5, 14, shc(body, 0.85), 0, false); cyl(o, I, [x0, y, mz], [x1, y, mz], br, br * 0.9, 14, st, 1, true, bore); cyl(o, I, [x1 - 0.5 * u, y, mz], [x1, y, mz], br * 1.35, br * 1.2, 12, st, 1, true, bore); } return; }
  const pc = shc(body, 0.92); cyl(o, I, [x0, 0, mz], [x0 + 0.8 * u, 0, mz], br * 1.7, br * 1.5, 18, pc, 0, true);
  cyl(o, I, [x0, 0, mz], [x1, 0, mz], br * 1.25, br * 1.0, 18, pc, 0, false);
  for (let k = 1; k < 4; k++) { const x = x0 + bl * (0.18 + k * 0.17); cyl(o, I, [x, 0, mz], [x + 0.18 * u, 0, mz], br * 1.32 - k * 0.02 * u, br * 1.3 - k * 0.02 * u, 18, shc(pc, 0.9), 0, true); }
  if (w !== 'rail' && w !== 'laser') { const e0 = x0 + bl * 0.46, e1 = x0 + bl * 0.62; cyl(o, I, [e0 - 0.3 * u, 0, mz], [e0, 0, mz], br * 1.15, br * 1.55, 18, pc, 0, false); cyl(o, I, [e0, 0, mz], [e1, 0, mz], br * 1.55, br * 1.55, 18, pc, 0, false); cyl(o, I, [e1, 0, mz], [e1 + 0.35 * u, 0, mz], br * 1.55, br * 1.1, 18, pc, 0, false); }
  if (w === 'rail') { for (let k = 0; k < 6; k++) cyl(o, I, [x0 + bl * (0.3 + k * 0.11), 0, mz], [x0 + bl * (0.3 + k * 0.11) + 0.25 * u, 0, mz], br * 1.5, br * 1.5, 16, [0.25, 0.7, 1], 5); cyl(o, I, [x1, 0, mz], [x1 + 0.3 * u, 0, mz], br * 1.4, br * 1.2, 16, st, 1, true, [0.3, 0.8, 1]); return; }
  if (w === 'laser') { cyl(o, I, [x1, 0, mz], [x1 + 0.5 * u, 0, mz], br * 1.7, br * 1.7, 16, st, 1, true, [1, 0.3, 0.3]); return; }
  // muzzle brake: body + side ports
  const m0 = x1 - 0.1 * u, m1 = x1 + (TS === 2 || TS === 4 ? 1.4 : 1.0) * u; cyl(o, I, [m0, 0, mz], [m1, 0, mz], br * 1.55, br * 1.5, 18, st, 1, true, bore);
  const nports = TS === 2 || TS === 4 ? 2 : 1; for (let k = 0; k < nports; k++) for (const sd of [-1, 1]) bb(o, I, m0 + (k + 0.6) * (m1 - m0) / (nports + 0.4), sd * br * 1.35, mz, 0.16 * u, br * 0.3, br * 0.8, 0.02 * u, bore, 1);
  cyl(o, I, [m1, 0, mz], [m1 + 0.01, 0, mz], br * 0.75, br * 0.75, 14, bore, 1, true, bore); }

const cache = new Map();
// returns { k, hull, tur, gun, pv } (Float32Arrays); geometry cached per visual key
export function tankParts(t, m) { const k = JSON.stringify([m.cls, m.sx, m.sy, m.sc, m.pal, m.kit, m.tl, m.md, m.mts, t.weapon, m.tw, m.nw]); let r = cache.get(k); if (r) return r;
  const D = DIM[m.cls] || DIM.M, u = m.sc, mm = { ...m, body: m.pal.body.map(v => v / 255), dark: m.pal.dark.map(v => v / 255) }, H = [], T = [], G = [];
  const h = buildHull(H, mm, D, u), tt = buildTurret(T, mm, D, u, h.zt); buildGun(G, mm, u, t.weapon || 'cannon', tt.f, tt.mz, tt.TS);
  r = { k, hull: new Float32Array(H), tur: new Float32Array(T), gun: new Float32Array(G), pv: -0.06 * h.L, u };
  if (cache.size > 80) cache.delete(cache.keys().next().value); cache.set(k, r); return r; }
// r20 sentry «Турель» in world coordinates (rebuilt per frame, small)
export function sentryMesh(o, s) { const T = X(s.x, s.y, 0, 0), u = 0.9, st = [0.22, 0.24, 0.26], tc = s.team ? [0.6, 0.28, 0.24] : [0.26, 0.38, 0.55];
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.3; cyl(o, T, [0, 0, 4 * u], [Math.cos(a) * 5.5 * u, Math.sin(a) * 5.5 * u, 0], 0.3 * u, 0.25 * u, 8, st, 1); }
  cyl(o, T, [0, 0, 3.6 * u], [0, 0, 5 * u], 2.2 * u, 2 * u, 18, [0.3, 0.32, 0.3], 1); bb(o, T, -2.2 * u, 0, 3.2 * u, 1.1 * u, 1.3 * u, 1.0 * u, 0.15 * u, [0.3, 0.33, 0.2], 4);
  const Hh = X(s.x, s.y, 0, s.a || 0); bb(o, Hh, 0, 0, 6.2 * u, 2.2 * u, 1.7 * u, 1.2 * u, 0.3 * u, tc, 4); bb(o, Hh, -0.6 * u, 0, 7.5 * u, 1.2 * u, 1.2 * u, 0.25 * u, 0.08 * u, [0.15, 0.16, 0.17], 1);
  for (const sd of [-0.55, 0.55]) cyl(o, Hh, [2 * u, sd * u, 6.2 * u], [7.5 * u, sd * u, 6.2 * u], 0.26 * u, 0.24 * u, 12, [0.08, 0.08, 0.08], 1, true, [0.01, 0.01, 0.01]);
  bb(o, Hh, 2.3 * u, 0, 7.2 * u, 0.35 * u, 0.35 * u, 0.35 * u, 0.05 * u, [0.3, 0.95, 1.0], 5); }

// r25: combat drone — quadcopter: carbon body, 4 arms, motors + spinning (blurred) rotor discs, under-slung gun pod, nav lights
export function droneMesh(o, s) { const z0 = 15 + Math.sin((s.ph || 0) * 3) * 0.8, T = X(s.x, s.y, 0, s.a || 0), u = 0.85, body = s.leg ? [0.55, 0.42, 0.18] : [0.2, 0.22, 0.24], dk = [0.07, 0.07, 0.08];
  bb(o, T, 0, 0, z0 * u, 2.6 * u, 1.6 * u, 0.7 * u, 0.3 * u, body, 4); bb(o, T, 0.6 * u, 0, (z0 + 0.8) * u, 1.3 * u, 0.9 * u, 0.35 * u, 0.2 * u, dk, 4);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, ax = Math.cos(a) * 5.2 * u, ay = Math.sin(a) * 5.2 * u;
    cyl(o, T, [0, 0, z0 * u], [ax, ay, (z0 + 0.3) * u], 0.32 * u, 0.28 * u, 8, dk, 1); cyl(o, T, [ax, ay, (z0 - 0.3) * u], [ax, ay, (z0 + 1.1) * u], 0.75 * u, 0.7 * u, 12, [0.12, 0.12, 0.13], 1);
    cyl(o, T, [ax, ay, (z0 + 1.2) * u], [ax, ay, (z0 + 1.32) * u], 3.1 * u, 3.1 * u, 20, [0.32, 0.34, 0.36], 0); }
  cyl(o, T, [0.5 * u, 0, (z0 - 1.1) * u], [4.2 * u, 0, (z0 - 1.1) * u], 0.32 * u, 0.26 * u, 10, dk, 1, true, [0.01, 0.01, 0.01]); bb(o, T, 0, 0, (z0 - 0.9) * u, 1, 0.7, 0.45, 0.1, [0.25, 0.26, 0.22], 2);
  bb(o, T, 2.4 * u, 0.9 * u, z0 * u, 0.25, 0.25, 0.25, 0.05, [0.2, 1, 0.3], 5); bb(o, T, 2.4 * u, -0.9 * u, z0 * u, 0.25, 0.25, 0.25, 0.05, [1, 0.2, 0.2], 5); }

// r25: twin homing rockets — tr 1: ground launcher trap (tripod rails), tr 2: mounted on the hull sides
export function twinMesh(o, s) { const T = X(s.x, s.y, 0, s.a || 0), u = 0.85, z = s.tr === 2 ? 4.6 : 2.2, body = [0.82, 0.82, 0.78], red = [0.75, 0.12, 0.08], st = [0.2, 0.21, 0.2];
  if (s.tr === 1) { bb(o, T, 0, 0, 0.6, 2.6 * u, 2.2 * u, 0.6, 0.15, [0.28, 0.3, 0.24], 2); for (const sd of [-1, 1]) cyl(o, T, [-2 * u, sd * 1.2 * u, 0.9], [1.5 * u, sd * 1.2 * u, z], 0.22, 0.22, 6, st, 1); }
  for (let k = 0; k < (s.n || 2); k++) { const y = (k ? -1 : 1) * (s.tr === 2 ? 4.8 : 1.2) * u; cyl(o, T, [-3.2 * u, y, z], [2.6 * u, y, z + (s.tr === 1 ? 1 : 0)], 0.55 * u, 0.55 * u, 12, body, 1); cyl(o, T, [2.6 * u, y, z + (s.tr === 1 ? 1 : 0)], [3.8 * u, y, z + (s.tr === 1 ? 1.2 : 0)], 0.55 * u, 0.05, 12, red, 1, false);
    for (const f of [-1, 1]) bb(o, T, -2.9 * u, y + f * 0.6 * u, z, 0.5 * u, 0.35 * u, 0.06, 0.02, red, 1); } }
