// r25: per-model sound signature — every catalogue model (108) gets its own engine (diesel/turbine, pitch, rumble),
// track-clatter rate and cannon timbre (pitch from calibre/class, body/decay, crack brightness). Deterministic per model id.
import { MODELS } from '../sim/models.js';
import { TURRETS, MGS } from '../sim/arms.js';
const hsh = (n) => { n = Math.imul((n + 1) ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const CLS = { light: [1.2, 0.8, 1.3], medium: [1, 1, 1], heavy: [0.8, 1.25, 0.85], td: [0.85, 1.15, 1.1], spg: [0.75, 1.35, 0.8] };
export function modelVoice(id) { const M = MODELS[id] || {}; const c = CLS[M.cls] || CLS.medium, a = hsh(id * 3 + 1), b = hsh(id * 7 + 2), d = hsh(id * 11 + 3), e = hsh(id * 13 + 4);
  return { eng: { p: +(c[0] * (0.82 + 0.36 * a)).toFixed(3), tb: (M.cls === 'light' ? b < 0.45 : b < 0.22) ? 1 : 0, cl: +(c[2] * (0.75 + 0.5 * d)).toFixed(3), rb: +(c[1] * (0.6 + 0.8 * e)).toFixed(3) },
    gun: { p: +(c[0] * (0.85 + 0.3 * b)).toFixed(3), b: +(c[1] * (0.85 + 0.3 * d)).toFixed(3), c: +(0.75 + 0.5 * a).toFixed(3) } }; }
export function voiceOf(t) { const k = (t.model ?? -1) + ':' + (t.tur ?? -1); if (t._vo && t._voK === k) return t._vo;
  const base = t.model != null ? modelVoice(t.model) : modelVoice((t.id | 0) % MODELS.length || 0); const v = { eng: { ...base.eng }, gun: { ...base.gun } };
  if (t.tur != null && TURRETS[t.tur]) { const cal = TURRETS[t.tur].cal || 100; v.gun.p = +(v.gun.p * (1.25 - cal / 400)).toFixed(3); v.gun.b = +(v.gun.b * (0.8 + cal / 500)).toFixed(3); }
  t._vo = v; t._voK = k; return v; }
export const mgClass = (mgi) => { const M = MGS[mgi]; if (!M) return 0; return M.reload < 0.08 ? 2 : M.dmg > 8.3 ? 1 : 0; };
