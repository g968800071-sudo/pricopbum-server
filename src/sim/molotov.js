// r36 «Ящик с огнём»: 8 Molotov cocktails. Arc throw along the turret aim, shatters into a burning patch (damage over
// time to enemies standing in it — same damage() path and rules for bots and players).
export const ML_N = 8, ML_RANGE = 170, ML_MIN = 50, ML_FLY = 0.75, ML_FIRE_T = 6, ML_FIRE_R = 30, ML_DPS = 9, ML_CD = 0.9;
export function mlThrow(w, t, dist) {
  if (!(t.molotovN > 0) || (t.mlCd || 0) > w.time) return false;
  const a = t.ta ?? t.a ?? 0; let d = dist;
  if (d == null) { const tg = w.autoTarget ? w.autoTarget(t, ML_RANGE + 20) : null; d = tg ? Math.hypot(tg.x - t.x, tg.y - t.y) : ML_RANGE * 0.8; }
  d = Math.max(ML_MIN, Math.min(ML_RANGE, d)); let tx = t.x + Math.cos(a) * d, ty = t.y + Math.sin(a) * d;
  const m = w.map; tx = Math.max(12, Math.min(m.w * 8 - 12, tx)); ty = Math.max(12, Math.min(m.h * 8 - 12, ty));
  (w.molos || (w.molos = [])).push({ id: w.id(), x0: t.x, y0: t.y, x: t.x, y: t.y, tx, ty, t: 0, T: ML_FLY * (0.6 + d / ML_RANGE * 0.4), owner: t.id, team: t.team });
  t.molotovN--; t.mlCd = w.time + ML_CD; w.ev({ k: 'molo', s: 'throw', id: t.id, x: t.x, y: t.y }); return true;
}
export function mlStep(w, dt) {
  const M = w.molos; if (M && M.length) for (let i = M.length - 1; i >= 0; i--) { const q = M[i]; q.t += dt; const k = Math.min(1, q.t / q.T); q.x = q.x0 + (q.tx - q.x0) * k; q.y = q.y0 + (q.ty - q.y0) * k; q.h = Math.sin(k * Math.PI) * 26;
    if (k >= 1) { M.splice(i, 1); (w.fires || (w.fires = [])).push({ id: w.id(), x: q.tx, y: q.ty, r: ML_FIRE_R, t: ML_FIRE_T, max: ML_FIRE_T, owner: q.owner, team: q.team }); w.ev({ k: 'molo', s: 'boom', x: q.tx, y: q.ty }); } }
  const F = w.fires; if (!F || !F.length) return;
  for (let i = F.length - 1; i >= 0; i--) { const f = F[i]; f.t -= dt; if (f.t <= 0) { F.splice(i, 1); continue; }
    for (const t of w.tanks) { if (!t.alive || (t.team === f.team && w.mode !== 'ffa' && t.id !== f.owner) || t.id === f.owner) continue; if ((t.x - f.x) ** 2 + (t.y - f.y) ** 2 > (f.r + 6) ** 2) continue;
      t.fireAcc = (t.fireAcc || 0) + ML_DPS * dt; if (t.fireAcc >= 3) { const a = t.fireAcc; t.fireAcc = 0; w.damage(t, a, f.owner, 'fire', t.x, t.y); } t.inFireT = w.time; }
  }
}
// bots: is a point inside any enemy fire?
export function mlDanger(w, t, x, y) { const F = w.fires; if (!F) return false; for (const f of F) if (f.owner !== t.id && (x - f.x) ** 2 + (y - f.y) ** 2 < (f.r + 10) ** 2) return true; return false; }
