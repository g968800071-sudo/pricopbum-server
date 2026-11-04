// r19: carried weight. Everything in the inventory weighs something; past FREE kg the tank gets slower, the turret
// traverses slower and shots spread more. Dropping items («Выбросить») makes it lighter again. Shared by sim and HUD.
export const W_FREE = 10, W_MAX = 60; // r25: cargo 30 → 60 kg (progressive slowdown in sim.js)
export function weightOf(t) {
  let w = 0; if (t.weapon && t.weapon !== 'cannon') w += 3 + (t.wtier || 1) * 0.5;
  if (t.armorT) w += t.armorT * 1.6; w += (t.meds || 0) * 1 + (t.smokes || 0) * 0.6 + (t.mines || 0) * 1.5 + (t.hrockets || 0) * 0.5;
  if (t.sentryN) w += 4; if (t.blocksN) w += 5; if (t.tur != null) w += 1 + (t.tur % 50 >= 43 ? 1.5 : 0.5); /* r20: turret */ if (t.mounts) for (const m of t.mounts) if (m.floor) w += 3 + 0.5 * (m.tier || 1); /* r19: mounted floor weapons */ if (t.rkA) for (const n of t.rkA) w += (n || 0) * 1.2; if (t.shA) for (let i = 1; i < t.shA.length; i++) w += (t.shA[i] || 0) * 0.04;
  if (t.shells != null) w += Math.max(0, t.shells - 30) * 0.05; if (t.ammo != null && t.weapon !== 'cannon') w += Math.min(40, t.ammo) * 0.03;
  if (t.gearS) w += Object.keys(t.gearS).length * 1.3; w += (t.modN || 0) * 0.8; // r25: fitted parts + mods weigh
  let m = t.mods || 0; while (m) { w += m & 1; m >>>= 1; } w += (t.beacons || 0) + (t.radar || 0) + (t.revives || 0) * 2;
  return Math.round(w * 10) / 10;
}
// 0 = no penalty, 1 = fully overloaded
export function loadK(t) { return Math.max(0, Math.min(1, (weightOf(t) - W_FREE) / (W_MAX - W_FREE))); }
