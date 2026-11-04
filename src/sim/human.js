// r28: "humanize" layer — runs after botThink decided move/aim/fire and makes the result look like a live player:
// aim overshoot + correction, hesitation on first sight, idle look-around, reaction to sounds, chase → give-up,
// occasional mistakes + recovery, movement smoothing (no jitter / spinning), camping, following/helping a human ally,
// celebrations on kills and persona-flavoured weapons. Counters ai.hCorr/hGive/hHeard/hMist feed tests/human28.mjs.
import { WEAPONS, AMMO } from './defs.js';
import { chat } from './brain.js';
const TAU = Math.PI * 2, ad = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const PW = { aggressive: ['shotgun', 'flame', 'twin', 'mg'], sniper: ['rail', 'laser', 'mortar'], coward: ['rail', 'heavy', 'homing', 'cannon'], looter: ['cannon', 'mg', 'ricochet'], medic: ['cannon', 'emp', 'mg'], flanker: ['twin', 'rocket', 'mg', 'laser'] };
export const PERSONA_LABEL = { aggressive: 'rusher', sniper: 'sniper', coward: 'camper', looter: 'looter', medic: 'support', flanker: 'flanker' };
const rnd = (a, b) => a + Math.random() * (b - a);
export function humanize(w, t, dt) {
  if (globalThis.NOHUMAN || w.mode === 'classic' || w.special === 'race' || t.zombie || t.etype || t.boss) return;
  const ai = t.ai, inp = t.input, sk = ai.skill ?? 0.5, now = w.time;
  let H = ai.H;
  if (!H) { H = ai.H = { ma: null, commit: 0, tg: 0, off: 0, ph: 0, wob: Math.random() * TAU, look: null, lookT: 0, hes: 0, mist: 0, mistA: 0, mistT: rnd(20, 60), camp: 0, kills: t.kills || 0, celeb: 0, hadMem: false, snd: null, sndT: 0, fol: (t.pers === 'medic' || Math.random() < 0.55) };
    const L = PW[t.pers]; if (L && now < 3 && Math.random() < 0.65) { const wp = L[Math.floor(Math.random() * L.length)]; if (WEAPONS[wp] && t.weapon !== wp && !t.mounts?.length) { t.weapon = wp; if (t.ammo != null && AMMO && AMMO[wp] != null) t.ammo = AMMO[wp]; } } }
  const tgT = ai.target ? w.tanks.find(o => o.id === ai.target && o.alive) : null;
  // ---- celebration on a kill
  if ((t.kills || 0) > H.kills) { H.kills = t.kills; if (Math.random() < 0.45) { chat(w, t, 'emo', true); } H.celeb = 0.9; }
  // ---- chase → give up (memory lost without a target)
  const hasMem = !!ai.mem; if (H.hadMem && !hasMem && !tgT) { ai.hGive = (ai.hGive || 0) + 1; H.look = Math.atan2(inp.my || 0, inp.mx || 1) + Math.PI * rnd(0.6, 1.4); H.lookT = 1.2; } H.hadMem = hasMem;
  // ---- hearing: unseen shots → glance + (bold bots) drift that way
  if (!tgT && now - H.sndT > 5) for (const o of w.tanks) { if (!o.alive || o === t || (!w.ffa && o.team === t.team)) continue; if (now - (o.lastFire ?? -99) < 0.4) { const d2 = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d2 < 420 * 420 && d2 > 60 * 60) { H.snd = { x: o.x + rnd(-40, 40), y: o.y + rnd(-40, 40) }; H.sndT = now; ai.hHeard = (ai.hHeard || 0) + 1; H.look = Math.atan2(H.snd.y - t.y, H.snd.x - t.x); H.lookT = rnd(1, 2); break; } } }
  // ---- follow / help a human teammate
  if (!w.ffa && H.fol && !tgT) { let hu = null; for (const o of w.tanks) if (o.alive && (o.human || o.simHuman) && o.team === t.team && o !== t) { hu = o; break; }
    if (hu) { if (hu.lastAtkT != null && now - hu.lastAtkT < 2) { const A = w.tanks.find(o => o.id === hu.lastAtk && o.alive); if (A && (A.x - t.x) ** 2 + (A.y - t.y) ** 2 < 360 * 360) { ai.target = A.id; ai.mem = { x: A.x, y: A.y, t: now }; } }
      const dx = hu.x - t.x, dy = hu.y - t.y, d = Math.hypot(dx, dy); if (d > 100 && d < 1400 && !ai.lootP) { const a = Math.atan2(dy, dx) + (t.id % 2 ? 0.5 : -0.5), k = Math.min(1, (d - 90) / 120); inp.mx = Math.cos(a) * k; inp.my = Math.sin(a) * k; } } }
  // ---- camper persona: hold still in cover for a while when nothing is happening
  if (t.pers === 'coward' && !tgT && !ai.lootP) { H.camp -= dt; if (H.camp < -rnd(6, 12)) H.camp = rnd(5, 12); if (H.camp > 0) { inp.mx = inp.my = 0; if (!(H.lookT > 0)) { H.look = (H.look ?? t.a ?? 0) + rnd(-1.4, 1.4); H.lookT = rnd(1.2, 2.6); } } }
  // ---- hesitation on first sight
  if (tgT && tgT.id !== H.tg) { H.tg = tgT.id; const base = 0.12 + 0.35 * (1 - sk); H.off = (Math.random() < 0.5 ? -1 : 1) * base * rnd(0.6, 1.2); H.ph = 0; H.lastSign = Math.sign(H.off); if (Math.random() < 0.55 - sk * 0.4) H.hes = rnd(0.15, 0.45); }
  if (!tgT) H.tg = 0;
  if (H.hes > 0) { H.hes -= dt; inp.fire = false; inp.mx *= 0.25; inp.my *= 0.25; }
  // ---- deliberate mistakes + recovery (wrong turn / panic shot), rarer for skilled bots
  H.mistT -= dt * (1.4 - sk); if (H.mistT <= 0) { H.mistT = rnd(25, 70); H.mist = rnd(0.5, 1.0); H.mistA = Math.random() < 0.5 ? Math.PI * rnd(0.5, 1) : 0; H.mistFire = tgT && Math.random() < 0.5; ai.hMist = (ai.hMist || 0) + 1; }
  if (H.mist > 0) { H.mist -= dt; if (H.mistA && (inp.mx || inp.my)) { const a = Math.atan2(inp.my, inp.mx) + H.mistA, m = Math.hypot(inp.mx, inp.my); inp.mx = Math.cos(a) * m; inp.my = Math.sin(a) * m; } if (H.mistFire && inp.aim) inp.fire = true; }
  // ---- aim: damped overshoot (sign flips = corrections) + small hand wobble; idle look-around instead of a spinning turret
  H.wob += dt * rnd(1.5, 2.5);
  if (inp.aim && tgT) { H.ph += dt; const k = 2.2 + 3.5 * sk; const off = H.off * Math.exp(-k * H.ph) * Math.cos(H.ph * (5 + 3 * sk)); const s = Math.sign(off); if (s && H.lastSign && s !== H.lastSign && Math.abs(H.off * Math.exp(-k * H.ph)) > 0.02) { ai.hCorr = (ai.hCorr || 0) + 1; } if (s) H.lastSign = s;
    const wob = Math.sin(H.wob) * (0.015 + 0.04 * (1 - sk)), a = Math.atan2(inp.ay, inp.ax) + off + wob; inp.ax = Math.cos(a); inp.ay = Math.sin(a); if (Math.abs(off) > 0.16 && !H.mistFire) inp.fire = false; }
  else if (!tgT && H.celeb <= 0) { H.lookT -= dt; if (H.lookT <= 0) { const mv = (inp.mx || inp.my) ? Math.atan2(inp.my, inp.mx) : (t.ta ?? t.a ?? 0); H.look = mv + (Math.random() < 0.6 ? rnd(-0.5, 0.5) : rnd(-1.6, 1.6)); H.lookT = rnd(1.4, 3.5); }
    if (H.look != null && !inp.fire) { inp.aim = true; inp.ax = Math.cos(H.look); inp.ay = Math.sin(H.look); } }
  if (H.celeb > 0) { H.celeb -= dt; if (!tgT) { const a = (t.ta ?? t.a ?? 0) + Math.sin(H.celeb * 14) * 0.6; inp.aim = true; inp.ax = Math.cos(a); inp.ay = Math.sin(a); inp.fire = false; } }
  // ---- movement smoothing: limited turn rate + commit window against back-and-forth jitter
  H.commit -= dt;
  if (inp.mx || inp.my) { const m = Math.hypot(inp.mx, inp.my), a = Math.atan2(inp.my, inp.mx); const urgent = (ai.dodge > 0) || (ai.escT > 0) || (ai.unstick > 0) || (t.wT || 0) > 17;
    if (H.ma == null || urgent) H.ma = a; else { let d = ad(H.ma, a); if (Math.abs(d) > 2.3) { if (H.commit > 0) d = 0; else H.commit = rnd(0.45, 0.8); }
      const rate = 3.5 + 2.5 * sk; H.ma += Math.max(-rate * dt, Math.min(rate * dt, d)); if (Math.abs(d) > 2.3 && H.commit > 0) H.ma = a; }
    inp.mx = Math.cos(H.ma) * m; inp.my = Math.sin(H.ma) * m; }
}
