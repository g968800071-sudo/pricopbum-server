// r17 i18n: 11 languages. Source strings are Russian; translation happens at the presentation layer
// (DOM text nodes + canvas text), so every screen, toast, HUD label and chat line passes through tr().
import RAW from './i18n/dict.js';
export const LANGS = [['ru', 'Русский'], ['uk', 'Українська'], ['ro', 'Română'], ['de', 'Deutsch'], ['es', 'Español'], ['en', 'English'], ['zh-CN', '简体中文'], ['fr', 'Français'], ['pl', 'Polski'], ['ka', 'ქართული'], ['hy', 'Հայերեն']];
const IDX = Object.fromEntries(LANGS.map(([c], i) => [c, i]));
const D = new Map(); for (const line of RAW.split('\n')) { if (!line || line[0] === '#') continue; const p = line.split('|'); if (p.length === 11) D.set(p[0], p); }
export const dictSize = () => D.size;
let L = 0; const cache = new Map();
export function detectLang(nav = (typeof navigator !== 'undefined' ? navigator : {})) { const l = ((nav.languages && nav.languages[0]) || nav.language || 'ru').toLowerCase();
  if (l.startsWith('zh')) return 'zh-CN'; const b = l.split('-')[0]; return IDX[b] != null ? b : 'en'; }
export function setLang(code) { L = IDX[code] ?? 0; cache.clear(); if (typeof document !== 'undefined') document.documentElement.lang = code; }
export function lang() { return LANGS[L][0]; }
export function langName() { return LANGS[L][1]; }
const CYR = /[А-Яа-яЁё]/;
const look = (s) => { const r = D.get(s); if (r) return r[L]; const up = s.toUpperCase() === s && s.toLowerCase() !== s; if (up) { for (const [k, v] of D) if (k.toUpperCase() === s) return L === 6 ? v[L] : v[L].toUpperCase(); } return null; };
// exact → trimmed → number-stripped → segment-wise (« · », «: », « — ») → word-wise for generated names
export function tr(s) { if (!L || typeof s !== 'string' || !CYR.test(s)) return s; const c = cache.get(s); if (c !== undefined) return c; let out = trI(s); if (cache.size > 5000) cache.clear(); cache.set(s, out); return out; }
function trI(s) { let v = look(s); if (v != null) return v; const m = /^(\s*)(.*?)(\s*)$/.exec(s); if (m[2] !== s) { v = look(m[2]); if (v != null) return m[1] + v + m[3]; }
  const n = /^(.*?)([\s:]*[\d×+\-−.,%/]+[^А-Яа-яЁё]*)$/.exec(s); if (n && n[1] && (v = look(n[1].trim())) != null) return v + n[2];
  { const q = s.indexOf(' «'); if (q > 0 && (v = look(s.slice(0, q).trim())) != null) return v + s.slice(q); } // «proper noun» kept
  { const ws = s.split(' '); if (ws.length > 1 && ws.length <= 6) { let any = false; const o = ws.map(w => { const m = /^([^А-Яа-яЁё]*)([А-Яа-яЁё.!\-]+)([^А-Яа-яЁё]*)$/.exec(w); const x = m ? look(m[2]) : null; if (x != null) { any = true; return m[1] + x + m[3]; } return w; }); if (any && !o.some(w => /[А-Яа-яЁё]/.test(w))) return o.join(' '); } } // word-by-word only when every Russian word is known
  const n2 = /^([^А-Яа-яЁё]*[\d×+\-−.,%/]+\s*)(.+)$/.exec(s); if (n2 && (v = look(n2[2].trim())) != null) return n2[1] + v;
  const seg = s.split(/( · |: | — |, )/); if (seg.length > 1) { let hit = false; const o = seg.map(x => { if (!CYR.test(x)) return x; const t = trI(x); if (t !== x) hit = true; return t; }); if (hit) return o.join(''); }
  return s; }
// presentation hooks
export function installI18n(root) {
  const fix = (n) => { if (n.nodeType === 3) { const pe = n.parentNode; if (pe && (pe.nodeName === 'STYLE' || pe.nodeName === 'SCRIPT')) return; const v = n.nodeValue; if (CYR.test(v)) { const t = tr(v); if (t !== v) n.nodeValue = t; } } else if (n.nodeType === 1) { if (n.nodeName === 'STYLE' || n.nodeName === 'SCRIPT') return; if (n.placeholder && CYR.test(n.placeholder)) n.placeholder = tr(n.placeholder); for (const c of n.childNodes) fix(c); } };
  const mo = new MutationObserver((ms) => { if (!L) return; for (const m of ms) { if (m.type === 'characterData') fix(m.target); else for (const n of m.addedNodes) fix(n); } });
  mo.observe(root, { childList: true, subtree: true, characterData: true }); fix(root);
  const C = CanvasRenderingContext2D.prototype; if (!C.__i18n) { C.__i18n = 1; for (const k of ['fillText', 'strokeText', 'measureText']) { const o = C[k]; C[k] = function (t, ...a) { return o.call(this, L && typeof t === 'string' ? tr(t) : t, ...a); }; } }
  return () => mo.disconnect(); }
