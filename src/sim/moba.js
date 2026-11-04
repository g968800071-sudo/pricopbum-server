import { MAPS } from './maps.js';
// r15: «Оборона баз» — DOTA-like base defence. 2 teams x 30 tanks, 3 lanes + jungle, 9 towers + HQ per team,
// tiered tower vulnerability, lane-pushing bot waves, growing respawn timers, team gold + base shop, base healing,
// sudden death at 20:00, hard cap 25:00 (HQ HP decides).
import { CELL, T_EMPTY, T_BRICK, T_STEEL, T_BUSH, T_CRATE, T_MUD, T_SWAMP, T_WATER } from './defs.js';
import { TileMap } from './map.js';
import { makeRng } from './rng.js';

export const MOBA = { W: 300, H: 180, towerHp: 950, hqHp: 1500, towerR: 112, towerDmg: 13, towerCd: 1.1, healR: 130, sudden: 1200, limit: 1500, gTower: 300, gKill: 25 };
export const MSHOP = { dmg: { n: 'Урон +10%', c: 150 }, arm: { n: 'Броня +10%', c: 150 }, spd: { n: 'Скорость +5%', c: 120 } };
const LANE_Y = [22, 90, 158];

export function genMoba(seed, mapIdx = -1) {
  const { W, H } = MOBA, m = new TileMap(W, H), rng = makeRng(seed ^ 0x5eed), half = W / 2;
  const put = (c, r, v) => { m.set(c, r, v, true); m.set(W - 1 - c, r, v, true); };
  const onLane = (c, r) => LANE_Y.some(y => Math.abs(r - y) < 8) || (c < 30 && r > 14 && r < H - 14) || (c > 26 && c < 34);
  // border
  for (let c = 0; c < W; c++) { m.set(c, 0, T_STEEL, true); m.set(c, H - 1, T_STEEL, true); } for (let r = 0; r < H; r++) { m.set(0, r, T_STEEL, true); m.set(W - 1, r, T_STEEL, true); }
  // jungle between lanes: walls, bushes, swamps, mud, crates (mirrored so both sides are fair)
  for (let i = 0; i < 260; i++) { const c = rng.int(36, half - 2), r = rng.int(4, H - 4); if (onLane(c, r)) continue; const len = rng.int(2, 7), hz = rng() < 0.5, v = rng() < 0.25 ? T_STEEL : T_BRICK; for (let k = 0; k < len; k++) { const cc = hz ? c + k : c, rr = hz ? r : r + k; if (!onLane(cc, rr) && cc < half) put(cc, rr, v); } }
  const blob = (cx, cy, rad, v, only) => { for (let r = cy - rad; r <= cy + rad; r++) for (let c = cx - rad; c <= cx + rad; c++) if (Math.hypot(c - cx, r - cy) < rad * (0.8 + rng() * 0.3) && c < half && (!only || m.get(c, r) === T_EMPTY) && !onLane(c, r)) put(c, r, v); };
  for (let i = 0; i < 40; i++) blob(rng.int(36, half - 4), rng.int(6, H - 6), rng.int(2, 4), T_BUSH, true);
  for (let i = 0; i < 14; i++) { const c = rng.int(40, half - 6), r = rng.int(30, H - 30); blob(c, r, rng.int(5, 8), T_MUD, false); blob(c, r, rng.int(2, 5), T_SWAMP, false); }
  for (let i = 0; i < 60; i++) { const c = rng.int(36, half - 3), r = rng.int(5, H - 5); if (!onLane(c, r) && m.get(c, r) === T_EMPTY) { put(c, r, T_CRATE); put(c + 1, r, T_CRATE); } }
  // river through the middle with two mud fords per lane gap
  for (let r = 1; r < H - 1; r++) for (const c of [half - 1, half]) if (!LANE_Y.some(y => Math.abs(r - y) < 8)) m.set(c, r, (r % 30) < 6 ? T_MUD : T_WATER, true);
  // bases: brick walls with gaps toward the 3 lanes
  for (const side of [0, 1]) { const bx = side ? W - 20 : 6; for (let r = 60; r < 120; r++) for (const c of [bx, bx + 14]) if (!(r > 84 && r < 96) && !(r > 60 && r < 66) && !(r > 114 && r < 120)) m.set(c, r, T_BRICK, true); }
  m.spawns = [[], []]; for (let k = 0; k < 10; k++) { const x = (10 + (k % 2) * 3) * CELL, y = (78 + Math.floor(k / 2) * 6) * CELL; m.spawns[0].push([x, y]); m.spawns[1].push([m.pw - x, y]); }
  // tower sites: per lane outer / inner / base
  m.towers = []; const TX = [0.36, 0.24, 0.12];
  for (const team of [0, 1]) for (let lane = 0; lane < 3; lane++) for (let tier = 0; tier < 3; tier++) {
    let x = TX[tier] * W, y = tier === 2 ? 90 + (lane - 1) * 22 : LANE_Y[lane]; if (tier === 2) x = 26; if (team) x = W - 1 - x;
    m.towers.push({ team, lane, tier, c: Math.round(x), r: Math.round(y) }); }
  for (const T of m.towers) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m.set(T.c + a - 1, T.r + b - 1, T_STEEL, true);
  m.hq = [{ team: 0, c: 12, r: 90 }, { team: 1, c: W - 13, r: 90 }]; for (const q of m.hq) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) m.set(q.c + a, q.r + b, T_STEEL, true);
  // lanes for the AI: own base -> lane -> enemy base
  m.lanes = [0, 1].map(team => LANE_Y.map((y, lane) => { const xs = [14, 30, W - 31, W - 15], pts = [[xs[0], 90], [xs[1], y], [xs[2], y], [xs[3], 90]].map(([c, r]) => [c * CELL, r * CELL]); if (lane === 1) pts.splice(1, 2, [W * 0.5 * CELL, 90 * CELL]); return team ? pts.slice().reverse() : pts; }));
  m.theme = { ground: '#5d6b3e', g2: '#6f7d48', g3: '#4f5c34' }; m.mapName = 'Оборона баз'; m.mapId = 'moba';
  if (mapIdx >= 0 && MAPS[mapIdx % MAPS.length]) { const D = MAPS[mapIdx % MAPS.length]; m.theme = { ground: D.g[0], g2: D.g[1], g3: D.g[2] }; m.mapName = 'Оборона баз · ' + D.name; m.mapId = 'moba-' + D.id; } // r25: MOBA lanes on every map theme
  return m;
}

export function initMoba(w) {
  const m = w.map, hpK = w.opts.hpMul ?? 2.4; w.gold = [0, 0]; w.timeLimit = MOBA.limit + 5; w.target = 1e9;
  w.towers = m.towers.map((T, i) => ({ id: 9000 + i, team: T.team, lane: T.lane, tier: T.tier, x: (T.c) * CELL, y: (T.r) * CELL, hp: MOBA.towerHp, maxHp: MOBA.towerHp, cd: 1, alive: true, hitT: -9 }));
  for (const q of m.hq) w.towers.push({ id: 9100 + q.team, team: q.team, hq: true, lane: -1, tier: 3, x: q.c * CELL + 4, y: q.r * CELL + 4, hp: MOBA.hqHp, maxHp: MOBA.hqHp, cd: 1, alive: true, hitT: -9 });
  for (const t of w.tanks) { t.mu = { dmg: 0, arm: 0, spd: 0 }; if (!t.human && t.ai) t.ai.lane = t.id % 3; }
  void hpK; const rng = w.rng; let n = 0;
  for (let k = 0; k < 400 && n < 26; k++) { const c = rng.int(36, m.w - 37), r = rng.int(5, m.h - 6); if (m.get(c, r) !== T_EMPTY && m.get(c, r) !== T_BUSH) continue; if (LANE_Y.some(y => Math.abs(r - y) < 8)) continue; w.dropLoot(c * CELL + 4, r * CELL + 4); n++; }
  for (const c of [rng.int(60, 130), m.w - 1 - rng.int(60, 130)]) w.pickups.push({ id: w.id(), x: c * CELL + 4, y: rng.int(40, 140) * CELL + 4, type: 'beacon', wid: null, tier: 1, t: 0, life: 1e9 });
}
// DOTA rule: a tower is damageable only once the previous tier of its lane is down; HQ once any base tower is down (sudden death: all)
export function towerVulnerable(w, T) {
  if (!T.alive) return false; if (w.time >= MOBA.sudden) return true;
  if (T.hq) return w.towers.some(o => o.team === T.team && o.tier === 2 && !o.alive);
  if (T.tier === 0) return true; return !w.towers.some(o => o.team === T.team && o.lane === T.lane && o.tier === T.tier - 1 && o.alive);
}
export function damageTower(w, T, amount, ownerId) {
  if (!towerVulnerable(w, T)) { w.ev({ k: 'hit', x: T.x, y: T.y, s: 0, inv: 1 }); return; }
  const o = w.byId.get(ownerId); if (o && o.team === T.team) return; // no friendly fire
  T.hp -= amount * (w.time >= MOBA.sudden && T.hq ? 3 : 1); T.hitT = w.time;
  if (T.hp <= 0) { T.hp = 0; T.alive = false; const tm = 1 - T.team; w.gold[tm] += T.hq ? 0 : MOBA.gTower; w.ev({ k: 'tower', id: T.id, team: T.team, hq: !!T.hq, tier: T.tier, x: T.x, y: T.y }); w.ev({ k: 'boom', x: T.x, y: T.y, s: 3, tank: true, conc: 80 });
    if (T.hq) w.finish({ winnerTeam: tm, hq: true }); }
}
export function bulletHitsTower(w, b) {
  if (!w.towers) return false; for (const T of w.towers) { if (!T.alive || T.team === b.team) continue; const r = T.hq ? 14 : 10; if ((b.x - T.x) ** 2 + (b.y - T.y) ** 2 < r * r) { damageTower(w, T, b.dmg, b.owner); return true; } } return false;
}
export function stepMoba(w, dt) {
  for (const T of w.towers) T.vul = towerVulnerable(w, T);
  for (const T of w.towers) { if (!T.alive) continue; T.cd -= dt; if (T.cd > 0) continue; let best = null, bd = MOBA.towerR * MOBA.towerR;
    for (const t of w.near(T.x, T.y, MOBA.towerR, [])) { if (!t.alive || t.team === T.team || t.spawnT > 0 || (t.sub && !(t.revT > 0))) continue; const d2 = (t.x - T.x) ** 2 + (t.y - T.y) ** 2; if (d2 < bd) { bd = d2; best = t; } }
    if (!best) continue; T.cd = MOBA.towerCd; const a = Math.atan2(best.y - T.y, best.x - T.x), sp = 260;
    w.bullets.push({ id: w.id(), x: T.x + Math.cos(a) * 12, y: T.y + Math.sin(a) * 12, px: T.x, py: T.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: MOBA.towerDmg * (T.hq ? 1.5 : 1) * (w.opts.hpMul ?? 2.4) / 2.4 * 2.4, owner: T.id, team: T.team, w: 'cannon', life: MOBA.towerR / sp + 0.15, tower: 1 });
    w.ev({ k: 'shot', id: T.id, x: T.x, y: T.y, w: 'heavy' }); }
  // base fountain heals allies
  for (const q of w.towers) { if (!q.hq || !q.alive) continue; for (const t of w.near(q.x, q.y, MOBA.healR, [])) if (t.alive && t.team === q.team && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.1 * dt); }
  // bots spend team gold at base
  for (const t of w.tanks) if (t.alive && !t.human && t.ai && w.gold[t.team] >= 150 && atBase(w, t) && Math.random() < dt) buyMoba(w, t, ['dmg', 'arm', 'spd'][Math.floor(Math.random() * 3)]);
  if (!w.sdAnn && w.time >= MOBA.sudden) { w.sdAnn = 1; w.ev({ k: 'sudden' }); }
  if (w.time >= MOBA.limit && !w.result) { const hq = [0, 1].map(tm => w.towers.find(T => T.hq && T.team === tm).hp); w.finish({ winnerTeam: hq[0] === hq[1] ? -1 : hq[0] > hq[1] ? 0 : 1, timeout: true }); }
}
export function atBase(w, t) { const q = w.towers && w.towers.find(T => T.hq && T.team === t.team); return !!q && (t.x - q.x) ** 2 + (t.y - q.y) ** 2 < MOBA.healR * MOBA.healR; }
export function buyMoba(w, t, k) { const S = MSHOP[k]; if (!S || !t.mu || !atBase(w, t)) return false; const lvl = t.mu[k], cost = S.c * (lvl + 1); if (lvl >= 5 || w.gold[t.team] < cost) return false;
  w.gold[t.team] -= cost; t.mu[k]++; if (k === 'dmg') t.dmgMul = (t.dmgMul || 1) * 1.1; else if (k === 'arm') t.armMul = (t.armMul || 1) * 1.1; else t.speed *= 1.05; w.ev({ k: 'mbuy', id: t.id, it: k, lv: t.mu[k] }); return true; }
export function mobaRespawn(w) { return Math.min(30, 5 + w.time / 50); }
// bot lane logic: push the lane, hit vulnerable towers, defend own towers, go home to heal
export function mobaBot(w, t, ai, tg) {
  const lanes = w.map.lanes[t.team][ai.lane ?? (t.id % 3)];
  if (t.hp < t.maxHp * 0.3 || ai.homing) { const q = w.towers.find(T => T.hq && T.team === t.team); ai.homing = t.hp < t.maxHp * 0.92; if (q) return { moveA: Math.atan2(q.y - t.y, q.x - t.x), speedK: 1 }; }
  const tgD = tg ? Math.hypot(tg.x - t.x, tg.y - t.y) : 1e9;
  // defend: own tower recently hit nearby
  if (tgD > 90) for (const T of w.towers) if (T.alive && T.team === t.team && w.time - T.hitT < 3 && (T.x - t.x) ** 2 + (T.y - t.y) ** 2 < 360 * 360) return { moveA: Math.atan2(T.y - t.y, T.x - t.x), speedK: 1 };
  // attack the nearest vulnerable enemy tower in range
  let tw = null, bd = 150 * 150; for (const T of w.towers) { if (!T.alive || T.team === t.team || !towerVulnerable(w, T)) continue; const d2 = (T.x - t.x) ** 2 + (T.y - t.y) ** 2; if (d2 < bd) { bd = d2; tw = T; } }
  if (tw && tgD > 90) { const a = Math.atan2(tw.y - t.y, tw.x - t.x), d = Math.sqrt(bd); return { moveA: d > 80 ? a : a + Math.PI / 2 * (t.id % 2 ? 1 : -1), speedK: d > 80 ? 1 : 0.4, aimA: a, fire: w.map.los(t.x, t.y, tw.x - Math.cos(a) * 12, tw.y - Math.sin(a) * 12) || d < 40 }; }
  if (tg) return null;
  // push: follow the lane waypoints, but don't walk past an invulnerable tower alone
  if (ai.life !== t.deaths) { ai.life = t.deaths; ai.wpi = 1; }
  ai.wpi = ai.wpi ?? 1; let p = lanes[Math.min(ai.wpi, lanes.length - 1)]; if (Math.hypot(p[0] - t.x, p[1] - t.y) < 50 && ai.wpi < lanes.length - 1) { ai.wpi++; p = lanes[ai.wpi]; }
  return { moveA: Math.atan2(p[1] - t.y, p[0] - t.x), speedK: 0.9 };
}
