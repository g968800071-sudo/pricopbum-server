// r36 «Охота» bot brains. Hunters: shared last-seen intel (with a human-like report delay), encircle / flank / cut-off roles,
// search bushes & houses, shoot spotted traps and decoys. Target: knows hunter positions (the minimap rule) with a delayed
// "glance", hides out of line of sight (bush, houses), ambushes lone hunters, places traps on its trail and at chokepoints.
import { CELL, T_BUSH, T_EMPTY, T_ICE, TANK_R } from './defs.js';
import { HT_SEE } from './htraps.js';
import { mlDanger } from './molotov.js';
const TAU = Math.PI * 2, ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function openAt(w, x, y) { return x > 16 && y > 16 && x < w.map.pw - 16 && y < w.map.ph - 16 && !w.map.tankBlockedAt(x, y, TANK_R); }
function chokeAt(w, x, y) { let n = 0; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; if (w.map.tankBlockedAt(x + Math.cos(a) * 18, y + Math.sin(a) * 18, 3)) n++; } return n; }
export function huntIntel(w, t, tg) { // a hunter that sees the target reports it (radio delay is applied on read)
  if (t.team !== 1 || !tg || !tg.isTarget || !tg.alive) return; const S = w.huntSeen || (w.huntSeen = {}); S.x = tg.x; S.y = tg.y; S.vx = tg.vx || 0; S.vy = tg.vy || 0; S.t = w.time; S.by = t.id;
}
export function huntBot(w, t, ai, tg, dt) {
  if (w.special !== 'hunt' || !t.alive) return null;
  if (t.isTarget) return targetBot(w, t, ai, tg, dt);
  if (w.time < (w.huntHold || 0)) return { moveA: null, hold: 1 };
  return hunterBot(w, t, ai, tg, dt);
}
function hunters(w) { return w.tanks.filter(o => o.alive && o.team === 1); }
function hunterBot(w, t, ai, tg, dt) {
  const T = w.huntT; if (!T) return null; const H = hunters(w), idx = Math.max(0, H.indexOf(t)), n = H.length;
  // see the target with own eyes? (tg is the AI's chosen enemy — only set when visible)
  if (tg && tg.isTarget) huntIntel(w, t, tg);
  // traps / decoys visible up close: shoot them when not fighting
  if (!tg && w.htraps) for (const q of w.htraps) { const d2 = (q.x - t.x) ** 2 + (q.y - t.y) ** 2; if ((q.k === 'decoy' ? d2 < 200 * 200 : d2 < (HT_SEE + 10) ** 2) && w.map.los(t.x, t.y, q.x, q.y)) { const a = Math.atan2(q.y - t.y, q.x - t.x); return { moveA: q.k === 'decoy' ? a : null, speedK: 0.7, aimA: a, fire: Math.abs(ang((t.ta ?? t.a) - a)) < 0.25 }; } }
  // read shared intel with a human delay (radio + reaction)
  ai.hRd = ai.hRd ?? (0.5 + Math.random() * 0.7); const S = w.huntSeen; let goal = null;
  if (S && w.time - S.t > (S.by === t.id ? 0 : ai.hRd) && w.time - S.t < 28) {
    const age = Math.min(3, w.time - S.t), px = S.x + S.vx * age * 0.7, py = S.y + S.vy * age * 0.7;
    // escape direction: away from the hunters' centroid
    let cx = 0, cy = 0; for (const o of H) { cx += o.x; cy += o.y; } cx /= n || 1; cy /= n || 1; const ea = Math.atan2(py - cy, px - cx);
    const role = idx % 3, ring = tg ? 115 : 70;
    if (tg) { // engaged: take an encircle slot around the target, spread by index
      const base = Math.atan2(cy - py, cx - px), sa = base + (idx - (n - 1) / 2) * 0.95; goal = [px + Math.cos(sa) * ring, py + Math.sin(sa) * ring];
    } else if (role === 0) goal = [px, py]; // chaser
    else if (role === 1) { const s = idx % 2 ? 1 : -1; goal = [px + Math.cos(ea + s * Math.PI / 2) * 100, py + Math.sin(ea + s * Math.PI / 2) * 100]; } // flanker
    else goal = [px + Math.cos(ea) * 130, py + Math.sin(ea) * 130]; // cut off the escape route
    if (!tg && Math.hypot(goal[0] - t.x, goal[1] - t.y) < 28) { // arrived, nothing there: search the nearest bush/house
      ai.srch = ai.srch && w.time - ai.srch.t < 6 ? ai.srch : searchSpot(w, t, px, py); if (ai.srch) goal = [ai.srch.x, ai.srch.y]; }
  } else { // no intel: sweep the map in sectors
    if (!ai.sw || w.time > ai.sw.t || Math.hypot(ai.sw.x - t.x, ai.sw.y - t.y) < 30) { const m = w.map, secW = m.pw / Math.max(1, n); for (let k = 0; k < 12; k++) { const x = secW * idx + Math.random() * secW, y = 40 + Math.random() * (m.ph - 80); if (openAt(w, x, y)) { ai.sw = { x, y, t: w.time + 14 }; break; } } }
    if (ai.sw) goal = [ai.sw.x, ai.sw.y];
  }
  if (!goal) return null;
  let a = Math.atan2(goal[1] - t.y, goal[0] - t.x); const d = Math.hypot(goal[0] - t.x, goal[1] - t.y);
  if (tg && d < 26) return null; // in the slot: let the normal duel logic strafe / aim
  a = avoidHaz(w, t, a);
  return { moveA: a, speedK: d > 80 ? 1 : 0.75 };
}
function searchSpot(w, t, x, y) { const m = w.map; let best = null, bs = -1; for (let k = 0; k < 24; k++) { const a = Math.random() * TAU, r = 20 + Math.random() * 120, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, v = m.get(Math.floor(px / CELL), Math.floor(py / CELL)); if (v !== T_BUSH && v !== T_EMPTY) continue; const sc = (v === T_BUSH ? 2 : 0) + chokeAt(w, px, py) * 0.3 + Math.random(); if (sc > bs && openAt(w, px, py)) { bs = sc; best = { x: px, y: py, t: w.time }; } } return best; }
function avoidHaz(w, t, a) { const ax = t.x + Math.cos(a) * 22, ay = t.y + Math.sin(a) * 22; if (mlDanger(w, t, ax, ay)) return a + ((t.ai && t.ai.side) || 1) * 1.2; if (t.team === 1 && w.htraps) for (const q of w.htraps) if (q.k !== 'decoy' && (q.x - ax) ** 2 + (q.y - ay) ** 2 < 20 * 20 && (q.x - t.x) ** 2 + (q.y - t.y) ** 2 < HT_SEE * HT_SEE) return a + ((t.ai && t.ai.side) || 1) * 1.1; return a; }

function targetBot(w, t, ai, tg, dt) {
  // the target "glances" at the minimap every 0.6–1.1 s — knowledge is the delayed snapshot, not live positions
  if (!ai.mm || w.time > ai.mmT) { ai.mm = hunters(w).map(o => ({ x: o.x, y: o.y, id: o.id, hp: o.hp, mx: o.maxHp })); ai.mmT = w.time + 0.6 + Math.random() * 0.5; }
  const M = ai.mm; if (!M.length) return null;
  let near = null, nd = 1e9; for (const o of M) { const d = Math.hypot(o.x - t.x, o.y - t.y); if (d < nd) { nd = d; near = o; } }
  const close = M.filter(o => Math.hypot(o.x - t.x, o.y - t.y) < 200).length, hpK = t.hp / (t.maxHp || 1);
  trapLogic(w, t, ai, M, near, nd, close, hpK, tg);
  // ambush: one hunter close, the rest far, we're healthy → fight (normal duel logic)
  if (tg && close <= 1 && hpK > 0.45) return null;
  // otherwise hide: re-plan every ~1.6 s or when spotted/hit
  const hurt = t.lastAtkT && w.time - t.lastAtkT < 1.2;
  if (!ai.hide || w.time > ai.hideT || hurt && !ai.hideHurt) { ai.hide = hideSpot(w, t, M); ai.hideT = w.time + 1.4 + Math.random() * 0.6; ai.hideHurt = hurt; }
  if (!hurt) ai.hideHurt = false;
  if (!ai.hide) return null; const d = Math.hypot(ai.hide.x - t.x, ai.hide.y - t.y);
  if (d < 14) { // in position: wait, aim towards the closest hunter's approach (bait/ambush)
    return { moveA: null, hold: 1, aimA: near ? Math.atan2(near.y - t.y, near.x - t.x) : null, fire: tg ? undefined : false }; }
  return { moveA: avoidHaz(w, t, Math.atan2(ai.hide.y - t.y, ai.hide.x - t.x)), speedK: close ? 1 : 0.85 };
}
function hideSpot(w, t, M) {
  const m = w.map; let best = null, bs = -1e9;
  for (let k = 0; k < 30; k++) { const a = Math.random() * TAU, r = 40 + Math.random() * 230, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r; if (!openAt(w, x, y)) continue;
    let minD = 1e9, blocked = 0, toward = 0; for (const o of M) { const d = Math.hypot(o.x - x, o.y - y); minD = Math.min(minD, d); if (d < 320 && !m.los(o.x, o.y, x, y)) blocked++; const da = Math.atan2(o.y - t.y, o.x - t.x); if (Math.abs(ang(da - a)) < 0.6 && Math.hypot(o.x - t.x, o.y - t.y) < r + 80) toward++; }
    const v = m.get(Math.floor(x / CELL), Math.floor(y / CELL)); let sc = Math.min(minD, 360) + blocked * 70 + (v === T_BUSH ? 90 : 0) - toward * 160 - r * 0.25 + (m.houses && m.houses.some(H => x > H.c * CELL && x < (H.c + H.w) * CELL && y > H.r * CELL && y < (H.r + H.h) * CELL) ? 60 : 0) + Math.random() * 25;
    if (minD < 110) sc -= 300; if (sc > bs) { bs = sc; best = { x, y }; } }
  return best;
}
function trapLogic(w, t, ai, M, near, nd, close, hpK, tg) {
  const K = t.hk; if (!K || (t.htCd || 0) > w.time || w.time < (ai.trapT || 0)) return; ai.trapT = w.time + 0.5 + Math.random() * 0.7; // human pace
  const use = (k) => { if (K[k] > 0 && w.doAction(t, 'ht_' + k)) return true; return false; };
  if (K.tele > 0 && !w.htraps?.some(q => q.k === 'tele' && q.owner === t.id) && nd > 260) { use('tele'); return; } // drop a beacon in a quiet moment
  if (hpK < 0.3 && nd < 150 && w.htraps?.some(q => q.k === 'tele' && q.owner === t.id && Math.hypot(q.x - t.x, q.y - t.y) > 160)) { use('tele'); return; }
  if (tg && nd < 170 && hpK < 0.5) { if (use('flare') || use('smoke') || use('wall')) return; }
  if (close >= 2 && nd < 150) { if (use('emp') || use('oil') || use('flare')) return; }
  const moving = Math.hypot(t.vx || 0, t.vy || 0) > 20, ch = chokeAt(w, t.x, t.y);
  if (moving && near && nd < 330) { // trail traps: behind us, toward the chasers; chokepoints get mines/snares
    const k = ch >= 3 ? (K.mine ? 'mine' : K.snare ? 'snare' : 'spike') : ['spike', 'mine', 'snare', 'bomb'].find(q => K[q] > 0); if (k && use(k)) return; }
  if (!moving && !tg && nd < 260 && nd > 120) { if (use('turret') || use('decoy')) return; }
  if (ch >= 4 && K.bomb > 0 && Math.random() < 0.3) use('bomb');
}
// generic bots: Molotov usage (all modes) — throw at slow/grouped/covered enemies inside 60–170 px when the turret is on target
export function moloBot(w, t, ai, tg) {
  if (!(t.molotovN > 0) || !tg || !tg.alive || (t.mlCd || 0) > w.time || Math.random() > 0.08) return;
  const d = Math.hypot(tg.x - t.x, tg.y - t.y); if (d < 55 || d > 170) return; const a = Math.atan2(tg.y - t.y, tg.x - t.x); if (Math.abs(ang((t.ta ?? t.a) - a)) > 0.2) return;
  let grp = 0; for (const o of w.tanks) if (o.alive && o.team === tg.team && o !== tg && Math.hypot(o.x - tg.x, o.y - tg.y) < 50) grp++;
  const slow = Math.hypot(tg.vx || 0, tg.vy || 0) < 25, hidden = !w.map.los(t.x, t.y, tg.x, tg.y);
  if (slow || grp || hidden || (tg.hp < tg.maxHp * 0.3)) { const lead = 0.6; t._mlD = Math.hypot(tg.x + (tg.vx || 0) * lead - t.x, tg.y + (tg.vy || 0) * lead - t.y); w.doAction(t, 'molotov_' + Math.round(t._mlD)); }
}
