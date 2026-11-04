import { genMoba } from '../sim/moba.js';
// Network protocol shared by the Node server, the Bluetooth host and clients.
import { NET_ENEMY_R, WEAPON_LIST, LOOT_REVEAL } from '../sim/defs.js';
import { genBR, genClassic } from '../sim/map.js';
import { genArena, genCustom, genRace } from '../sim/maps.js';
export const PROTO = 5;
const WI = Object.fromEntries(WEAPON_LIST.map((w, i) => [w, i]));
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

export function rosterOf(world) { return world.tanks.map(t => [t.id, t.name, t.skin, t.team, t.maxHp, t.human ? 1 : 0, t.etype || '', t.model ?? -1, t.build ? t.build.concat([t.hue || 0]) : 0, t.cc || '']); }
export function encTank(t, now) {
  const f = (t.alive ? 1 : 0) | (t.inBush ? 2 : 0) | (t.inv > 0 ? 4 : 0) | (t.speedT > 0 ? 8 : 0) | (t.powerT > 0 ? 16 : 0) | (t.spawnT > 0 ? 32 : 0) | (t.flash ? 64 : 0);
  return [t.id, r1(t.x), r1(t.y), r2(t.a), r2(t.ta), Math.ceil(t.hp), Math.ceil(t.shield), f, WI[t.weapon] || 0, t.kills, Math.round(t.vx), Math.round(t.vy), r1(Math.max(0, t.respawnT)), r1(Math.min(9, now - t.lastFire)), t.place || 0, t.stars || 0, r1(Math.max(0, t.cd)), t.maxHp, t.meds || 0, t.smokes || 0, t.mines || 0, t.armorT || 0, Math.ceil(t.armorHp || 0), t.ammo ?? t.shells ?? -1, t.wtier || 1, t.mods || 0, t.armorK || 0, t.slowT > 0 ? 1 : 0, t.regenT > 0 ? 1 : 0, t.hrockets || 0, (t.pbroke || 0) | (t.burnT > 0 ? 32 : 0) | (t.empT > 0 ? 64 : 0) | (t.stunT > 0 ? 128 : 0) | (t.sub ? 256 : 0) | (t.surfT > 0 ? 512 : 0) | ((t.terr || 0) << 10) | (t.beaconT > 0 ? 4096 : 0), t.pd ? Math.round((t.pd[0] + t.pd[1] + t.pd[2] + t.pd[3] + t.pd[4]) * 20) : 100, t.radar || 0, Math.round(t.oxy ?? 30), t.beacons || 0, t.revives || 0, t.rvg ? Math.round(t.rvg.p * 10) / 10 : -1, t.fgrp || 0, t.mounts && t.mounts.length ? t.mounts.map(m => [m.ammo, WI[m.w] || 0, m.pos === 'rear' ? 3 : m.pos === 'side' ? 1 : m.pos === 'coax' ? 2 : 0, m.floor ? 1 : 0, m.mgi ?? -1, m.auto ? 1 : 0]) : 0, t.shT || 0, t.shA ? t.shA : 0, t.rkT || 0, t.rkA ? t.rkA : 0, t.mgi ?? -1, t.tur ?? -1, t.sentryN || 0, t.blocksN || 0, t.twinN || 0, t.lives ?? 3, t.dronesN || 0, t.ldronesN || 0, t.waitBuy ? 1 : 0, t.prk || 0, t.cloaked ? 1 : 0, t.invisN || 0, Math.ceil(Math.max(0, t.invisCd || 0)), t.gm && t.gm.length ? t.gm.map(g => g.join('.')).join(',') : 0, Math.ceil(t.shBHp || 0), t.apsN || 0, t.visO ? (t.visO.kit | 0) * 10 + (t.visO.trk | 0) : -1, t.shBMax || 0]; /* r26: twin rockets, lives, drones synced */
}
export function decTank(a, base) {
  const t = base || {}; t.id = a[0]; t.x = a[1]; t.y = a[2]; t.a = a[3]; t.ta = a[4]; t.hp = a[5]; t.shield = a[6]; const f = a[7];
  t.alive = !!(f & 1); t.inBush = !!(f & 2); t.inv = f & 4 ? 1 : 0; t.speedT = f & 8 ? 1 : 0; t.powerT = f & 16 ? 1 : 0; t.spawnT = f & 32 ? 0.5 : 0; t.flash = !!(f & 64);
  t.weapon = WEAPON_LIST[a[8]] || 'cannon'; t.kills = a[9]; t.vx = a[10]; t.vy = a[11]; t.respawnT = a[12]; t.fireAgo = a[13]; t.place = a[14]; t.stars = a[15]; t.cd = a[16]; t.maxHp = a[17]; t.meds = a[18] || 0; t.smokes = a[19] || 0; t.mines = a[20] || 0; t.armorT = a[21] || 0; t.armorHp = a[22] || 0; t.ammo = a[23] == null || a[23] < 0 ? null : a[23]; t.armorK = a[26] || 0; t.slowT = a[27] ? 1 : 0; t.regenT = a[28] ? 1 : 0; t.hrockets = a[29] || 0; { const st = a[30] || 0; t.pbroke = st & 31; t.burnT = st & 32 ? 1 : 0; t.empT = st & 64 ? 1 : 0; t.stunT = st & 128 ? 1 : 0; t.pdSum = a[31] ?? 100; t.radar = a[32] || 0; t.sub = st & 256 ? 1 : 0; t.surfT = st & 512 ? 0.3 : 0; t.terr = (st >> 10) & 3; t.oxy = a[33] ?? 30; t.beacons = a[34] || 0; t.revives = a[35] || 0; t.rvgP = a[36] ?? -1; t.rvg = a[36] >= 0 ? { p: a[36] } : null; t.fgrp = a[37] || 0; t.shT = a[39] || 0; t.shA = a[40] || null; t.rkT = a[41] || 0; t.rkA = a[42] || null; t.mgi = a[43] >= 0 ? a[43] : null; t.tur = a[44] >= 0 ? a[44] : null; t.sentryN = a[45] || 0; t.blocksN = a[46] || 0; t.twinN = a[47] || 0; t.lives = a[48] ?? 3; t.dronesN = a[49] || 0; t.ldronesN = a[50] || 0; t.waitBuy = !!a[51]; t.prk = a[52] || 0; t.cloaked = !!a[53]; t.invisN = a[54] || 0; t.invisCd = a[55] || 0; t.gm = a[56] ? String(a[56]).split(',').map(s => s.split('.').map(Number)) : null; t.shBHp = a[57] || 0; t.apsN = a[58] || 0; if (a[59] >= 0 && a[59] != null) t.visO = { ...(t.visO || {}), kit: Math.floor(a[59] / 10), trk: a[59] % 10 }; t.shBMax = a[60] || 0; if (a[38]) { const M = t.mounts || (t.mounts = []); M.length = a[38].length; a[38].forEach((v, i) => { const q = M[i] || (M[i] = {}); if (Array.isArray(v)) { q.ammo = v[0]; q.w = WEAPON_LIST[v[1]] || 'cannon'; q.pos = ['pod', 'side', 'coax', 'rear'][v[2]]; q.floor = v[3]; q.mgi = v[4] >= 0 ? v[4] : null; q.auto = v[5]; } else q.ammo = v; }); } t.beaconT = st & 4096 ? 1 : 0; t.rev = !!(st & 8192); t.seeR = t.sub ? 14 : t.terr === 2 ? 20 : t.inBush ? 48 : t.terr === 1 ? 72 : 1e9; } t.wtier = a[24] || 1; t.mods = a[25] || 0; return t;
}
// Build a snapshot for one viewer (interest management by distance)
export function snapshot(world, focus, evs, tiles, full, self) {
  const R = world.mode === 'br' ? 460 : 99999, R2 = R * R, fx = focus ? focus.x : world.map.pw / 2, fy = focus ? focus.y : world.map.ph / 2;
  const tanks = [];
  // r15 anti map-hack: enemies only near the viewer (a recent shot reveals at a larger radius); allies are always sent
  const me = self || focus, ER = NET_ENEMY_R * NET_ENEMY_R, SR = (NET_ENEMY_R * 1.4) ** 2, open = full || world.mode === 'classic';
  for (const t of world.tanks) { const d2 = (t.x - fx) ** 2 + (t.y - fy) ** 2; const ally = me && t.team === me.team && (world.mode !== 'br' || world.squad > 1 || t === me);
    if (t === focus || t === self || open) { if (open && !(t === focus || t === self) && d2 >= R2 && !full) continue; tanks.push(encTank(t, world.time)); continue; }
    if (ally) { tanks.push(encTank(t, world.time)); continue; }
    if (me && (t.layer | 0) !== (me.layer | 0)) continue; // r15 bunker layers are invisible to each other
    // concealment (bush / smoke / swamp / submerged) enforced here too: hidden enemies are simply not sent
    const rv = me && t.revT > 0 && t.revTeam === me.team;
    if (!rv && t.inBush && d2 > (t.seeR || 48) ** 2 && world.time - t.lastFire > 1.2) continue;
    if (rv && d2 < SR) { const e = encTank(t, world.time); e[30] |= 8192; tanks.push(e); continue; }
    if (d2 < ER || (d2 < SR && world.time - t.lastFire < 0.6)) tanks.push(encTank(t, world.time)); }
  const bullets = [];
  const FL = focus ? focus.layer | 0 : 0;
  for (const b of world.bullets) if ((b.layer | 0) === FL && (b.x - fx) ** 2 + (b.y - fy) ** 2 < R2) bullets.push([b.id, r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), WI[b.w] || 0]);
  const pickups = [];
  // BR loot stays a sealed «Добыча» bag until the viewer is close (contents are not even sent)
  const PR2 = Math.min(R2, 760 * 760); // r31: pickups only near the viewer in every mode (was whole map → most of the snapshot)
  for (const p of world.pickups) { if ((p.layer | 0) !== FL) continue; const d2 = (p.x - fx) ** 2 + (p.y - fy) ** 2; if (d2 >= PR2) continue; if (world.mode === 'br' && d2 > LOOT_REVEAL * LOOT_REVEAL) pickups.push([p.id, r1(p.x), r1(p.y), 'loot', -1, r1(p.life), 1]); else pickups.push([p.id, r1(p.x), r1(p.y), p.type, p.wid ? WI[p.wid] : -1, r1(p.life), p.tier || 1, p.ak || 0, p.items ? p.items.map(o => [o.type, o.n || 0, o.wid ? WI[o.wid] : -1, o.tier || 1, o.lid ?? -1]) : 0, p.lid ?? -1]); }
  const ev = evs.filter(e => e.k === 'kill' || e.k === 'zone' || e.k === 'go' || e.k === 'end' || e.k === 'baseDown' || e.x === undefined || (e.x - fx) ** 2 + (e.y - fy) ** 2 < R2);
  const s = { t: 's', tm: r2(world.time), st: world.state, cd: r1(world.countdown), T: tanks, B: bullets, P: pickups, E: ev, tc: tiles };
  if (world.zone) { const z = world.zone; s.z = [r1(z.cx), r1(z.cy), r1(z.r), r1(z.tcx), r1(z.tcy), r1(z.tr), z.state, r1(z.timer)]; }
  if (world.traps && world.traps.length) s.tp = world.traps.map(T => [T.id, r1(T.x), r1(T.y), r2(T.a), T.team, T.n]);
  if (world.drones && world.drones.length) s.dr = world.drones.map(d => [d.id, r1(d.x), r1(d.y), r2(d.a), d.leg ? 1 : 0, r2(d.ph)]);
  if (world.smokes && world.smokes.length) s.sm = world.smokes.filter(m => (m.x - fx) ** 2 + (m.y - fy) ** 2 < R2).map(m => [m.id, r1(m.x), r1(m.y), m.r, r1(m.t), m.max]);
  if (world.mines && world.mines.length && self) s.mn = world.mines.filter(m => (m.layer | 0) === (self.layer | 0)).filter(m => m.team === self.team || (m.x - self.x) ** 2 + (m.y - self.y) ** 2 < 1600).map(m => [m.id, r1(m.x), r1(m.y), m.team, r1(Math.max(0, m.arm))]);
  if (world.sentries && world.sentries.length) s.se = world.sentries.filter(m => (m.x - fx) ** 2 + (m.y - fy) ** 2 < R2).map(m => [m.id, r1(m.x), r1(m.y), m.team, Math.ceil(m.hp), m.ammo, r2(m.a || 0), m.layer | 0]);
  if (world.mode === 'br') s.ac = world.aliveCount;
  if (world.mode === 'team') s.sc = world.score;
  if (world.hill) { const H = world.hill; s.hl = [r1(H.x), r1(H.y), H.r, H.owner, H.contested ? 1 : 0]; }
  if (world.wrecks && world.wrecks.length) s.wk = world.wrecks.filter(w => ((w.layer | 0) === FL && (w.x - fx) ** 2 + (w.y - fy) ** 2 < R2) || (w.tid && me && w.team === me.team)).map(w => [w.id, r1(w.x), r1(w.y), r2(w.a), r2(w.ta), Math.round(world.time - w.t0), w.model, r2(w.rp || 0), w.tid ? w.team : -1, w.tid || 0]);
  if (world.under) s.ly = world.tanks.filter(t => t.layer).map(t => t.id);
  if (world.towers) { s.tw = world.towers.map(T => [T.id, T.team, r1(T.x), r1(T.y), Math.ceil(T.hp), T.maxHp, T.tier, T.hq ? 1 : 0, T.vul ? 1 : 0]); s.gd = world.gold; }
  if (world.flags) s.fl = world.flags.map(F => [r1(F.x), r1(F.y), F.carrier, F.home ? 1 : 0]);
  if (world.special === 'race') s.rc = world.raceRanking().map(t => [t.id, t.lap, t.cp, t.finishT ? 1 : 0]);
  if (world.wave !== undefined) s.wv = [world.wave, world.lives];
  if (world.ffa) s.fk = world.tanks.map(t => [t.id, t.kills]);
  if (world.mode === 'classic') s.cl = [world.lives, world.score, world.enemyKilled, world.enemyTotal, world.baseAlive ? 1 : 0, r1(world.freezeT)];
  if (world.result) s.res = world.result;
  return s;
}
export function startMsg(world, meId) {
  const o = world.opts;
  return { t: 'start', v: PROTO, mode: world.mode, seed: world.seed, mapSize: o.mapSize || 340, level: o.level || 0, target: world.target, timeLimit: world.timeLimit, roster: rosterOf(world), me: meId, levelName: world.levelName, ffa: !!world.ffa, special: world.special || null, laps: world.laps || 0, camLock: o.camLock ?? -1, map: o.map || 0, mapW: o.mapW || 150, mapH: o.mapH || 96, custom: o.custom || null, hk: world.under ? world.under.hatches.map(h => [(h.x - 8) / 8, (h.y - 8) / 8]) : null, variant: o.variant || null, code: o.code || null };
}
export function mapFor(msg) { return msg.mode === 'br' ? genBR(msg.seed, msg.mapSize) : msg.mode === 'team' ? (msg.special === 'moba' ? genMoba(msg.seed) : msg.special === 'race' ? genRace(msg.seed, msg.map || 0) : (msg.custom && genCustom(msg.custom)) || genArena(msg.seed, msg.map || 0, msg.mapW || 150, msg.mapH || 96)) : genClassic(msg.level || 0); }
export function sanitizeInput(o) {
  const n = (v) => (typeof v === 'number' && isFinite(v)) ? Math.max(-1, Math.min(1, v)) : 0;
  let ax = (typeof o.ax === 'number' && isFinite(o.ax)) ? o.ax : 0, ay = (typeof o.ay === 'number' && isFinite(o.ay)) ? o.ay : 0; const d = Math.hypot(ax, ay) || 1;
  return { mx: n(o.mx), my: n(o.my), ax: ax / d, ay: ay / d, aim: !!o.aim, fire: !!o.fire, an: Number.isInteger(o.an) && o.an > 0 ? o.an : 0, act: ['take', 'med', 'smoke', 'mine', 'hrocket', 'dive', 'bunker', 'beacon', 'mbuy_dmg', 'mbuy_arm', 'mbuy_spd'].includes(o.act) || (typeof o.act === 'string' && /^(takei_\d{1,2}|(give|drop)_(weapon|ammo|armor|med|smoke|mine|hrocket|beacon|radar|revive|mod)_[a-z0-9]{1,8}|req_(ammo|med|armor|help|coming|weapon)|revive|fgrp|sentry|blocks|mountw|unmount_\d|drop_(shl|rkt)_[a-z0-9]{1,6}|shell|shell_\d{1,2}|rkt|rk_next|det)$/.test(o.act)) ? o.act : null };
}
export function sanitizeName(s) { return String(s || 'Игрок').replace(/[^A-Za-z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF _\-.]/g, '').trim().slice(0, 14) || 'Игрок'; }
