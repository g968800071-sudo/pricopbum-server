import { brainThink, brainMove } from './brain.js';
import { bunkerBot } from './bunker.js';
import { mobaBot } from './moba.js';
import { humanize } from './human.js';
// Bot brains: target selection, lead aiming, strafing, obstacle avoidance, zone awareness.
import { T_SWAMP, T_BUSH, T_MUD, MUD_SEE, CELL, T_BRICK, T_CRATE, T_WATER, TANK_R, WEAPONS, PARTS, LOOT_SEE } from './defs.js';
function zoneHot(w, t) { if (w.mode !== 'br' || w.ffa || !w.zone) return false; const z = w.zone; return Math.hypot(t.x - z.cx, t.y - z.cy) > z.r * 0.9; }

const TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const PREF = { cannon: 120, twin: 110, mg: 85, rocket: 140, rail: 190, salvo: 130, heavy: 150, shotgun: 55, flame: 42, laser: 170, emp: 110, ricochet: 110, homing: 150, mortar: 175 };
const MEDS = { med: 1, med_s: 1, med_l: 1, repair: 1, med_team: 1 };
const DIRS8 = [0, 0.785, 1.571, 2.356, 3.142, 3.927, 4.712, 5.498];
// a nearby spot whose line of sight to (ex,ey) is blocked by a wall: cover to hide behind
function findCover(w, t, ex, ey) {
  let best = null, bd = 1e9;
  for (const r of [26, 44, 64]) for (const a of DIRS8) { const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r; if (blocked(w, x, y)) continue; if (w.map.los(x, y, ex, ey)) continue; const d = r + Math.hypot(x - ex, y - ey) * -0.1; if (d < bd) { bd = d; best = { x, y }; } }
  return best;
}
// incoming shell that will pass close to us: returns the angle to dodge to
function incoming(w, t) {
  let best = null, bt = 0.7;
  for (const b of w.bullets) { if (b.team === t.team || b.lob) continue; const rx = t.x - b.x, ry = t.y - b.y; if (rx * rx + ry * ry > 150 * 150) continue; const vv = b.vx * b.vx + b.vy * b.vy || 1, tt = (rx * b.vx + ry * b.vy) / vv; if (tt < 0 || tt > bt) continue; const cx = b.x + b.vx * tt - t.x, cy = b.y + b.vy * tt - t.y; if (cx * cx + cy * cy > (16 + (b.splash || 0) * 0.6) ** 2) continue; bt = tt; best = b; }
  if (!best) return null; const ba = Math.atan2(best.vy, best.vx), side = ((t.x - best.x) * -best.vy + (t.y - best.y) * best.vx) >= 0 ? 1 : -1; return ba + side * Math.PI / 2;
}
const tmp = [], tmpF = [], tmp2 = [];

function blocked(w, x, y) { if (w.map.tankBlockedAt(x, y, TANK_R + 1)) return true; const W = w.wrecks; if (W) for (let i = 0; i < W.length; i++) { const k = W[i]; if ((k.layer | 0) === (w._L | 0) && (x - k.x) ** 2 + (y - k.y) ** 2 < 256) return true; } return false; }
function steer(w, t, ang) {
  // pick a free direction close to desired
  for (const o of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.9, -1.9, 2.6, -2.6]) {
    const a = ang + o * (t.ai.side || 1), px = t.x + Math.cos(a) * 12, py = t.y + Math.sin(a) * 12;
    if (!blocked(w, px, py)) return a;
  }
  return ang + Math.PI;
}
function brickAhead(w, t, ang, dist = 14) {
  const x = t.x + Math.cos(ang) * dist, y = t.y + Math.sin(ang) * dist, v = w.map.get(Math.floor(x / CELL), Math.floor(y / CELL));
  return v === T_BRICK || v === T_CRATE;
}
function canSee(w, t, o, range) {
  if ((o.layer | 0) !== (t.layer | 0)) return false;
  if (o.cloaked) return false; // r26 «Невидимка»: bots lose the target
  if (o.fx && o.fx.stealth && (o.x - t.x) ** 2 + (o.y - t.y) ** 2 > 150 * 150 && w.time - o.lastFire > 1.5) return false; // perk/mod «Призрак»/«глушитель»
  if (o.wcov && (o.x - t.x) ** 2 + (o.y - t.y) ** 2 > 110 * 110 && w.time - o.lastFire > 1.2) return false; // wreck smoke: slight concealment
  range *= 1 + ((t.fx && t.fx.view) || 0) - ((o.fx && o.fx.camo && Math.hypot(o.vx || 0, o.vy || 0) < 8) ? o.fx.camo : 0); // r27 optics / radar extend sight; camo net shrinks it while standing still
  const dx = o.x - t.x, dy = o.y - t.y, d2 = dx * dx + dy * dy; if (d2 > range * range) return false;
  if (t.fx && t.fx.smokeSee && d2 < 140 * 140) return true; // thermal sight
  if (o.revT > 0 && o.revTeam === t.team) return true; // revealed by a friendly «Маяк»
  if (o.inBush && d2 > (o.seeR || 48) ** 2 && w.time - o.lastFire > 1.2) return false;
  if (o.terr === 1 && d2 > MUD_SEE * MUD_SEE * 2.5 && w.time - o.lastFire > 1.2) return false; // mud: partial concealment
  return true;
}

export function botThink(w, t, dt) {
  const ai = t.ai, inp = t.input; ai.t -= dt; ai.stuckT = (ai.stuckT || 0) + dt;
  if (ai.side === undefined) { ai.side = (t.id % 2) ? 1 : -1; ai.err = 0; ai.errT = 0; ai.lx = t.x; ai.ly = t.y; ai.wx = null; ai.strafe = 0; }
  const classic = w.mode === 'classic';
  if (ai.aggro === undefined) ai.aggro = 0.35 + Math.random() * 0.65;
  const ramp = w.ffa ? 1 : w.mode === 'br' ? Math.min(1, 0.3 + w.time / 420) : 1;
  const range = classic ? 420 : (w.mode === 'team' || w.ffa ? 260 : 210) * (0.8 + ai.skill * 0.4);
  const engageR = w.mode === 'br' && !w.ffa ? 50 + 190 * ramp * ai.aggro : 1e9;
  // periodic heavy think
  if (ai.t <= 0) {
    ai.t = 0.22 + ((t.id * 37) % 10) / 100;
    let best = null, bd = 1e12; tmp2.length = 0;
    if (!w.ffa) for (const f of w.near(t.x, t.y, 260, tmpF)) if (f !== t && f.alive && f.team === t.team) tmp2.push(f);
    for (const o of w.near(t.x, t.y, range, tmp)) {
      if (!o.alive || o.team === t.team || o.spawnT > 0) continue; if (!canSee(w, t, o, range)) continue;
      const d2 = (o.x - t.x) ** 2 + (o.y - t.y) ** 2 * 1; let score = d2 * (o.human && classic ? 0.5 : 1) * (o.hp < 40 ? 0.7 : 1) * (ai.tac !== false && ai.skill > 0.3 ? 0.55 + 0.45 * Math.min(1, (o.hp + (o.armorHp || 0)) / (o.maxHp || 100)) : 1); // r25: finish weak targets first
      if (o.id === ai.target) score *= 0.75; if (!w.ffa && ai.skill > 0.3) for (const f of tmp2) if (f.ai && f.ai.target === o.id) score *= 0.6; // focus fire with the squad
      if ((o.human || o.simHuman) && w.diff && w.diff.fc < 9) { let n = 0; for (const b of w.tanks) if (b !== t && b.alive && b.ai && b.team === t.team && b.ai.target === o.id) n++; if (n >= w.diff.fc && o.id !== ai.target) score *= 6; } // r19: cap bots ganging up on the player
      if (score < bd) { bd = score; best = o; }
    }
    let attacker = null;
    if (t.lastAtk && w.time - t.lastAtkT < 3) { const at = w.byId.get(t.lastAtk); if (at && at.alive && at.team !== t.team && Math.hypot(at.x - t.x, at.y - t.y) < 200) best = attacker = at; }
    ai.avoid = 0;
    if (best && best !== attacker && Math.hypot(best.x - t.x, best.y - t.y) > engageR) { ai.avoid = best.id; best = null; }
    if ((best ? best.id : 0) !== ai.target && best) ai.react = (0.7 - ai.skill * 0.56) * (0.7 + Math.random() * 0.6) + ((best.human || best.simHuman) && w.diff && w.diff.rd ? w.diff.rd : 0); // human-like reaction time (+ difficulty delay vs the player)
    { const cv = brainThink(w, t, ai, best); if (cv && !best) { best = cv; ai.react = 0.35 - ai.skill * 0.25; } }
    ai.target = best ? best.id : 0;
    ai.cover = best && ai.skill > 0.3 ? findCover(w, t, best.x, best.y) : null;
    // dodge: higher skill = more likely to notice the shell
    if (!classic && ai.dodge <= 0 && Math.random() < ai.skill * 1.05 - 0.1) { const da = incoming(w, t); if (da != null) { ai.dodge = 0.28 + ai.skill * 0.15; ai.dodgeA = da; } }
    // low HP: remember the nearest medkit
    ai.med = null; if (!classic && t.hp < t.maxHp * 0.4 && ai.skill > 0.2) { let md = LOOT_SEE * LOOT_SEE; for (const p of w.pickups) { if ((p.layer | 0) !== (t.layer | 0)) continue; if ((!MEDS[p.type] && p.type !== 'loot') || (ai.ign && ai.ign.has(p.id))) continue; const d2 = (p.x - t.x) ** 2 + (p.y - t.y) ** 2; if (d2 < md) { md = d2; ai.med = p; } } }
    // mines at chokepoints (narrow corridors) while roaming
    if (!best && t.mines && !classic && ai.skill > 0.25 && Math.random() < 0.08) { let n = 0; for (const a of [0, 1.571, 3.142, 4.712]) if (blocked(w, t.x + Math.cos(a) * 20, t.y + Math.sin(a) * 20)) n++; if (n >= 2) w.doAction(t, 'mine'); }
    // pinned under focus: pop smoke
    if (t.twinN && !classic) { const dB = best ? Math.hypot(best.x - t.x, best.y - t.y) : 1e9; if (best && dB < 200 && t.hp > t.maxHp * 0.4 && Math.random() < 0.05) w.doAction(t, 'twinr'); else if ((!best && Math.random() < 0.004) || (best && t.hp < t.maxHp * 0.4 && Math.random() < 0.05)) w.doAction(t, 'twintrap'); } // r25: fire twin rockets or leave them as a trap while retreating
    ai.trapAim = null; if (!best && w.traps && w.traps.length && !classic && ai.skill > 0.25) for (const T of w.traps) if (T.team !== t.team && (T.x - t.x) ** 2 + (T.y - t.y) ** 2 < 200 * 200) { ai.trapAim = T; break; } // r25: shoot enemy rocket traps
    if (t.invisN > 0 && !(t.invisCd > 0) && !(t.invisT > 0) && ai.skill > 0.3 && ((t.hp < t.maxHp * 0.4 && w.time - (t.lastAtkT || -9) < 1.5) || (best && ai.mode26 === 'flank' && Math.random() < 0.01))) w.doAction(t, 'invis'); // r26: cloak to escape when hurt, or to sneak into a flank
    if (best && (t.dronesN || t.ldronesN) && ai.skill > 0.25 && Math.random() < 0.04) w.doAction(t, t.ldronesN && t.hp < t.maxHp * 0.6 ? 'ldrone' : t.dronesN ? 'drone' : 'ldrone'); // r25: bots call drones in a fight
    if (best && t.smokes && ai.skill > 0.4 && t.hp < t.maxHp * 0.55 && w.time - (t.lastAtkT || -9) < 1 && Math.random() < 0.15) w.doAction(t, 'smoke');
    ai.clear = best ? w.map.los(t.x, t.y, best.x, best.y) : false;
    ai.st4 = (ai.st4 || 0) + dt; if (ai.st4 > 7) { // r19: long-window check catches bots that jitter in place (short check keeps resetting)
      if (ai.l4x !== undefined && Math.hypot(t.x - ai.l4x, t.y - ai.l4y) < 20 && (inp.mx || inp.my) && !t.rvg && !(ai.camp > 0)) {
        outer4: for (let r = 10; r <= 80; r += 7) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + r, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r; if (blocked(w, x, y)) continue; let ok = true; for (const o of w.tanks) if (o !== t && o.alive && (o.x - x) ** 2 + (o.y - y) ** 2 < (TANK_R * 2.2) ** 2) { ok = false; break; } if (ok) { t.x = x; t.y = y; ai.wx = null; ai.lootP = null; ai.stuckN = 0; break outer4; } } }
      ai.l4x = t.x; ai.l4y = t.y; ai.st4 = 0; }
    ai.dropT = (ai.dropT || 0) - dt; if (ai.dropT <= 0 && w.mode !== 'classic') { ai.dropT = 4 + Math.random() * 4; // r19: bots shed weight when overloaded (lowest-value items first)
      if (t.weapon && t.weapon !== (t.baseW || 'cannon') && (t.ammo || 0) > 8 && (t.mounts || []).filter(m => m.floor).length < 2 && t.lk < 0.5 && Math.random() < 0.5) w.doAction(t, 'mountw'); // r19: bots mount floor guns too
      if (t.lk > 0.35 && !(ai.target && ai.clear)) { const k = (t.mines || 0) > 2 ? 'drop_mine_1' : (t.smokes || 0) > 2 ? 'drop_smoke_1' : (t.meds || 0) > 2 ? 'drop_med_1' : t.shT && t.shA && t.shA[t.shT] > 20 ? 'drop_shl_10' : t.radar ? 'drop_radar_1' : (t.hrockets || 0) > 6 ? 'drop_hrocket_4' : null; if (k) w.doAction(t, k); } }
    // r22: long-window check — bots that jitter back and forth (pushing another tank) but go nowhere for 3 s count as stuck
    ai.wT = (ai.wT || 0) + dt; if (ai.wT > 3) { if (ai.wX != null && Math.hypot(t.x - ai.wX, t.y - ai.wY) < 10 && (inp.mx || inp.my)) { ai.stuckN = Math.max(ai.stuckN || 0, 4); ai.target = null; ai.wx = null; ai.lx = t.x; ai.ly = t.y; ai.stuckT = 1.01; } ai.wX = t.x; ai.wY = t.y; ai.wT = 0; }
    if (ai.stuckT > 1.0) {
      const moved = Math.hypot(t.x - ai.lx, t.y - ai.ly);
      if (moved < 6 && (inp.mx || inp.my)) { ai.side = -ai.side; ai.stuckN = (ai.stuckN || 0) + 1; ai.unstick = 0.8 + Math.min(1.2, ai.stuckN * 0.3); if (ai.stuckN > 1) { // escape: drive toward the most open direction
        let ba = Math.random() * TAU, bl = -1; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; let l = 0; for (let r = 6; r <= 72; r += 6) { if (blocked(w, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r)) break; l = r; } l += Math.random() * 5; if (l > bl) { bl = l; ba = a; } }
        if (ai.stuckN >= 5) { // r19: last resort for bots wedged by the larger hitbox: slide to the nearest free spot
          outer: for (let r = 10; r <= 70; r += 6) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + r, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r; if (blocked(w, x, y)) continue; let ok = true; for (const o of w.tanks) if (o !== t && o.alive && (o.x - x) ** 2 + (o.y - y) ** 2 < (TANK_R * 2.2) ** 2) { ok = false; break; } if (ok) { t.x = x; t.y = y; ai.stuckN = 0; ai.wx = null; break outer; } } }
        if (ai.stuckN > 3) { ai.lootP = null; ai.mem = null; } ai.escA = ba; ai.escT = 1.0 + ai.stuckN * 0.2; ai.wx = t.x + Math.cos(ba) * 140; ai.wy = t.y + Math.sin(ba) * 140; } else ai.wx = null; } else ai.stuckN = 0;
      ai.lx = t.x; ai.ly = t.y; ai.stuckT = 0;
    }
    // long-window oscillation guard: <12 px net progress in 4 s while trying to move → drop goal, pick a fresh open waypoint
    ai.lwT = (ai.lwT || 0) + dt; if (ai.lwT > 4) { const mv = ai.lwx == null ? 99 : Math.hypot(t.x - ai.lwx, t.y - ai.lwy);
      if (mv < 12 && (inp.mx || inp.my) && !(ai.camp > 0)) { ai.lootP = null; ai.mem = null; ai.med = null; let ba = Math.random() * TAU, bl = -1; for (let k = 0; k < 12; k++) { const a = Math.random() * TAU; let l = 0; for (let r = 8; r <= 120; r += 8) { if (blocked(w, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r)) break; l = r; } if (l > bl) { bl = l; ba = a; } }
        ai.escA = ba; ai.escT = 1.6; ai.wx = t.x + Math.cos(ba) * Math.max(40, bl); ai.wy = t.y + Math.sin(ba) * Math.max(40, bl); ai.lwN = (ai.lwN || 0) + 1; }
      ai.lwx = t.x; ai.lwy = t.y; ai.lwT = 0; }
    // pick up loot nearby when no fight
    const dry = t.ammo == null && t.shells === 0; // BR: out of shells -> go find ammo
    // broken part: actively look for the matching part pickup (or a repair kit) further away
    if (!classic && t.pbroke && !zoneHot(w, t)) { let pb = null, pd = LOOT_SEE ** 2; for (const p of w.pickups) { if ((p.layer | 0) !== (t.layer | 0)) continue; const need = p.type === 'repair' || (p.type.startsWith('part_') && (t.pbroke & (1 << PARTS.indexOf(p.type.slice(5))))) || p.type === 'loot'; if (!need) continue; const d2 = (p.x - t.x) ** 2 + (p.y - t.y) ** 2; if (d2 < pd) { pd = d2; pb = p; } } if (pb) { ai.wx = pb.x; ai.wy = pb.y; ai.lootP = pb; if (best && t.hp > t.maxHp * 0.5) { /* keep fighting but drift toward it */ } } }
    if ((!best || dry) && w.pickups.length && !classic) {
      let pb = null, pd = LOOT_SEE * LOOT_SEE; /* r25: bots only see loot as close as players do */
      for (const p of w.pickups) { if ((p.layer | 0) !== (t.layer | 0)) continue; const d2 = (p.x - t.x) ** 2 + (p.y - t.y) ** 2; if (d2 < pd) { pd = d2; pb = p; } }
      // decision delay before going for loot, longer for weak bots
      if (pb && pb.id !== ai.lootId) { ai.lootId = pb.id; ai.lootD = (0.25 + Math.random() * 0.9) * (1.3 - ai.skill); }
      if (pb && ai.lootD <= 0) { ai.wx = pb.x; ai.wy = pb.y; ai.lootP = pb; }
    }
  }
  ai.errT -= dt; if (ai.errT <= 0) { ai.errT = 0.4 + Math.random() * 0.5; ai.err = (Math.random() - 0.5) * (1.15 - ai.skill) * 0.6; const tg = ai.target && w.byId.get(ai.target); if (tg && tg.fx && tg.fx.decoy) ai.err += (Math.random() - 0.5) * tg.fx.decoy * 4; /* r27 decoy hologram */ if (tg && (tg.human || tg.simHuman) && w.diff && w.diff.ae) ai.err += (Math.random() - 0.5) * 2 * w.diff.ae; }
  if (ai.unstick > 0) ai.unstick -= dt; ai.react = (ai.react || 0) - dt; ai.dodge = (ai.dodge || 0) - dt; ai.lootD = (ai.lootD || 0) - dt; ai.peek = (ai.peek || 0) - dt;
  const tg = ai.target ? w.byId.get(ai.target) : null;
  let moveA = null, aimA = null, fire = false, speedK = 1;

  // ---- zone awareness (BR) ----
  let zoneUrgent = false;
  if (w.mode === 'br') {
    const z = w.zone, cx = z.state === 'shrink' || z.state === 'wait' ? z.tcx : z.cx, cy = z.state === 'shrink' || z.state === 'wait' ? z.tcy : z.cy;
    const dCur = Math.hypot(t.x - z.cx, t.y - z.cy), dTarget = Math.hypot(t.x - cx, t.y - cy);
    const safeR = (z.state === 'wait' ? z.tr : z.r) * 0.85;
    if (dCur > z.r - 12 || (z.state !== 'final' && dTarget > safeR && (z.state === 'shrink' || z.timer < 12))) { zoneUrgent = true; moveA = Math.atan2(cy - t.y, cx - t.x); }
  }

  if (tg && tg.alive) {
    const dx = tg.x - t.x, dy = tg.y - t.y, d = Math.hypot(dx, dy);
    const wp = WEAPONS[t.weapon] || WEAPONS.cannon, bs = wp.speed * t.bulletMul;
    const lead = wp.lob ? wp.life * 0.8 : wp.beam ? 0.05 : d / bs * (0.2 + ai.skill * 0.8);
    const px = tg.x + tg.vx * lead, py = tg.y + tg.vy * lead;
    aimA = Math.atan2(py - t.y, px - t.x) + ai.err;
    const brickBetween = !ai.clear;
    if (!zoneUrgent) {
      if (classic) {
        // classic: cardinal approach, line up on an axis with target; turret fixed to hull like the old days
        if (Math.abs(dx) < 10 || Math.abs(dy) < 10) moveA = Math.atan2(dy, dx); else moveA = Math.abs(dx) < Math.abs(dy) ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (Math.random() < 0.35 * dt * 10) moveA = Math.round(Math.random() * 4) * Math.PI / 2;
        const axis = Math.abs(dx) < 9 ? (dy > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.abs(dy) < 9 ? (dx > 0 ? 0 : Math.PI) : null;
        aimA = axis != null ? axis : t.a;
      } else {
        const pref = PREF[t.weapon] || 120;
        const base = Math.atan2(dy, dx);
        if (d > pref + 30 || brickBetween) moveA = base + ai.side * 0.35;
        else if (d < pref - 40) moveA = base + Math.PI - ai.side * 0.5;
        else { moveA = base + ai.side * Math.PI / 2; speedK = 0.75; }
        // flank: squad mates spread around the target instead of a straight line
        if (!w.ffa && ai.skill > 0.35 && d > pref - 40) moveA = base + ((t.id % 3) - 1) * 0.9 * ai.skill + ai.side * 0.2;
        // cover-peek cycle: hide behind a wall while reloading / hurt, step out to shoot
        const hurt = t.hp < t.maxHp * (0.35 + ai.skill * 0.25);
        if (ai.cover && (hurt || t.cd > 0.5) && ai.skill > 0.35) { if (ai.peek <= -1.1) ai.peek = 0.9 + Math.random() * 0.6; if (ai.peek > 0) { moveA = Math.atan2(ai.cover.y - t.y, ai.cover.x - t.x); speedK = 1; } }
        // retreat to a medkit (or away) when badly hurt
        if (ai.tac !== false && ai.skill > 0.3) { /* r25 tactics */
          // retreat-to-heal: drop a mine behind us while a chaser is close, use a medkit once out of line of fire
          if (t.hp < t.maxHp * 0.45 && d < 120 && t.mines && Math.random() < 0.03) w.doAction(t, 'mine');
          if (t.hp < t.maxHp * 0.5 && t.meds && w.time - (t.lastAtkT || -9) > 1.2) w.doAction(t, 'med');
          // reload window: after a cannon shot, back off / sidestep instead of sitting in the open (bait & retreat)
          if (t.weapon === 'cannon' && t.cd > 0.6 && !ai.cover && d < 200 && ai.skill > 0.45) { moveA = base + Math.PI + ai.side * 0.7; speedK = 0.85; }
          // turret / blocks at the right time: when fighting at mid range and not already fortified
          if (d > 60 && d < 220 && Math.random() < 0.01) { if (t.sentryN) w.doAction(t, 'sentry'); else if (t.blocksN && t.hp < t.maxHp * 0.6) w.doAction(t, 'blocks'); }
          // squad: share a medkit with a badly hurt ally standing next to us
          if (!w.ffa && t.meds > 1) for (const f of tmp2) if (f.alive && f.hp < f.maxHp * 0.35 && (f.meds || 0) === 0 && (f.x - t.x) ** 2 + (f.y - t.y) ** 2 < 45 * 45) { t.meds--; f.meds = (f.meds || 0) + 1; w.ev({ k: 'share', id: t.id, to: f.id, it: 'med' }); break; } }
        if (ai.tac !== false && ai.skill > 0.8 && !ai.cover) { /* r26 elite tactics (Очень сложный / Невыносимый) — no extra knowledge, only what canSee already gave us */
          const facing = Math.abs(angDiff(tg.ta ?? tg.a, Math.atan2(t.y - tg.y, t.x - tg.x))) < 0.5; ai.mode26 = ai.mode26 || ((t.id % 3) === 0 ? 'bait' : (t.id % 3) === 1 ? 'flank' : 'ambush');
          if (ai.mode26 === 'flank' && d > 70 && d < 240) { const bx = tg.x - Math.cos(tg.a) * 90, by = tg.y - Math.sin(tg.a) * 90; moveA = Math.atan2(by - t.y, bx - t.x) + (facing ? ai.side * 0.5 : 0); speedK = 1; } // flank: swing to the target's rear (rear hits ×1.45)
          else if (ai.mode26 === 'ambush' && !facing && d > 110 && d < 210 && w.map.get(Math.floor(t.x / CELL), Math.floor(t.y / CELL)) === T_BUSH) { speedK = 0; ai.holdFire = true; } // ambush: sit still in a bush, hold fire until it comes close
          else if (ai.mode26 === 'bait' && !w.ffa && d < 160) { let cx = 0, cy = 0, n = 0; for (const f of tmp2) if (f.alive && f !== t && (f.x - t.x) ** 2 + (f.y - t.y) ** 2 < 260 * 260) { cx += f.x; cy += f.y; n++; } if (n) { moveA = Math.atan2(cy / n - t.y, cx / n - t.x); speedK = 0.8; } } // bait: show yourself, then drag the chaser into your squad
          if (ai.holdFire && (d < 110 || facing)) ai.holdFire = false; }
        if (t.hp < t.maxHp * 0.3 && ai.skill > 0.3) { if (ai.med) { moveA = Math.atan2(ai.med.y - t.y, ai.med.x - t.x); speedK = 1; } else if (d < 170) moveA = base + Math.PI + ai.side * 0.4; }
        // flee from smoke clouds we are not hiding in on purpose
        if (w.inSmoke(tg.x, tg.y) && d < 90) moveA = base + Math.PI + ai.side * 0.6;
      }
    }
    const aligned = Math.abs(angDiff(t.ta, aimA)) < 0.16 + (1 - ai.skill) * 0.1;
    const wpR = WEAPONS[t.weapon] || {}, maxR = wpR.speed ? Math.min(range, wpR.speed * wpR.life * 1.05) : range;
    fire = aligned && (ai.clear || d < 110 || wpR.lob || (wpR.bounce && d < 160)) && d < maxR && ai.react <= 0;
    if (wpR.splash && d < wpR.splash + 18) fire = false; // never self-splash
    if (ai.holdFire) fire = false; // r26 ambush
    if (fire && ai.skill < 0.3 && Math.random() < 0.25) fire = false; // weak bots hesitate
    if (classic) fire = aligned && Math.random() < 0.5;
  } else if (!zoneUrgent) {
    // wander
    if (classic) {
      const base = w.map.base;
      if (ai.wx == null || Math.random() < dt * 0.25) {
        if (Math.random() < 0.55) { ai.wx = base.x + (Math.random() - 0.5) * 60; ai.wy = base.y - 10; } else { ai.wx = 20 + Math.random() * (w.map.pw - 40); ai.wy = 20 + Math.random() * (w.map.ph - 40); }
      }
    } else if (w.mode === 'team') {
      if (ai.wx == null || Math.hypot(ai.wx - t.x, ai.wy - t.y) < 30) { const enemyX = t.team === 0 ? w.map.pw * 0.8 : w.map.pw * 0.2; ai.wx = enemyX + (Math.random() - 0.5) * w.map.pw * 0.5; ai.wy = 30 + Math.random() * (w.map.ph - 60); }
    } else if (w.ffa) {
      // hunt: head for the nearest living enemy (refresh every couple of seconds)
      ai.huntT = (ai.huntT || 0) - dt;
      if (ai.wx == null || ai.huntT <= 0 || Math.hypot(ai.wx - t.x, ai.wy - t.y) < 30) { ai.huntT = 1.5 + Math.random() * 1.5; let bd = 1e18, bx = null, by = 0;
        for (const o of w.tanks) { if (!o.alive || o === t) continue; const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d < bd) { bd = d; bx = o.x; by = o.y; } }
        if (bx != null) { ai.wx = bx + (Math.random() - 0.5) * 60; ai.wy = by + (Math.random() - 0.5) * 60; } else { ai.wx = Math.random() * w.map.pw; ai.wy = Math.random() * w.map.ph; } }
    } else {
      const z = w.zone || { state: 'final', cx: w.map.pw / 2, cy: w.map.ph / 2, r: Math.max(w.map.pw, w.map.ph) };
      if (ai.wx == null || Math.hypot(ai.wx - t.x, ai.wy - t.y) < 30) {
        // roam locally, but stay inside the safe circle we are heading for
        const zx = z.state === 'final' ? z.cx : z.tcx, zy = z.state === 'final' ? z.cy : z.tcy, zr = Math.max(30, (z.state === 'final' ? z.r : z.tr) * 0.8);
        for (let k = 0; k < 6; k++) { const a = Math.random() * TAU, r = 80 + Math.random() * 200; ai.wx = t.x + Math.cos(a) * r; ai.wy = t.y + Math.sin(a) * r; if (Math.hypot(ai.wx - zx, ai.wy - zy) < zr || Math.hypot(t.x - zx, t.y - zy) > zr) break; }
        // ambush: sometimes settle into a nearby swamp inside the safe circle and wait
        if (Math.random() < 0.25 + (t.ai.skill || 0.5) * 0.3) { for (let k = 0; k < 10; k++) { const a = Math.random() * TAU, r = 30 + Math.random() * 160, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r; if (w.map.get(Math.floor(x / CELL), Math.floor(y / CELL)) === T_SWAMP && Math.hypot(x - zx, y - zy) < zr) { ai.wx = x; ai.wy = y; ai.campT = 6 + Math.random() * 8; break; } } }
        if (Math.hypot(t.x - zx, t.y - zy) > zr && Math.random() < 0.5) { const a = Math.random() * TAU, r = Math.random() * zr * 0.8; ai.wx = zx + Math.cos(a) * r; ai.wy = zy + Math.sin(a) * r; }
      }
    }
    moveA = Math.atan2(ai.wy - t.y, ai.wx - t.x);
    if (w.mode === 'br') {
      const av = ai.avoid ? w.byId.get(ai.avoid) : null;
      if (av && av.alive) moveA = Math.atan2(t.y - av.y, t.x - av.x) + ai.side * 0.5;
      else if (ai.camp > 0 && !w.ffa) { ai.camp -= dt; moveA = null; if (ai.lootP && ai.skill > 0.4) aimA = Math.atan2(ai.lootP.y - t.y, ai.lootP.x - t.x); }
      speedK = 0.7;
    }
    if (moveA != null && classic) { const q = Math.round(moveA / (Math.PI / 2)) * (Math.PI / 2); moveA = q; }
    if (ai.wx != null && Math.hypot(ai.wx - t.x, ai.wy - t.y) < 32) { ai.wx = null; if (w.mode === 'br' && Math.random() < 0.55 && (ai.cpx == null || Math.hypot(t.x - ai.cpx, t.y - ai.cpy) > 120)) { ai.camp = 2 + Math.random() * 6; ai.cpx = t.x; ai.cpy = t.y; } } // no re-camping on the same spot
    // shoot obstacles in the way occasionally
    if (brickAhead(w, t, t.a) && (classic ? Math.random() < 0.08 : ai.unstick > 0)) { aimA = t.a; fire = true; }
    if (classic && Math.random() < 0.01) { aimA = t.a; fire = true; }
  }
  if (t.zombie) { fire = false; aimA = null; if (tg && tg.alive) moveA = Math.atan2(tg.y - t.y, tg.x - t.x); else { let bd = 1e18, b = null; for (const o of w.tanks) { if (!o.alive || o.team === t.team) continue; const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d < bd) { bd = d; b = o; } } if (b) moveA = Math.atan2(b.y - t.y, b.x - t.x); } speedK = 1; }
  else if (w.special === 'race') { const c = w.map.checkpoints[t.cp]; if (c) { moveA = Math.atan2(c[1] - t.y, c[0] - t.x); speedK = 1; } }
  else if (w.flags) { const mine = w.flags[t.team], theirs = w.flags[1 - t.team], carrying = theirs.carrier === t.id; let gx = null, gy = 0;
    if (carrying) { gx = mine.hx; gy = mine.hy; }
    else if (!mine.home && !mine.carrier && Math.hypot(mine.x - t.x, mine.y - t.y) < 300) { gx = mine.x; gy = mine.y; }
    else if (mine.carrier && t.id % 2 === 0) { const c = w.byId.get(mine.carrier); if (c) { gx = c.x; gy = c.y; } }
    else if (t.id % 3 === 0) { if (!tg && Math.hypot(mine.hx - t.x, mine.hy - t.y) > 70) { gx = mine.hx; gy = mine.hy; } }
    else if (theirs.carrier) { const c = w.byId.get(theirs.carrier); if (c && !tg) { gx = c.x + 20; gy = c.y; } }
    else { gx = theirs.x; gy = theirs.y; }
    if (gx != null) { moveA = Math.atan2(gy - t.y, gx - t.x); speedK = 1; } }
  else if (w.hill && !tg && Math.random() < 0.9) { const H = w.hill; if (Math.hypot(H.x - t.x, H.y - t.y) > H.r * 0.6) moveA = Math.atan2(H.y - t.y, H.x - t.x); }
  else if (t.wave && !tg) { let bd = 1e18, b = null; for (const o of w.tanks) { if (!o.alive || o.team === t.team) continue; const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d < bd) { bd = d; b = o; } } if (b) moveA = Math.atan2(b.y - t.y, b.x - t.x); }
  ai.escT = (ai.escT || 0) - dt; if (ai.escT > 0 && w.special !== 'race') { moveA = ai.escA; speedK = 1; ai.unstick = 0; }
  else if (ai.dodge > 0 && !zoneUrgent && !t.zombie && !classic && w.special !== 'race') { moveA = ai.dodgeA; speedK = 1; }
  if (ai.unstick > 0 && moveA != null) moveA += ai.side * 1.2;
  if (w.special === 'moba' && !t.layer) { const r = mobaBot(w, t, ai, tg && tg.alive ? tg : null); if (r) { if (r.moveA != null) { moveA = r.moveA; speedK = r.speedK ?? speedK; } if (r.aimA != null) { aimA = r.aimA; fire = r.fire; } } }
  if (w.under && !classic && (w.special !== 'moba' || t.id % 4 === 0)) { const near = tg && tg.alive && Math.hypot(tg.x - t.x, tg.y - t.y) < 200 ? tg : null; const r = bunkerBot(w, t, ai, near); if (r) { if (r.act) w.doAction(t, r.act); else { moveA = r.moveA; speedK = r.speedK ?? speedK; } } }
  if (!classic && w.special !== 'race' && !t.zombie && !(ai.escT > 0) && !(ai.dodge > 0 && !t.rvg)) { const r = brainMove(w, t, ai, tg && tg.alive ? tg : null, dt); if (r) { if (r.hold) { moveA = null; if (r.fire === false) fire = false; } else if (r.moveA != null) { moveA = r.moveA; speedK = r.speedK ?? speedK; } if (r.aimA != null && !fire) aimA = r.aimA; } }
  // r25: bots know the water rule — leave water before the 30 s safe window runs out
  if ((t.wT || 0) > 17 && w.special !== 'race') { if (!(ai.wQ > 0) || ai.wA == null) { ai.wQ = 1; let best = null, bd = 1e9; for (let r = 1; r <= 14 && !best; r++) for (let k = 0; k < 16; k++) { const A = k / 16 * Math.PI * 2, x = t.x + Math.cos(A) * r * CELL, y = t.y + Math.sin(A) * r * CELL, v = w.map.get(Math.floor(x / CELL), Math.floor(y / CELL)); if (v !== T_WATER && v != null && !w.map.tankBlockedAt(x, y, TANK_R) && r < bd) { bd = r; best = A; } } ai.wA = best; } ai.wQ -= dt; if (ai.wA != null) { moveA = ai.wA; speedK = 1; } } else ai.wA = null;
  if (ai.trapAim && aimA == null || ai.trapAim && !fire) { const T = ai.trapAim; if (w.traps.includes(T)) { aimA = Math.atan2(T.y - t.y, T.x - t.x); fire = true; } }
  if (moveA != null) {
    let a = steer(w, t, moveA);
    if (tg && !classic && t.terr !== 2) { const ax = t.x + Math.cos(a) * 18, ay = t.y + Math.sin(a) * 18, cv = w.map.get(Math.floor(ax / CELL), Math.floor(ay / CELL)); if (cv === T_SWAMP || cv === T_MUD) a += ai.side * 0.8; } // chasing: skirt slow terrain
    if (brickAhead(w, t, moveA) && !tg && (classic ? Math.random() < 0.3 : ai.unstick > 0)) { aimA = moveA; fire = true; }
    if (classic) { const q = Math.round(a / (Math.PI / 2)) * (Math.PI / 2); if (!w.map.tankBlockedAt(t.x + Math.cos(q) * 10, t.y + Math.sin(q) * 10, TANK_R)) a = q; }
    inp.mx = Math.cos(a) * speedK; inp.my = Math.sin(a) * speedK;
  } else { inp.mx = inp.my = 0; }
  if (aimA != null) { inp.aim = true; inp.ax = Math.cos(aimA); inp.ay = Math.sin(aimA); } else inp.aim = false;
  inp.fire = fire;
  if (classic && aimA == null) { inp.aim = false; }
  if (!classic) humanize(w, t, dt);
}
