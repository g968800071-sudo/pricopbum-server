import { ccOfName } from './flags.js';
import { GMODS, gmFx, GM_CAP } from './gmods.js';
export const DMG_BASE = 1.3; // r26 (user: shots felt too weak)
// PRICOPBUM core simulation — deterministic-ish, DOM-free. Runs in the browser (offline / Bluetooth host) and on the Node server.
import { LOOTX, ROCKETS, MINES, WEAPON_VARS, SPARES, PERKS, MODS2, rollLootX, rollGear, GEAR , MYTH_GEAR } from './loot.js';
import { SHELLS, normLoadout, personaLoadout, pickShell } from './loadout.js';
import { MODEL_COUNT, modelOf, buildValid, buildStats, randomBuild, DEFAULT_BUILD, normBuild, personaBuild, visSig } from './models.js';
const MOUNT_AMMO = { mg: 120, twin: 60, rocket: 16, cannon: 40, heavy: 24 };
import { WATER_SAFE, WATER_SPD } from './defs.js';
const MOD_CAP = 10;
import { BEACON_R, BEACON_T, DIVE_MAX, DIVE_CD, DIVE_SEE, T_MUD, T_SWAMP, MUD_SPD, SWAMP_SPD, SWAMP_SEE, MUD_SEE, BUSH_SEE, CELL, T_EMPTY, T_BRICK, T_STEEL, T_WATER, T_BUSH, T_ICE, T_CRATE, T_BASE, TANK_R, WAVE_W, WEAPONS, WEAPON_LIST, LOOT_WEAPONS, MODS, UPGRADES, BOT_NAMES, BOT_SKINS, DIFFS, TIERS, AMMO, ITEM_MAX, PARTS, DMG_TYPE, HROCKET_LOCK, HROCKET_PACK, armorReduce, armorMax, tierMul } from './defs.js';
import { genBR, genTeam, genClassic, classicRing, CLASSIC_LEVELS } from './map.js';
import { genArena, genCustom, genRace } from './maps.js';
import { makeRng } from './rng.js';
import { botThink } from './ai.js';
import { loadK } from './weight.js';
const LOOT_K = globalThis.__LOOT_K ?? 0.6; // r19: user request — 40% fewer pickups on the ground in every mode
import { chat, personaOf } from './brain.js';
const REV_R = 20, REV_T = 12, GIVE_R = 34;
const SHELL_IDX_OF = (S) => SHELLS.indexOf(S);
export const REQ_TXT = { ammo: 'Нужны патроны', med: 'Нужна аптечка', armor: 'Нужна броня', help: 'Помогите!', coming: 'Иду на помощь', weapon: 'Нужно оружие' };
import { genBunker, onHatch } from './bunker.js';
import { genMoba, initMoba, stepMoba, bulletHitsTower, damageTower, mobaRespawn, buyMoba, MSHOP } from './moba.js';

const SHELL_PACK = 50, SHELL_TYPE_CAP = 100; // r19: special-shell pack size and per-type carry cap
import { RAR_K, MGS, TURRETS, MYTH_HP } from './arms.js';
const MGW_C = new Map(); const mgW = (i, eq) => { const ck = i + (eq ? 'e' : ''); let W = MGW_C.get(ck); if (!W) { const M = MGS[i]; W = { ...WEAPONS.mg, dmg: M.dmg * (eq ? 1 : RAR_K[M.r]), reload: M.reload, spread: M.spread, life: M.life, speed: M.speed, burst: M.burst, mgi: i, mgfx: M.fx, slots: M.slots }; MGW_C.set(ck, W); } return W; };
const TUR_C = new Map(); const turW = (w, i, eq) => { const k = w.id + i + (eq ? 'e' : ''); let W = TUR_C.get(k); if (!W) { const T = TURRETS[i]; W = { ...w, dmg: w.dmg * T.dmg * (eq ? 1 : RAR_K[T.r]), reload: w.reload * T.rel, life: w.life * T.rng }; TUR_C.set(k, W); } return W; };
const bitsN = (v) => { let n = 0; for (; v; v &= v - 1) n++; return n; };
const SENTRY = { hp: 70, ammo: 400, dmg: 1.4, reload: 0.045, range: 175, life: 0.6, speed: 420, spread: 0.07 }; // r20: deployable sentry «Турель»
const ROCKET_K = 1.5; // r19: special rockets are rarer but hit 50% harder
const MOUNT_MAX = 3; // r19: floor weapons that can be mounted at once
const BR_SHELLS = 45; // BR: base-gun shells; 0 = cannot shoot until ammo is picked up
const TAU = Math.PI * 2;
export const HP_MUL = 2.4;
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export const MODE_INFO = {
  br:      { name: 'Королевская битва', short: 'КОРОЛЕВСКАЯ БИТВА' },
  team:    { name: 'Командный бой 10×10', short: 'КОМАНДНЫЙ БОЙ' },
  classic: { name: 'Классика: защита базы', short: 'КЛАССИКА' },
};

const ENEMY_TYPES = {
  b: { name: 'Лёгкий',  speed: 42, hp: 34,  weapon: 'cannon', bspeed: 0.75, pts: 100, color: 0 },
  f: { name: 'Быстрый', speed: 74, hp: 34,  weapon: 'cannon', bspeed: 0.8,  pts: 200, color: 1 },
  p: { name: 'Огневой', speed: 46, hp: 34,  weapon: 'cannon', bspeed: 1.25, pts: 300, color: 2 },
  a: { name: 'Броневик',speed: 38, hp: 136, weapon: 'cannon', bspeed: 0.9,  pts: 400, color: 3 },
};

export class World {
  constructor(opts) {
    this.opts = opts; this.mode = opts.mode; this.seed = opts.seed >>> 0 || 1; this.rng = makeRng(this.seed ^ 0x9e3779b9);
    this.time = 0; this.drones = []; this.traps = []; this.tanks = []; this.bullets = []; this.pickups = []; { const P = this.pickups; P.push = (...a) => { for (const p of a) if (p.layer == null) p.layer = this._L | 0; return Array.prototype.push.apply(P, a); }; } this.smokes = []; this.mines = []; this.events = []; this.nextId = 1;
    this.state = 'countdown'; this.countdown = opts.countdown ?? 3; this.result = null; this.feed = [];
    this.hash = new Map(); this.byId = new Map();
    this.diff = DIFFS[Math.max(0, Math.min(4, opts.diff ?? 1))]; this.squad = Math.max(1, opts.squad || 1); this.teamPlace = {};
    if (this.mode === 'br') this.initBR(); else if (this.mode === 'team') this.initTeam(); else this.initClassic(opts.level || 0);
    this._L = 0; if (this.mode !== 'classic' && this.special !== 'race' && !opts.noBunker) this.initBunker();
  }
  id() { return this.nextId++; }
  ev(e) { this.events.push(e); }

  // ---------- setup ----------
  makeTank(o) {
    const lv = o.lv || { dmg: 0, reload: 0, armor: 0, engine: 0 };
    // r15: tanks are ~2.4x tougher outside classic so fights last and feel tactical
    const hpMul = this.mode === 'classic' ? 1 : (this.opts.hpMul ?? HP_MUL);
    const maxHp = Math.round((o.hp || 100) * hpMul * (1 + UPGRADES.armor.per * lv.armor));
    const t = { id: this.id(), x: o.x, y: o.y, a: o.a ?? -Math.PI / 2, ta: o.a ?? -Math.PI / 2, vx: 0, vy: 0, hp: maxHp, maxHp, shield: 0,
      team: o.team, name: o.name, cc: o.cc || ccOfName(o.name), skin: o.skin || 'olive', weapon: o.weapon || 'cannon', lv, cd: 0.4, alive: true, human: !!o.human, cid: o.cid ?? null,
      kills: 0, dmg: 0, place: 0, lives: 3 + (o.human ? Math.min(5, o.extraLives | 0) : 0), prk: o.rki ?? 0, inv: o.inv ?? 2, speedT: 0, powerT: 0, speed: o.speed || 70, bulletMul: o.bulletMul || 1, dmgMul: o.dmgMul || 1,
      input: { mx: 0, my: 0, ax: 0, ay: 0, fire: false, aim: false }, ai: o.human ? null : { skill: o.skill ?? 0.5, t: 0 }, etype: o.etype || null,
      inBush: false, lastFire: -9, respawnT: 0, meds: 0, smokes: 0, mines: 0, dronesN: 0, ldronesN: 0, twinN: 0, armorT: 0, armorHp: 0, ammo: o.human ? null : (AMMO[o.weapon || 'cannon'] ?? null), baseW: o.human ? (o.weapon || 'cannon') : 'cannon', shells: this.mode === 'br' ? BR_SHELLS : null, wtier: 1, an: 0, stars: 0, flash: !!o.flash, spawnT: o.spawnT || 0, deaths: 0, tread: 0, recoil: 0, hitT: 0, frozen: 0 };
    // r15: chosen tank model (humans) or a random one (bots) scales HP/speed/armour/reload within ±15%
    // r16: every bot assembles its own build (personality-matched, quality by difficulty) and every tank on the field looks different
    let bld = o.build ? normBuild(o.build) : null; const S = this._vsig || (this._vsig = new Set());
    if (this.mode === 'classic' || o.etype || this.special === 'race') bld = o.human && this.opts.cbuild && buildValid(bld) && this.mode !== 'classic' ? bld : null;
    else if (!o.human) { const pers = personaOf(t.id), sk = this.diff ? (this.diff.sk[0] + this.diff.sk[1]) / 2 : 0.5; t.pers = pers; for (let k = 0; k < 30; k++) { bld = personaBuild(pers, this.rng, sk); if (!S.has(visSig(bld, 0))) break; } }
    else if (!buildValid(bld)) bld = this.opts.cbuild ? DEFAULT_BUILD.slice() : null;
    if (bld) { let hue = 0; while (S.has(visSig(bld, hue)) && hue < 40) hue++; S.add(visSig(bld, hue)); t.hue = hue; }
    if (o.tur != null && TURRETS[o.tur] && this.mode !== 'classic') t.tur = o.tur;
    if (o.buy) t._buy = o.buy; // r20: one-match loadout bought before the battle // r20: turret chosen in Мастерская
    if (bld) { const B = buildStats(bld); t.build = bld.slice(); t.mounts = B.mounts.map(m => ({ ...m, cd: 0, ammo: MOUNT_AMMO[m.w] || 30, max: MOUNT_AMMO[m.w] || 30 })); t.accMul = B.acc; t.fgrp = 0; t.model = -1; t.maxHp = t.hp = Math.round(t.maxHp * B.hp); t.speed *= B.spd; t.armMul = B.arm; t.relMul = B.rel; t.weapon = t.baseW = B.weapon; t.ammo = null; t.buildAk = B.ak;
      if (B.ak >= 0) { t.armorT = 1; t.armorHp = armorMax(1); t.armorK = B.ak; } this.initLoadout(t, o); this.mythBot(t, o); this.tankLvl(t, o); this.tanks.push(t); this.byId.set(t.id, t); return t; }
    let mid = o.model; if (mid == null && !o.human && !o.etype && !(t.skin || '').startsWith('enemy')) mid = Math.floor(this.rng() * MODEL_COUNT);
    if (mid != null && this.mode !== 'classic') { const M = modelOf(mid); t.model = M.id; t.maxHp = t.hp = Math.round(t.maxHp * M.hp * (this.opts.equal ? 1 : RAR_K[M.rar] || 1)); t.speed *= M.spd; t.armMul = M.arm; t.relMul = M.rel; } else t.model = mid == null ? -1 : mid | 0;
    this.initLoadout(t, o); this.mythBot(t, o); this.tankLvl(t, o); this.tanks.push(t); this.byId.set(t.id, t); return t;
  }
  // r16 loadout: shells + equipment (validated by normLoadout — the server runs this same sim)
  // r22: user rule — on Hard (and above) ~50% of bots spawn with mythic gear (random mix: tank / turret / MG / rockets); Easy/Normal: none
  // r25: persistent tank level (players: from save; bots: rolled by difficulty) → small capped bonus, shown on the plate
  tankLvl(t, o) { let lv = o.tlv; if (lv == null) { if (!t.ai || this.opts.equal) return; const d = this.diff ? this.diff.id : 1; let hsh = 7; for (const ch of String(t.name || '')) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; lv = Math.max(1, Math.min(20, Math.round([2, 5, 9, 13, 17][d] + ((hsh % 1000) / 1000 - 0.5) * 8))); t.prk = 1 + Math.min(18, Math.round(lv * 0.8 + (hsh >> 10) % 4)); if (this.opts.botRk && this.opts.botRk[t.name] != null) t.prk = this.opts.botRk[t.name]; } // r26: persistent bot identity — same nickname ⇒ same tank level & rank every match
    t.tlv = 'Ур.' + lv; if (this.opts.equal || this.mode === 'classic') return; const k = Math.min(19, lv - 1) * 0.005; if (k) this.applyFx(t, { rel: 1 - k, spread: 1 - k, arm: 1 + k }); }
  mythBot(t, o) { if (t.human || !t.ai || (o.etype && /boss/.test(o.etype)) || this.opts.equal) return; const d = this.diff ? this.diff.id : 1, P = [0, 0, 0.5, 0.65, 0.8][d] || 0; /* r25: Hard 50% … hardest 80% */ if (!P || this.rng() >= P) return;
    const r = this.rng, ALL = ['tank', 'tur', 'mg', 'rocket', 'gear', 'gear2', 'perk']; const kinds = ALL.filter(() => r() < 0.45); while (kinds.length < 3) { const k = ALL[Math.floor(r() * ALL.length)]; if (!kinds.includes(k)) kinds.push(k); } t.myth = kinds; /* r25: every mythic bot carries ≥3 mythic items, visibly mounted */
    const pick = a => a[Math.floor(r() * a.length)];
    for (const k of kinds) try {
      if (k === 'tank') { t.maxHp = t.hp = Math.round(t.maxHp * MYTH_HP); t.mythT = 1; }
      else if (k === 'gear' || k === 'gear2') { const gi = MYTH_GEAR[Math.floor(r() * MYTH_GEAR.length)], lid = LOOTX.findIndex(L => L.cat === 'gear' && L.i === gi); if (lid >= 0) this.takeLX(t, { lid, n: 1 }); }
      else if (k === 'perk') { const q = r(); if (q < 0.4) t.ldronesN = 2; else if (q < 0.75) t.twinN = 2; else { t.meds = 5; t.smokes = 3; } }
      else if (k === 'tur') { const ids = TURRETS.map((T, i) => T.r === 4 ? i : -1).filter(i => i >= 0); if (ids.length) t.tur = pick(ids); }
      else { const ids = LOOTX.map((L, i) => (k === 'mg' ? L.cat === 'mgt' && MGS[L.i].r === 4 : L.cat === 'rocket' && ROCKETS[L.i].myth) ? i : -1).filter(i => i >= 0); if (ids.length) this.takeLX(t, { lid: pick(ids), n: 1, tier: 1 }); }
    } catch (_) {} }
  initLoadout(t, o) { if (this.mode === 'classic' || o.etype || this.special === 'race') return; const L = t.human ? normLoadout(o.loadout) : personaLoadout(t.pers || personaOf(t.id), this.rng); t.lo = L; t.eq = L.equip.slice(); t.shT = 0;
    if (t.human && o.ib) { const I = o.ib, c = (v) => this.opts.equal ? 0 : Math.min(0.2, Math.max(0, +v || 0)); if (I.dmg) t.dmgMul *= 1 + c(I.dmg); if (I.hp) { t.maxHp = t.hp = Math.round(t.maxHp * (1 + c(I.hp))); } if (I.spd) t.speed *= 1 + c(I.spd); if (I.rel) t.relMul = (t.relMul || 1) * (1 - c(I.rel)); if (I.acc) t.accMul = (t.accMul || 1) * (1 + c(I.acc)); }
    const E = (k) => t.eq.includes(k); if (E('nitro')) t.speed *= 1.08; if (E('reload')) t.relMul = (t.relMul || 1) * 0.92; if (E('track')) t.accMul = (t.accMul || 1) * 1.1; this.equipSpawn(t); t._b = { speed: t.speed, relMul: t.relMul || 1, accMul: t.accMul || 1, dmgMul: t.dmgMul || 1, armMul: t.armMul || 1, bulletMul: t.bulletMul || 1 }; }
  equipSpawn(t) { if (t._b) Object.assign(t, t._b); t.fx = null; t.wv = null; t.rkA = null; t.mineK = null; if (!t.lo) return; t.shA = SHELLS.map(S => S.id === 'ap' ? -1 : (t.lo.shells[S.id] || 0)); t.shT = 0; const E = (k) => t.eq.includes(k);
    if (E('smokel')) t.smokes = Math.min(5, (t.smokes || 0) + 2); if (E('minel')) t.mines = Math.min(5, (t.mines || 0) + 2); if (E('shieldg')) t.shield = Math.max(t.shield || 0, t.maxHp * 0.15); }
  // r27: bots upgrade in battle — each kill mounts a mod matching their persona (visible: plate chips + hull kit/track look changes) and they announce it
  botUpgrade(t, quiet) { const P = { aggressive: ['spikes', 'dozer', 'reactive', 'nitro', 'autoload', 'he'], sniper: ['rangef', 'stab', 'thermal', 'optic', 'camo', 'apfsds'], flanker: ['nitro', 'turbo', 'wide', 'jammer', 'decoy', 'ricochet'], medic: ['repair', 'shield', 'radar', 'ext', 'winch', 'hydro'], looter: ['radar', 'amph', 'minel', 'magmine', 'turbo', 'incend'], coward: ['shield', 'aps', 'smoke', 'camo', 'decoy', 'spaced'] }[t.pers || personaOf(t.id)] || ['reactive', 'repair', 'aps'];
    const has = (t.gm || []).map(x => x[0]); let id = P.find(k => !has.includes(GMODS.findIndex(M => M.id === k))); let tier = 1, lv = 1;
    if (!id) { const g = (t.gm || []).find(x => x[2] < 3 || x[1] < 5); if (!g) return; id = GMODS[g[0]].id; tier = g[2] < 3 ? g[1] : g[1] === 1 ? 4 : 5; lv = g[2] < 3 ? g[2] + 1 : 1; }
    else if ((this.diff && this.diff.id >= 3) || t.myth) tier = 4;
    if (this.rocketHint && id === 'aps') tier = 4; const i = GMODS.findIndex(M => M.id === id), lid = LOOTX.findIndex(x => x.cat === 'gmod' && x.i === i && x.tier === tier && x.lv === lv);
    if (lid < 0 || !this.takeLX(t, { lid, x: t.x, y: t.y })) return; t.upgN = (t.upgN || 0) + 1; t.visO = { ...(t.visO || {}), kit: Math.min(4, (t.upgN | 0) % 5), trk: Math.min(3, (t.upgN >> 1)) };
    if (quiet) return; this.ev({ k: 'botupg', id: t.id, x: t.x, y: t.y, g: GMODS[i].g, col: GMODS[i].col }); if (this.rng() < 0.5) chat(this, t, this.rng() < 0.6 ? 'upg' : 'emo', true); }
  applyGM(t, M, tier, lv) { const fx = { ...gmFx(M, tier, lv) }; /* r27 */
    if (fx.aps) { t.apsN = Math.max(t.apsN || 0, fx.aps); t.apsMax = t.apsN; delete fx.aps; } if (fx.shB) { t.shBMax = Math.max(t.shBMax || 0, fx.shB); t.shBHp = t.shBMax; delete fx.shB; }
    if (fx.smokesAdd) { t.smokes = (t.smokes || 0) + fx.smokesAdd; delete fx.smokesAdd; } if (fx.mineLay) { t.mines = Math.min(8, (t.mines || 0) + fx.mineLay); delete fx.mineLay; }
    for (const k of ['ramDmg', 'ramRes', 'amph', 'jam', 'decoy', 'ext', 'mudRes', 'camo', 'empHit', 'view']) if (fx[k] != null) { const f = t.fx || (t.fx = {}); f[k] = k === 'ramDmg' ? Math.max(f[k] || 1, fx[k]) : Math.max(f[k] || 0, fx[k]); delete fx[k]; }
    this.applyFx(t, fx); }
  applyFx(t, fx) { const f = t.fx || (t.fx = {}); for (const k in fx) { const v = fx[k];
      if (k === 'speed') t.speed *= v; else if (k === 'acc') t.accMul = (t.accMul || 1) * v; else if (k === 'rel') t.relMul = (t.relMul || 1) * v; else if (k === 'dmg') t.dmgMul = (t.dmgMul || 1) * v; else if (k === 'arm') t.armMul = (t.armMul || 1) * v; else if (k === 'bspd') t.bulletMul = (t.bulletMul || 1) * v; else if (k === 'radar') t.radar = 1;
      else if (k === 'spread' || k === 'moveSpread' || k === 'lowHpRel' || k === 'splashRes' || k === 'rearArm') f[k] = (f[k] || 1) * v; else if (k === 'turn' || k === 'lootR' || k === 'ammo' || k === 'medBoost' || k === 'splashDmg' || k === 'rocketDmg' || k === 'mineDmg' || k === 'burnDmg' || k === 'exec') f[k] = (f[k] || 1) * v; else f[k] = (f[k] || 0) + v; }
    // r19: stacking caps so mods always help but never break balance
    if (t.spd0 == null) t.spd0 = t.speed / (fx.speed || 1); t.speed = Math.min(t.speed, t.spd0 * 1.3); const cl = (k, lo, hi) => { if (t[k] != null) t[k] = Math.max(lo, Math.min(hi, t[k])); }, cf = (k, lo, hi) => { if (f[k] != null) f[k] = Math.max(lo, Math.min(hi, f[k])); };
    cl('accMul', 0.5, 1.6); cl('relMul', 0.6, 1.5); cl('dmgMul', 0.5, 1.5); cl('armMul', 0.6, 1.4); cl('bulletMul', 0.5, 1.5); cf('spread', 0.35, 2); cf('moveSpread', 0.3, 2); cf('turn', 0.5, 2); cf('splashRes', 0.5, 1); cf('rearArm', 0.5, 1); cf('lootR', 1, 2); cf('ammo', 1, 2); if (f.regen) f.regen = Math.min(f.regen, 2); }
  // r16b: floor loot catalogue pickup
  takeLX(t, p) { const L = LOOTX[p.lid]; if (!L) return true; const n = p.n || 1;
    switch (L.cat) {
      case 'shell': { if (!t.shA) t.shA = SHELLS.map((S, j) => j ? 0 : -1); if ((t.shA[L.i] || 0) >= SHELL_TYPE_CAP) return false; t.shA[L.i] = Math.min(SHELL_TYPE_CAP, (t.shA[L.i] || 0) + SHELL_PACK); /* r19: one pack = 50 rounds */ if (!t.human && !t.shT) t.shT = L.i; break; }
      case 'rocket': { if (L.i === 0) { if (t.hrockets >= 10) return false; t.hrockets = 10; break; } const A = t.rkA || (t.rkA = ROCKETS.map(() => 0)); const cap = ROCKETS[L.i].hm ? 10 : 4; if (A[L.i] >= cap) return false; A[L.i] = Math.min(cap, (A[L.i] || 0) + (ROCKETS[L.i].hm ? 10 : 2)); if (!t.rkT || !A[t.rkT]) t.rkT = L.i; break; }
      case 'mine': { if ((t.mines || 0) >= 5) return false; t.mines = (t.mines || 0) + 1; (t.mineK || (t.mineK = [])).push(L.i); break; }
      case 'wvar': { const V = WEAPON_VARS[L.i]; if (t.ammo != null && t.weapon !== V.w && this.mode !== 'classic') this.pickups.push({ id: this.id(), x: t.x + 10, y: t.y + 6, type: 'weapon', wid: t.weapon, tier: t.wtier, t: 0, life: 25 }); t.weapon = V.w; t.wtier = Math.max(1, L.r); t.ammo = V.w === 'cannon' ? null : Math.round((AMMO[V.w] ?? 20) * (V.m.ammo || 1) * ((t.fx && t.fx.ammo) || 1)); t.wv = V.m; break; }
      case 'mgt': { const M = MGS[L.i]; if (this.mode === 'classic') break; if (M.sim && (t.mounts || []).length < MOUNT_MAX) { const Ms = t.mounts || (t.mounts = []); Ms.push({ w: 'mg', pos: ['pod', 'side', 'coax', 'side'][Ms.length] || 'pod', dk: 1, cd: 0.3, ammo: M.cap, max: M.cap, floor: 1, tier: 1, mgi: M.i, auto: 1 }); if (t.fgrp == null) t.fgrp = 0; this.ev({ k: 'note', id: t.id, txt: 'Орудие установлено: ' + M.name }); break; }
        if (t.ammo != null && t.weapon && t.weapon !== (t.baseW || 'cannon')) this.pickups.push({ id: this.id(), x: t.x + 10, y: t.y + 6, layer: t.layer | 0, type: 'weapon', wid: t.weapon, mgi: t.mgi, tier: t.wtier || 1, ammo: t.ammo, t: 0, life: 60 });
        t.weapon = 'mg'; t.mgi = M.i; t.ammo = M.cap; t.wtier = 1; t.wv = null; break; }
      case 'blocks': if (t.blocksN >= 1) return false; t.blocksN = 1; break;
      case 'sentry': if (t.sentryN >= 1) return false; t.sentryN = 1; break;
      case 'tur': { if (t.tur != null && t.tur !== L.i) { const o = LOOTX.findIndex(x => x.cat === 'tur' && x.i === t.tur); if (o >= 0 && LOOTX[o].r < 5) this.pickups.push({ id: this.id(), x: t.x + 10, y: t.y + 6, layer: t.layer | 0, type: 'lx', lid: o, tier: 1, t: 0, life: 60 }); } t.tur = L.i; this.ev({ k: 'note', id: t.id, txt: 'Башня: ' + TURRETS[L.i].name }); break; }
      case 'spare': { const S = SPARES[L.i]; if (S.pb) { t.pbroke = (t.pbroke || 0) & ~S.pb; if (t.pd) for (let j = 0; j < 5; j++) if (S.pb & (1 << j)) t.pd[j] = 1; } this.applyFx(t, S.fx); break; }
      case 'perk': { const fl = t.perkN || 0; if (fl >= 6) return false; t.perkN = fl + 1; this.applyFx(t, PERKS[L.i].fx); break; }
      case 'gear': { const G = GEAR[L.i], gs = t.gearS || (t.gearS = {}); if (gs[G.slot] != null && gs[G.slot] >= G.r * 10 + G.lv) return false; gs[G.slot] = G.r * 10 + G.lv; t.gearN = Object.keys(gs).length; if (G.vis) t.visO = { ...(t.visO || {}), ...G.vis }; const fx = { ...G.fx }; if (fx.hp) { t.maxHp += fx.hp; t.hp += fx.hp; delete fx.hp; } this.applyFx(t, fx); break; }
      case 'gmod': { const M = GMODS[L.i], gm = t.gm || (t.gm = []), j = gm.findIndex(x => x[0] === L.i); /* r27 gameplay mods: same kind → keep the stronger */
        const pw = (L.tier || 1) * 10 + (L.lv || 1); if (j >= 0) { if (gm[j][1] * 10 + gm[j][2] >= pw) return false; gm.splice(j, 1); } else if (gm.length >= GM_CAP) return false;
        gm.push([L.i, L.tier || 1, L.lv || 1]); this.applyGM(t, M, L.tier || 1, L.lv || 1); break; }
      case 'mod': { const fl = t.modN || 0; if (fl >= MOD_CAP) return false; /* r25: 10 mod slots (was 4) */ t.modN = fl + 1; this.applyFx(t, MODS2[L.i].fx); break; }
    }
    this.ev({ k: 'pick', id: t.id, type: 'lx', lid: p.lid, x: p.x, y: p.y }); return true; }
  fireRocket(t) { const A = t.rkA, i = t.rkT; if (!A || !i || !(A[i] > 0) || t.empT > 0) return; const R = ROCKETS[i]; A[i]--; if (!A[i]) { const j = A.findIndex(v => v > 0); t.rkT = j > 0 ? j : 0; }
    const sp = 240 * (R.spd || 1), a = t.ta, bx = t.x + Math.cos(a) * 12, by = t.y + Math.sin(a) * 12;
    this.bullets.push({ id: this.id(), x: bx, y: by, px: bx, py: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: R.dmg * ROCKET_K * (this.opts.hpMul ?? HP_MUL) / 3 * ((t.fx && t.fx.rocketDmg) || 1) * (this.opts.equal ? 1 : R.myth ? 1.2 : R.leg ? 1.1 : 1), owner: t.id, team: t.team, life: R.rng || 1.8, w: 'rocket', xr: i, lob: !!R.arc, lockR: R.hm ? HROCKET_LOCK : 0, lock: 0, splash: R.splash || 0, cluster: R.cluster || 0, freeze: R.freeze || 0, burn: R.burn, emp: R.emp, vsArm: R.vsArm, brick: R.brick || 1, steel: !!R.steel, smk: R.smoke ? 1 : 0, reveal: R.reveal, pull: R.pull, knock: R.knock, acid: R.acid, chain: R.chain, aa: R.aa, guide: R.guide ? t.id : 0, mines: R.mines, sh: 1, hit: null, layer: t.layer | 0 });
    this.ev({ k: 'shot', x: bx, y: by, a, w: 'rocket', o: t.id }); this.ev({ k: 'use', id: t.id, it: 'rocket', x: t.x, y: t.y }); }
  areaFx(b) { if (!b.splash) return; for (const o of this.near(b.x, b.y, b.splash, [])) if (o.alive && o.team !== b.team && Math.hypot(o.x - b.x, o.y - b.y) < b.splash) this.shellHit(b, o);
    if (b.mines) for (let k = 0; k < b.mines; k++) this.mines.push({ id: this.id(), x: b.x + (this.rng() - 0.5) * 30, y: b.y + (this.rng() - 0.5) * 30, team: b.team, owner: b.owner, arm: 0.8, layer: b.layer | 0 }); }
  mineBoom(m, MK, t0) { const hp = (this.opts.hpMul ?? HP_MUL); if (MK.dmg) this.explode(m.x, m.y, MK.splash || 30, MK.dmg * hp / 3, m.owner, 'mine', m.team);
    const b = { x: m.x, y: m.y, team: m.team, owner: m.owner, splash: MK.splash || 16, emp: MK.emp, freeze: MK.freeze, reveal: MK.reveal, dmg: 0 }; this.areaFx(b);
    if (MK.smoke) this.smokes.push({ id: this.id(), x: m.x, y: m.y, r: 44, t: 8, max: 8 }); if (MK.cluster) for (let k = 0; k < MK.cluster; k++) { const a = k / MK.cluster * TAU; this.explode(m.x + Math.cos(a) * 20, m.y + Math.sin(a) * 20, 14, MK.dmg * hp / 8, m.owner, 'mine', m.team); }
    if (MK.decoy && t0) { t0.revT = Math.max(t0.revT || 0, 8); t0.revTeam = m.team; this.ev({ k: 'chat', id: m.owner, team: m.team, name: 'Приманка', txt: 'Враг на приманке!', x: m.x, y: m.y, ping: 1, req: 'help' }); }
  }
  setShell(t, i) { if (!t.shA || i < 0 || i >= SHELLS.length) return; if (i && !(t.shA[i] > 0)) return; t.shT = i; }
  shellHit(b, t) { if (!t.alive) return; const TF = t.fx || {};
    if (b.reveal) { t.revT = Math.max(t.revT || 0, b.reveal); t.revTeam = b.team; } if (b.acid && t.armorHp > 0) { t.armorHp = Math.max(0, t.armorHp - b.acid); if (!t.armorHp) { t.armorT = 0; t.armorK = 0; } }
    if (b.knock || b.pull) { const o = this.byId.get(b.owner), ang = b.pull && o ? Math.atan2(o.y - t.y, o.x - t.x) : Math.atan2(t.y - b.y, t.x - b.x), f = b.pull || b.knock; t.vx += Math.cos(ang) * f; t.vy += Math.sin(ang) * f; }
    if (b.pbreak && this.rng() < 0.5) { const bit = [2, 4][(this.rng() * 2) | 0]; t.pbroke = (t.pbroke || 0) | bit; }
    if (b.freeze) t.slowT = Math.max(t.slowT || 0, b.freeze);
    if (b.chain && !b._ch) { let best = null, bd = 60 * 60; for (const o of this.tanks) { if (o === t || !o.alive || o.team === b.team) continue; const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d < bd) { bd = d; best = o; } } if (best) { this.ev({ k: 'zap', x: t.x, y: t.y, x2: best.x, y2: best.y }); this.damage(best, b.dmg * b.chain, b.owner, 'emp', t.x, t.y); } }
    if (TF.burnImm) b = { ...b, burn: 0 }; if (TF.empImm) b = { ...b, emp: 0 }; if (b.burn && !(t.armorHp > 0 && t.armorK === 5)) { t.burnT = b.burn; t.burnBy = b.owner; } if (b.emp && !(t.armorHp > 0 && t.armorK === 6)) t.empT = Math.max(t.empT || 0, b.emp); }
  freeSpot(minDist, tries = 400) {
    const m = this.map;
    for (let i = 0; i < tries; i++) {
      const x = this.rng.range(40, m.pw - 40), y = this.rng.range(40, m.ph - 40);
      if (m.tankBlockedAt(x, y, TANK_R + 3)) continue;
      const v = m.get(Math.floor(x / CELL), Math.floor(y / CELL)); if (v === T_BUSH || v === T_ICE) continue;
      if (this.tanks.some(t => t.alive && (t.x - x) ** 2 + (t.y - y) ** 2 < minDist * minDist)) continue;
      return [x, y];
    }
    return [this.map.pw / 2, this.map.ph / 2];
  }
  botSkill() { return this.rng.range(this.diff.sk[0], this.diff.sk[1]); }
  botLv(maxL) { maxL = this.diff.lv; const r = this.rng; return { dmg: r.int(0, maxL), reload: r.int(0, maxL), armor: r.int(0, maxL), engine: r.int(0, maxL) }; }
  initBR() {
    const o = this.opts; this.map = genBR(this.seed, o.mapSize || 340); const m = this.map;
    const total = o.total || 100, humans = o.players || [];
    this.zone = { cx: m.pw / 2, cy: m.ph / 2, r: Math.hypot(m.pw, m.ph) / 2 + 40, tcx: m.pw / 2, tcy: m.ph / 2, tr: 0, phase: -1, timer: 0, state: 'wait', dps: 0, sr: 0, scx: 0, scy: 0 };
    this.ffa = !!o.ffa; if (this.ffa) { this.target = o.target || 25; this.timeLimit = o.timeLimit || 300; }
    this.zonePhases = this.ffa ? [] : o.zonePhases || [
      // ~20 min match: waits 650 s + shrinks 520 s = 1170 s, the last circle closes at 19:30
      { wait: 120, shrink: 80, frac: 0.88, dps: 2 }, { wait: 110, shrink: 80, frac: 0.7, dps: 4 }, { wait: 100, shrink: 80, frac: 0.52, dps: 6 },
      { wait: 95, shrink: 75, frac: 0.36, dps: 9 }, { wait: 85, shrink: 75, frac: 0.22, dps: 13 }, { wait: 75, shrink: 70, frac: 0.1, dps: 20 }, { wait: 65, shrink: 60, frac: 0, dps: 34 } ];
    if (o.giant && !o.zonePhases) this.zonePhases = this.zonePhases.map(ph => ({ ...ph, wait: ph.wait * 3, shrink: ph.shrink * 3 })); // «Гигантская»: same 7 circles stretched over ~58.5 min
    this.nextZone();
    // floor loot (hidden until close, «ВЗЯТЬ» for players): dense, scales with map area
    const nLoot = Math.round(520 * (m.pw * m.ph) / (2720 * 2720)); for (let i = 0; i < nLoot; i++) { const sp = this.freeSpot(0, 30); if (sp) this.dropLoot(sp[0], sp[1]); }
    { const nb = m.pw > 1600 ? 1 + Math.floor(this.rng() * 3) : 1; for (let i = 0; i < nb; i++) { const sp = this.freeSpot(0, 30); if (sp) this.dropLoot(sp[0], sp[1], 'beacon'); } } // «Маяк»: 1–3 per BR map
    const names = (this.opts.botNames || []).concat(BOT_NAMES.slice().sort(() => this.rng() - 0.5)); let ni = 0;
    // jittered grid spawn so nobody starts on top of each other
    const g = Math.ceil(Math.sqrt(total)), cw = (m.pw - 120) / g, slots = [];
    for (let i = 0; i < g * g; i++) slots.push(i);
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    let si = 0;
    this.freeSpot = (md) => {
      for (let tries = 0; tries < 60; tries++) { const s = slots[si % slots.length], gx = s % g, gy = Math.floor(s / g);
        for (let k = 0; k < 30; k++) { const x = 60 + (gx + 0.15 + this.rng() * 0.7) * cw, y = 60 + (gy + 0.15 + this.rng() * 0.7) * cw; if (!m.tankBlockedAt(x, y, TANK_R + 3) && m.get(Math.floor(x / CELL), Math.floor(y / CELL)) !== T_ICE) { si++; return [x, y]; } }
        si++; }
      return World.prototype.freeSpot.call(this, md);
    };
    const sq = this.squad; this.squadCount = Math.ceil(total / sq); let lead = null;
    const spotFor = (i, md) => { if (i % sq === 0 || !lead) { lead = this.freeSpot(md); return lead; } for (let k = 0; k < 40; k++) { const a = this.rng() * TAU, r = 26 + this.rng() * (sq > 5 ? 90 : 40); const x = lead[0] + Math.cos(a) * r, y = lead[1] + Math.sin(a) * r; if (x > 30 && y > 30 && x < m.pw - 30 && y < m.ph - 30 && !m.tankBlockedAt(x, y, TANK_R + 3)) return [x, y]; } return this.freeSpot(md); };
    const teamOf = (i) => 1000 + Math.floor(i / sq);
    for (const h of humans) { const [x, y] = spotFor(this.tanks.length, 90); this.makeTank({ x, y, team: sq > 1 ? teamOf(this.tanks.length) : 1000 + this.tanks.length, name: h.name, cc: h.cc, skin: h.skin, weapon: h.weapon, lv: h.lv, human: true, tlv: h.tlv, rki: h.rki, extraLives: h.extraLives, tur: h.tur, buy: h.buy, ib: h.ib, cid: h.cid, model: h.model, build: h.build, a: this.rng() * TAU, inv: 3, hp: 140 }); }
    while (this.tanks.length < total) {
      const [x, y] = spotFor(this.tanks.length, 70); const sk = this.botSkill();
      const nm = names[ni % names.length] + (ni >= names.length ? ' ' + (1 + Math.floor(ni / names.length)) : ''); ni++;
      this.makeTank({ x, y, team: teamOf(this.tanks.length), name: nm, skin: this.rng.pick(BOT_SKINS), weapon: this.rng() < 0.6 ? 'cannon' : this.rng.pick(WEAPON_LIST), lv: this.botLv(this.opts.botLevel ?? 3), skill: sk, a: this.rng() * TAU, inv: 3, hp: 140 });
    }
    delete this.freeSpot;
    {
    }
    this.aliveCount = this.tanks.length; this.aliveTeams = new Set(this.tanks.map(t => t.team)).size;
  }
  nextZone() {
    const z = this.zone; z.phase++; const ph = this.zonePhases[Math.min(z.phase, this.zonePhases.length - 1)];
    if (z.phase >= this.zonePhases.length) { z.state = 'final'; return; }
    z.state = 'wait'; z.timer = ph.wait; z.sr = z.r; z.scx = z.cx; z.scy = z.cy; z.dps = z.phase === 0 ? 2 : this.zonePhases[z.phase - 1].dps;
    const S = Math.min(this.map.pw, this.map.ph) * 0.5;
    z.tr = S * ph.frac; const maxOff = Math.max(0, (z.phase === 0 ? S * 0.05 : Math.min(z.r, S) - z.tr));
    const a = this.rng() * TAU, d = this.rng() * maxOff * 0.9;
    z.tcx = Math.max(z.tr + 30, Math.min(this.map.pw - z.tr - 30, (z.phase === 0 ? this.map.pw / 2 : z.cx) + Math.cos(a) * d));
    z.tcy = Math.max(z.tr + 30, Math.min(this.map.ph - z.tr - 30, (z.phase === 0 ? this.map.ph / 2 : z.cy) + Math.sin(a) * d));
    if (z.tr < 1) { z.tcx = z.cx; z.tcy = z.cy; }
  }
  initTeam() {
    const o = this.opts; this.map = o.special === 'moba' ? genMoba(this.seed, o.map ?? -1) : o.special === 'race' ? genRace(this.seed, o.map || 0) : (o.custom && genCustom(o.custom)) || genArena(this.seed, o.map || 0, o.mapW || 150, o.mapH || 96); this.score = [0, 0]; this.target = o.target || 100; this.timeLimit = o.timeLimit || 480;
    const humans = o.players || []; const per = o.perTeam || 10; this.special = o.special || null; const sp0 = this.special;
    if (sp0 === 'sniper') for (const h of humans) h.weapon = 'rail';
    if (sp0 === 'race') { this.initRace(humans); return; }
    if (sp0 === 'ctf') { this.flags = [0, 1].map(team => { const sp = this.map.spawns[team]; const hx = sp.reduce((a, p) => a + p[0], 0) / sp.length + (team ? -40 : 40), hy = sp.reduce((a, p) => a + p[1], 0) / sp.length; return { team, hx, hy, x: hx, y: hy, carrier: 0, home: true, dropT: 0 }; }); }
    if (sp0 === 'koth') { this.hill = { x: this.map.pw / 2, y: this.map.ph / 2, r: 56, owner: -1, acc: [0, 0] }; }
    if (sp0 === 'survival' || sp0 === 'zombie') { this.wave = 0; this.waveT = 2; this.lives = o.lives ?? 3; this.timeLimit = 1e9; this.target = 1e9; }
    const names = (this.opts.botNames || []).concat(BOT_NAMES.slice().sort(() => this.rng() - 0.5)); let ni = 0;
    const counts = [0, 0];
    for (const h of humans) { const team = h.team ?? (counts[0] <= counts[1] ? 0 : 1); const sp = this.map.spawns[team][counts[team] % 10]; counts[team]++; this.makeTank({ x: sp[0], y: sp[1], team, name: h.name, cc: h.cc, skin: h.skin, weapon: h.weapon, lv: h.lv, human: true, tlv: h.tlv, rki: h.rki, extraLives: h.extraLives, tur: h.tur, buy: h.buy, ib: h.ib, cid: h.cid, model: h.model, a: team ? Math.PI : 0, inv: 3 }); }
    const perT = sp0 === 'survival' || sp0 === 'zombie' ? [Math.max(counts[0], o.allies ?? 0), 0] : sp0 === 'boss' ? [Math.max(counts[0], 4), 0] : o.noBots ? [counts[0], counts[1]] : [per, per];
    for (let team = 0; team < 2; team++) while (counts[team] < perT[team]) { const k = counts[team], sp = this.map.spawns[team][k % 10], off = Math.floor(k / 10) * 16 * (team ? -1 : 1); counts[team]++; this.makeTank({ x: sp[0] + off, y: sp[1], team, name: names[ni++ % names.length], skin: 'team', weapon: this.rng() < 0.55 ? 'cannon' : this.rng.pick(WEAPON_LIST), lv: this.botLv(this.opts.botLevel ?? 2), skill: this.botSkill(), a: team ? Math.PI : 0, inv: 3, hp: 100 }); }
    if (sp0 === 'moba') initMoba(this);
    if (sp0 === 'sniper') for (const t of this.tanks) { t.weapon = 'rail'; t.baseW = 'rail'; t.baseWeapon = 'rail'; t.ammo = null; }
    if (sp0 === 'boss') { const sp = this.map.spawns[1][2]; const hpM = this.diff.hp || 1; this.boss = this.makeTank({ x: sp[0] - 30, y: sp[1], team: 1, name: 'Босс «Мамонт»', skin: 'enemy_a', weapon: 'rocket', hp: Math.round(2600 * hpM), speed: 52, dmgMul: 1.6, skill: 0.85, a: Math.PI, inv: 0 }); this.boss.isBoss = true; this.boss.ammo = null;
      for (let k = 0; k < 3; k++) this.spawnWaveBot(false); }
  }
  initClassic(level) {
    const o = this.opts; this.level = level; this.map = genClassic(level); this.lives = o.lives ?? 3; this.score = o.score || 0;
    const L = CLASSIC_LEVELS[level % CLASSIC_LEVELS.length], loop = Math.floor(level / CLASSIC_LEVELS.length);
    this.levelName = L.name; this.queue = [];
    for (const k of Object.keys(L.mix)) for (let i = 0; i < L.mix[k]; i++) this.queue.push(k);
    this.queue.sort(() => this.rng() - 0.5); this.enemyTotal = this.queue.length; this.enemyKilled = 0; this.spawnTimer = 1; this.spawnIdx = 0;
    this.freezeT = 0; this.shovelT = 0; this.loopBonus = loop; this.baseAlive = true; this.killsByType = { b: 0, f: 0, p: 0, a: 0 };
    const humans = o.players || [];
    humans.forEach((h, i) => { const sp = this.map.spawns[i % 2]; this.makeTank({ x: sp[0], y: sp[1], team: 0, name: h.name, cc: h.cc, skin: h.skin, weapon: h.weapon, lv: h.lv, human: true, tlv: h.tlv, rki: h.rki, extraLives: h.extraLives, tur: h.tur, buy: h.buy, ib: h.ib, cid: h.cid, model: h.model, a: -Math.PI / 2, inv: 3, hp: 100 }); });
    this.spawnPoints = this.map.enemySpawns;
  }
  spawnClassicEnemy() {
    const k = this.queue.shift(); const E = ENEMY_TYPES[k]; const loop = this.loopBonus;
    const sp = this.spawnPoints[this.spawnIdx++ % 3];
    const idx = this.enemyTotal - this.queue.length;
    this.makeTank({ x: sp[0], y: sp[1], team: 1, name: E.name, skin: 'enemy_' + k, weapon: E.weapon, hp: E.hp, speed: E.speed * (1 + loop * 0.08), bulletMul: E.bspeed, dmgMul: 1.47 + loop * 0.1,
      skill: 0.45 + loop * 0.1, a: Math.PI / 2, etype: k, flash: idx === 4 || idx === 11 || idx === 18, inv: 0, spawnT: 1.0 });
    this.ev({ k: 'spawn', x: sp[0], y: sp[1] });
  }

  // ---------- spatial hash ----------
  rebuildHash() {
    this.hash.clear();
    for (const t of this.tanks) { if (!t.alive || t.spawnT > 0) continue; const k = ((t.x >> 6) & 0xffff) | (((t.y >> 6) & 0xffff) << 16); let a = this.hash.get(k); if (!a) this.hash.set(k, a = []); a.push(t); }
  }
  // r16 «Ремонтный комплект воскрешения»: rare, only in hard-to-reach / dangerous spots
  scatterLoot() { if (this.mode === 'classic' || this.special === 'race' || this.special === 'survival') return; const m = this.map, N = LOOT_K * Math.min(this.opts.giant ? 5000 : 1400, Math.round(m.pw * m.ph / (this.mode === 'br' ? 3600 : 6400))); let n = 0;
    for (let k = 0; k < N * 3 && n < N; k++) { const x = 30 + this.rng() * (m.pw - 60), y = 30 + this.rng() * (m.ph - 60); if (m.tankBlockedAt(x, y, 6)) continue; const lid = rollLootX(this.rng); this.pickups.push({ id: this.id(), x, y, type: 'lx', lid, wid: null, tier: LOOTX[lid].r, t: 0, life: 1e9, layer: 0 }); n++; } this.lootN = n; }
  initRevives() { this.scatterLoot(); const m = this.map, rng = this.rng, P = this.pickups, put = (x, y, layer) => { const p = { id: this.id(), x, y, type: 'revive', wid: null, tier: 3, t: 0, life: 1e9 }; P.push(p); if (layer) p.layer = 1; this.revSpots = (this.revSpots || 0) + 1; };
    const free = (x, y, M) => x > 12 && y > 12 && x < M.pw - 12 && y < M.ph - 12 && !M.tankBlockedAt(x, y, TANK_R);
    if (this.under && this.under.rooms.length) { const H = this.under.hatches || []; let best = null, bd = -1; for (const r of this.under.rooms) { let dm = 1e9; for (const h of H) dm = Math.min(dm, Math.hypot(h.x - r.x, h.y - r.y)); if (dm > bd) { bd = dm; best = r; } } if (best) put(best.x + 6, best.y, 1); } // deepest bunker room
    { const sw = []; for (let r = 2; r < m.h - 2; r += 2) for (let c = 2; c < m.w - 2; c += 2) if (m.get(c, r) === T_SWAMP && m.get(c + 1, r) === T_SWAMP && m.get(c, r + 1) === T_SWAMP && m.get(c - 1, r) === T_SWAMP && m.get(c, r - 1) === T_SWAMP) sw.push([c, r]); if (sw.length) { const q = sw[Math.floor(rng() * sw.length)]; put(q[0] * CELL + 4, q[1] * CELL + 4); } } // heart of a swamp
    if (this.mode === 'br') for (let k = 0, n = 0; k < 80 && n < 2; k++) { const e = rng() * 4 | 0, f = rng(), x = e === 0 ? 30 + rng() * 60 : e === 1 ? m.pw - 30 - rng() * 60 : f * m.pw, y = e === 2 ? 30 + rng() * 60 : e === 3 ? m.ph - 30 - rng() * 60 : f * m.ph; if (free(x, y, m)) { put(x, y); n++; } } // far edge = first to burn in the zone
    if (this.special === 'moba' && this.towers) for (const tm of [0, 1]) { const T = this.towers.filter(o => o.team === tm && !o.hq); if (!T.length) continue; const o = T[Math.floor(rng() * T.length)]; for (let k = 0; k < 20; k++) { const a = rng() * TAU, x = o.x + Math.cos(a) * 26, y = o.y + Math.sin(a) * 26; if (free(x, y, m)) { put(x, y); break; } } } // under enemy towers
  }
  // r16 item transfer between allies (server-validated: everything happens here in the sim)
  extractItem(t, kind, n) { n = Math.max(1, n | 0 || 1);
    switch (kind) {
      case 'weapon': { if (!t.weapon || t.weapon === 'cannon') return null; const o = { type: 'weapon', wid: t.weapon, tier: t.wtier || 1, ammo: t.ammo }; t.weapon = 'cannon'; t.wtier = 1; t.ammo = t.human ? null : (AMMO.cannon ?? null); t.outOfAmmo = false; return o; }
      case 'ammo': { if (t.shells != null) { const g = Math.min(n, t.shells); if (g <= 0) return null; t.shells -= g; return { type: 'shells', n: g }; } if (t.ammo != null && t.weapon !== 'cannon') { const g = Math.min(n, t.ammo); if (g <= 0) return null; t.ammo -= g; return { type: 'wammo', n: g, wid: t.weapon }; } return null; }
      case 'armor': { if (!t.armorT) return null; const o = { type: 'armor', tier: t.armorT, ak: t.armorK || 0, hp: t.armorHp }; t.armorT = 0; t.armorHp = 0; t.armorK = 0; return o; }
      case 'med': case 'smoke': case 'mine': { const k = kind + 's', g = Math.min(n, t[k] || 0); if (g <= 0) return null; t[k] -= g; return { type: kind, n: g }; }
      case 'hrocket': { const g = Math.min(n, t.hrockets || 0); if (g <= 0) return null; t.hrockets -= g; return { type: 'hrocket', n: g }; }
      case 'beacon': if (!t.beacons) return null; t.beacons = 0; return { type: 'beacon' };
      case 'radar': if (!t.radar) return null; t.radar = 0; return { type: 'radar' };
      case 'rkt': { const i = t.rkT, A = t.rkA; if (!A || !i || !(A[i] > 0)) return null; const g = Math.min(n, A[i]); A[i] -= g; if (!A[i]) { const j = A.findIndex((v, k) => k && v > 0); t.rkT = j > 0 ? j : 0; } return { type: 'rkt', i, n: g }; }
      case 'shl': { const i = t.shT, A = t.shA; if (!A || !i || !(A[i] > 0)) return null; const g = Math.min(n, A[i]); A[i] -= g; if (!A[i]) t.shT = 0; return { type: 'shl', i, n: g }; }
      case 'revive': if (!(t.revives > 0)) return null; t.revives--; t.rvg = null; return { type: 'revive' };
      default: { const M = MODS[kind]; if (!M || !((t.mods || 0) & M.bit)) return null; t.mods &= ~M.bit; return { type: kind }; } } }
  putItem(t, o) { if (o.type === 'shells') { if (t.shells == null) return false; const cap = BR_SHELLS * 2, g = Math.min(cap - t.shells, o.n); if (g <= 0) return false; t.shells += g; o.n -= g; return o.n <= 0 ? true : 'part'; }
    if (o.type === 'wammo') { if (t.weapon !== o.wid || t.ammo == null) return false; t.ammo += o.n; o.n = 0; return true; }
    return this.wreckItem(t, o); }
  giveItem(t, kind, n, drop) { let r = null; if (!drop) { let bd = GIVE_R * GIVE_R; for (const o of this.tanks) { if (!o.alive || !this.allyOf(t, o) || (o.layer | 0) !== (t.layer | 0)) continue; const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d < bd) { bd = d; r = o; } } if (!r) { if (t.human) this.ev({ k: 'note', id: t.id, txt: 'Рядом нет союзника' }); return false; } }
    const o = this.extractItem(t, kind, n); if (!o) return false; const n0 = o.n || 1;
    if (drop) { this.pickups.push({ id: this.id(), x: t.x - Math.cos(t.a || 0) * 16, y: t.y - Math.sin(t.a || 0) * 16, layer: t.layer | 0, type: 'wreck', wid: null, tier: 2, t: 0, life: 90, items: [o], owner: t.name, gift: t.team }); this.ev({ k: 'give', id: t.id, drop: 1, type: kind, x: t.x, y: t.y }); return true; }
    const res = this.putItem(r, o); if (res !== true && (o.n || !res)) this.putItem(t, o); // whatever didn't fit goes back
    if (!res) { if (t.human) this.ev({ k: 'note', id: t.id, txt: r.name + ': нет места' }); return false; }
    this.ev({ k: 'give', id: t.id, to: r.id, name: t.name, rname: r.name, type: kind, n: n0 - (o.n || 0), x: r.x, y: r.y }); if (r.ai) { r.ai.thx = t.id; } return true; }
  request(t, kind) { const R = this.reqs || (this.reqs = []); R.push({ id: t.id, team: t.team, kind, x: t.x, y: t.y, t: this.time }); if (R.length > 30) R.shift();
    this.ev({ k: 'chat', id: t.id, team: t.team, name: t.name, txt: REQ_TXT[kind] || kind, req: kind, x: t.x, y: t.y, ping: 1 }); }
  allyOf(a, b) { return a !== b && a.team === b.team && !this.ffa && this.mode !== 'classic' && (this.mode !== 'br' || this.squad > 1); }
  stepRevive(dt) { for (const t of this.tanks) { const R = t.rvg; if (!R) continue; const k = this.wrecks && this.wrecks.find(o => o.id === R.wk), o = this.byId.get(R.tid);
      if (!t.alive || !k || !o || o.alive) { t.rvg = null; if (k) k.rp = 0; continue; }
      if (Math.hypot(k.x - t.x, k.y - t.y) > REV_R + 4 || (k.layer | 0) !== (t.layer | 0)) { t.rvg = null; k.rp = 0; this.ev({ k: 'revive', s: 'cancel', id: t.id, x: k.x, y: k.y }); continue; } // kit kept, progress lost
      R.p += dt; k.rp = R.p / REV_T; if (R.p < REV_T) continue;
      t.rvg = null; t.revives = Math.max(0, (t.revives || 0) - 1); this.wrecks.splice(this.wrecks.indexOf(k), 1);
      o.alive = true; o.x = k.x; o.y = k.y; o.layer = k.layer | 0; o.hp = Math.round(o.maxHp * 0.4); o.shield = 0; o.inv = 2; o.vx = o.vy = 0; o.cd = 0.5; o.respawnT = 0; o.place = 0; o.spawnT = 0; if (o.pd) o.pd.fill(0.7);
      if (this.mode === 'br') this.aliveCount = this.tanks.filter(q => q.alive).length;
      this.ev({ k: 'revive', s: 'done', id: t.id, tid: o.id, x: k.x, y: k.y }); this.ev({ k: 'spawn', x: k.x, y: k.y }); if (o.ai) this.ev({ k: 'chat', id: o.id, team: o.team, name: o.name, txt: 'Спасибо!' }); } }
  initBunker() { // r15 underground level + rare loot in its rooms
    this.under = genBunker(this.map, this.seed); const R = this.under.rooms, n0 = this.pickups.length;
    for (const p of R) { for (let k = 0; k < 2; k++) this.dropLoot(p.x + (this.rng() - 0.5) * 30, p.y + (this.rng() - 0.5) * 30, undefined, 3); const q = this.rng(); const ty = q < 0.25 ? 'hrocket' : q < 0.5 ? 'repair' : q < 0.62 ? 'part_trk' : q < 0.72 ? 'radar' : q < 0.8 ? 'beacon' : 'med_l'; this.pickups.push({ id: this.id(), x: p.x, y: p.y, type: ty, wid: null, tier: 3, t: 0, life: 1e9 }); }
    for (let i = n0; i < this.pickups.length; i++) this.pickups[i].layer = 1;
  }
  inLayer(L, fn) { const m0 = this.map, L0 = this._L, nb = this.bullets.length, np = this.pickups.length, nm = this.mines ? this.mines.length : 0; if (L && this.under) { this.map = this.under; this._L = 1; } const r = fn(); this.map = m0; this._L = L0;
    if (L) { for (let i = nb; i < this.bullets.length; i++) this.bullets[i].layer = 1; for (let i = np; i < this.pickups.length; i++) if (this.pickups[i].layer == null) this.pickups[i].layer = 1; if (this.mines) for (let i = nm; i < this.mines.length; i++) this.mines[i].layer = 1; } return r; }
  near(x, y, r, out = []) {
    out.length = 0; const c0 = (x - r) >> 6, c1 = (x + r) >> 6, r0 = (y - r) >> 6, r1 = (y + r) >> 6;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const a = this.hash.get((cx & 0xffff) | ((cy & 0xffff) << 16)); if (a) for (const t of a) if ((t.layer | 0) === this._L) out.push(t); }
    return out;
  }
  enemies(a, b) { return a.team !== b.team; }

  // ---------- main step ----------
  step(dt) {
    if (!this._allyFix) { this._allyFix = 1; if (!this.ffa && this.mode !== 'classic') { const H = this.tanks.find(t => t.human); if (H) for (const t of this.tanks) if (t.ai && !t.human && t.team === H.team && !t.etype) t.ai.skill = 0.35 + this.rng() * 0.3; } } // r19: allies are always "fair" — difficulty only changes the enemies
    this.events.length = 0; this.noMythFloor();
    if (!this._buyDone && this.mode !== 'classic') for (const t of this.tanks) if (t.ai && !t.human && !t.gm) { const n = Math.min(4, ((this.diff && this.diff.lv) | 0) + (t.myth ? 1 : 0)); for (let q = 0; q < n; q++) this.botUpgrade(t, 1); t.upgN = 0; } // r27: bots start with persona mods by difficulty
    if (!this._buyDone) { this._buyDone = 1; for (const t of this.tanks) if (t._buy) { const B = t._buy; t._buy = null; for (const l of B.lx || []) if (LOOTX[l]) this.takeLX(t, { lid: l, x: t.x, y: t.y }); for (const k of B.pk || []) this.applyPickup(t, k === 'armor2' || k === 'armor3' ? { type: 'armor', tier: +k.slice(5), x: t.x, y: t.y, t: 0, life: 1 } : { type: k, tier: 1, x: t.x, y: t.y, t: 0, life: 1 }); } }
    if (this.sentries && this.sentries.length && this.state === 'game') this.stepSentries(dt);
    if (this.state === 'over') { this.time += dt; this.stepFx(dt); return; }
    if (this.state === 'countdown') { this.countdown -= dt; if (this.countdown <= 0) { this.state = 'play'; this.ev({ k: 'go' }); } this.rebuildHash(); return; }
    this.time += dt;
    if (!this._rvInit) { this._rvInit = 1; if (this.mode !== 'classic' && this.special !== 'race') this.initRevives(); }
    this.rebuildHash();
    for (const t of this.tanks) if (t.alive && t.ai && t.spawnT <= 0) { if (t.layer) this.inLayer(1, () => botThink(this, t, dt)); else botThink(this, t, dt);
      { // r17: bots sometimes ram — aggressive personas, or to finish off a low-HP enemy at close range
        const ai = t.ai, o = ai.target ? this.byId.get(ai.target) : null;
        if (o && o.alive && (o.layer | 0) === (t.layer | 0) && !this.allyOf(t, o)) { const d = Math.hypot(o.x - t.x, o.y - t.y), low = o.hp < o.maxHp * 0.15, ag = ai.pers === 'aggressive';
          if (!(ai.ramT > 0) && d < 75 && (low || ag) && this.rng() < (low ? 0.05 : 0.015)) ai.ramT = 1.4; // occasional, short charge
          if (ai.ramT > 0) { ai.ramT -= dt; if (d > 110 || t.hp < t.maxHp * 0.2) ai.ramT = 0; else { const a = Math.atan2(o.y - t.y, o.x - t.x); t.input.mx = Math.cos(a); t.input.my = Math.sin(a); } } } } }
    for (const t of this.tanks) { if (t.layer && t.alive) this.inLayer(1, () => this.stepTank(t, dt)); else this.stepTank(t, dt); }
    this.stepWrecks(); this.stepRevive(dt);
    if ((this._uj = (this._uj || 0) + dt) > 1) { this._uj = 0; for (const t of this.tanks) { if (!t.alive || t.sub) continue; const M = t.layer ? this.under : this.map; let wedge = false; if (t.ai) { const mv = t._jx == null ? 99 : Math.hypot(t.x - t._jx, t.y - t._jy); const tryMove = t.input && (t.input.mx || t.input.my) && !(t.ai.camp > 0) && !t.rvg; if (mv > 24 || !tryMove) { t._jx = t.x; t._jy = t.y; t._nm = 0; } else t._nm = (t._nm || 0) + 1; if (t._nm >= 4) { t._jx = null; } if (t._nm >= 4) { wedge = true; t._nm = 0; t.ai.wx = null; t.ai.lootP = null; t.ai.mem = null; } }
        if (!M) continue; if (wedge) { const a0 = Math.random() * TAU; for (let r = 24; r < 120; r += 12) { let moved = false; for (let k = 0; k < 12; k++) { const a = a0 + k / 12 * TAU, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r; if (x > 10 && y > 10 && x < M.pw - 10 && y < M.ph - 10 && !M.tankBlockedAt(x, y, TANK_R + 2) && M.get(Math.floor(x / CELL), Math.floor(y / CELL)) !== T_SWAMP) { t.x = x; t.y = y; moved = true; break; } } if (moved) break; } continue; } // wedged bot (no progress 10 s while driving): nudge to a free spot
        if (!M.tankBlockedAt(t.x, t.y, TANK_R)) { t.jam = 0; continue; } if (++t.jam < 3) continue; t.jam = 0; // embedded in a wall for 3 s (bad spawn / pushed): pop out to the nearest free spot
      done: for (let r = 8; r < 200; r += 6) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r; if (x > 10 && y > 10 && x < M.pw - 10 && y < M.ph - 10 && !M.tankBlockedAt(x, y, TANK_R)) { t.x = x; t.y = y; break done; } } } }
    this.beaconStep();
    this.separate();
    this.rebuildHash();
    this.stepBullets(dt);
    this.stepPickups(dt); if (this.mode !== 'classic') this.stepItems(dt);
    if (this.mode === 'br') this.stepZone(dt); else if (this.mode === 'team') this.stepTeam(dt); else this.stepClassic(dt);
  }
  stepFx(dt) { for (const t of this.tanks) if (t.alive) { t.input.mx = t.input.my = 0; t.input.fire = false; } this.stepBullets(dt); }

  stepTank(t, dt) {
    if (!t.alive) {
      if (t.waitBuy && t.input && t.input.an && t.input.an !== t.an) { t.an = t.input.an; if (t.input.act === 'buylife') this.doAction(t, 'buylife'); }
      if (this.mode === 'br' && !this.ffa && !t.alive && t.respawnT > 0 && !this.result) { t.respawnT -= dt; if (t.respawnT <= 0) { if (t.waitBuy) { t.waitBuy = false; t.noBuy = true; this.brOut(t); } else this.respawnBR(t); } }
      if ((this.mode === 'team' || this.ffa) && t.respawnT > 0) { t.respawnT -= dt; if (t.respawnT <= 0) { if (t.waitBuy) { t.waitBuy = false; t.noBuy = true; this.lifeOut(t); } else (this.ffa ? this.respawnFFA(t) : this.respawnTeam(t)); } }
      return;
    }
    if (t.spawnT > 0) { t.spawnT -= dt; return; }
    t.inv = Math.max(0, t.inv - dt); t.speedT = Math.max(0, t.speedT - dt); t.powerT = Math.max(0, t.powerT - dt); t.hitT = Math.max(0, t.hitT - dt); t.recoil = Math.max(0, t.recoil - dt * 6);
    t.cd -= dt;
    if (t.shBMax) { if (t.shBT > 0) t.shBT -= dt; else if (t.shBHp < t.shBMax) t.shBHp = Math.min(t.shBMax, t.shBHp + t.shBMax * 0.15 * dt); } if (t.apsMax && t.apsN < t.apsMax) { t.apsR = (t.apsR || 0) + dt; if (t.apsR > 30) { t.apsR = 0; t.apsN++; } } if (t.fx && t.fx.ext && t.burnT > 0) t.burnT -= dt * t.fx.ext * 2; // r27
    if (t.invisT > 0) t.invisT -= dt; if (t.invisCd > 0) t.invisCd -= dt; if (t.revealI > 0) t.revealI -= dt; t.cloaked = t.invisT > 0 && !(t.revealI > 0);
    const inp = t.input; const frozen = (this.mode === 'classic' && t.team === 1 && this.freezeT > 0);
    let mx = frozen ? 0 : inp.mx, my = frozen ? 0 : inp.my; const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    if (t.ai && t.alive && t.rkT && t.rkA && t.ai.target && this.rng() < dt * 0.5) { const tg = this.byId.get(t.ai.target); if (tg && tg.alive && Math.hypot(tg.x - t.x, tg.y - t.y) < 230) this.fireRocket(t); }
    if (t.fx && t.alive) { const F = t.fx; if (F.regen && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + F.regen * dt * (this.opts.hpMul ?? HP_MUL) / 3); if (F.shieldRegen && this.time - (t.lastHurt ?? -99) > 5 && (t.shield || 0) < 30) t.shield = (t.shield || 0) + 4 * dt; if (F.empImm) t.empT = 0; }
    if (t.eq && t.alive) { const E = t.eq; if (E.includes('ext') && t.burnT > 0) t.burnT -= dt * 2; const q = this.time - (t.lastHurt ?? -99); if (E.includes('repair') && q > 4 && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.02 * dt); if (E.includes('shieldg') && q > 8 && (t.shield || 0) < t.maxHp * 0.15) t.shield = Math.min(t.maxHp * 0.15, (t.shield || 0) + t.maxHp * 0.03 * dt); }
    if (t.slowT > 0) t.slowT -= dt; if (t.empT > 0) t.empT -= dt; if (t.stunT > 0) t.stunT -= dt;
    if (t.burnT > 0) { t.burnT -= dt; t.burnAcc = (t.burnAcc || 0) + dt; if (t.burnAcc >= 0.5) { t.burnAcc = 0; this.damage(t, 1.5 * (this.opts.hpMul ?? HP_MUL), t.burnBy || 0, 'burn', t.x, t.y); if (!t.alive) return; } }
    const pd = t.pd || (t.pd = [1, 1, 1, 1, 1]); t.pbroke = (pd[0] <= 0 ? 1 : 0) | (pd[1] <= 0 ? 2 : 0) | (pd[2] <= 0 ? 4 : 0) | (pd[3] <= 0 ? 8 : 0) | (pd[4] <= 0 ? 16 : 0); // persistent, no auto-heal
    if (t.stunT > 0 && t.input) { t.input.mx += (this.rng() - 0.5) * 0.9; t.input.my += (this.rng() - 0.5) * 0.9; } // crew stun: control shake
    if (t.regenT > 0) { t.regenT -= dt; t.hp = Math.min(t.maxHp, t.hp + t.regenR * dt); }
    if (t.armorK === 3 && t.armorT && t.armorHp < armorMax(t.armorT)) t.armorHp = Math.min(armorMax(t.armorT), t.armorHp + 2.5 * dt);
    const sp = t.speed * (1 + UPGRADES.engine.per * t.lv.engine) * (t.speedT > 0 ? 1.45 : 1) * (t.slowT > 0 ? 0.45 : 1) * (t.pbroke & 4 ? 0.38 : 1) * (t.pbroke & 8 ? 0.78 : 1) * (this.mode === 'classic' ? 1 : 1 - (0.2 * (t.lk = loadK(t)) + 0.55 * t.lk ** 3)) /* r25: progressive — light load mild, very heavy load strong */; // r19 weight; broken tracks: ~38% speed
    const cell = this.map.get(Math.floor(t.x / CELL), Math.floor(t.y / CELL)); const ice = cell === T_ICE;
    const tk = (t.sub ? 0.25 : 1) * (cell === T_SWAMP ? Math.min(1, SWAMP_SPD + ((t.fx && t.fx.mudRes) || 0)) : cell === T_MUD ? Math.min(1, MUD_SPD + ((t.fx && t.fx.mudRes) || 0)) : cell === T_WATER ? Math.min(1, WATER_SPD + ((t.fx && t.fx.amph) || 0)) : 1); // r27 wide tracks / winch / amphibious kit // r25 water ford; submerged: ~25% of normal
    const tvx = mx * sp * tk, tvy = my * sp * tk, k = ice ? 1 - Math.exp(-dt * 2.2) : 1 - Math.exp(-dt * 18 * (t.accMul || 1)); // extra guns = heavier = slower to accelerate
    t.vx += (tvx - t.vx) * k; t.vy += (tvy - t.vy) * k;
    if (mag > 0.15) { const want = Math.atan2(my, mx); const d = angDiff(t.a, want); t.a += Math.sign(d) * Math.min(Math.abs(d), dt * 11 * Math.min(1, 0.15 + Math.abs(d) * 1.3)); } // r23: eased (slows into the target angle, no snap)
    this.moveTank(t, t.vx * dt, t.vy * dt);
    t.tread += Math.hypot(t.vx, t.vy) * dt;
    { const m = this.map, q = TANK_R * 0.7, at = (x, y) => m.get(Math.floor(x / CELL), Math.floor(y / CELL));
      const c0 = at(t.x, t.y), full = c0 === T_SWAMP && at(t.x - q, t.y - q) === T_SWAMP && at(t.x + q, t.y - q) === T_SWAMP && at(t.x - q, t.y + q) === T_SWAMP && at(t.x + q, t.y + q) === T_SWAMP;
      t.terr = full ? 2 : c0 === T_SWAMP ? 3 : c0 === T_MUD ? 1 : 0; // 2 = fully in swamp (hidden), 3 = swamp edge, 1 = mud
      t.inBush = c0 === T_BUSH || this.inSmoke(t.x, t.y) || full;
      // r25: water — 30 s safe, then armour then HP drain until the tank leaves; splash on entry, wake events while moving
      if (c0 === T_WATER && !t.sub) { if (!t.wIn) { t.wIn = 1; this.ev({ k: 'splash', id: t.id, x: t.x, y: t.y, s: Math.min(1, Math.hypot(t.vx, t.vy) / 60) }); } t.wT = (t.wT || 0) + dt;
        if (Math.hypot(t.vx, t.vy) > 12 && (t._wk = (t._wk || 0) + dt) > 0.25) { t._wk = 0; this.ev({ k: 'wake', id: t.id, x: t.x, y: t.y, a: t.a }); }
        if (t.wT > WATER_SAFE) { t._wd = (t._wd || 0) + dt; if (t._wd >= 0.5) { const k = t._wd; t._wd = 0; const over = t.wT - WATER_SAFE, rate = 0.03 * (over > 15 ? 1.6 : 1);
          if (t.armorT && t.armorHp > 0) { t.armorHp = Math.max(0, t.armorHp - 8 * k * (over > 15 ? 1.6 : 1)); if (t.armorHp <= 0) { t.armorT = 0; t.armorK = 0; this.ev({ k: 'armorBreak', id: t.id }); } }
          else this.damage(t, t.maxHp * rate * k * (t.armMul || 1), null, 'water', t.x, t.y); } } }
      else { if (t.wIn) { t.wIn = 0; this.ev({ k: 'splash', id: t.id, x: t.x, y: t.y, s: 0.5 }); } if (t.wT) t.wT = Math.max(0, t.wT - dt * 3); }
      t.seeR = full ? SWAMP_SEE : t.inBush ? BUSH_SEE : c0 === T_MUD ? MUD_SEE : 1e9;
      if (t.surfT > 0) t.surfT -= dt; if (t.diveCd > 0) t.diveCd -= dt;
      if (t.sub) { t.oxy -= dt; t.inBush = true; t.seeR = DIVE_SEE; if (!full || t.oxy <= 0) { this.surface(t); if (t.oxy <= 0) t.diveCd = DIVE_CD; } }
      else if ((t.oxy ?? DIVE_MAX) < DIVE_MAX) t.oxy = Math.min(DIVE_MAX, (t.oxy ?? DIVE_MAX) + dt * 1.5);
      if (t.surfT > 0) { t.inBush = full; }
      if (t.beaconT > 0) t.beaconT -= dt;
      if (t.revT > 0) { t.revT -= dt; if (t.revT <= 0) t.revTeam = null; } }
    if (this.mode !== 'classic') {
      if (inp.an && inp.an !== t.an) { t.an = inp.an; this.doAction(t, inp.act); }
      if (t.ai && t.ai.itemT === undefined) t.ai.itemT = 0;
      if (t.ai && (t.ai.itemT -= dt) <= 0) { t.ai.itemT = 0.8 + this.rng() * 0.8;
        if (t.meds && t.hp < t.maxHp * 0.45) this.doAction(t, 'med');
        else if (t.blocksN > 0 && t.ai.target && t.hp < t.maxHp * 0.6 && this.rng() < 0.03) this.doAction(t, 'blocks'); // r20: bots take cover too
        else if (t.sentryN > 0 && t.ai.target && this.rng() < 0.02) this.doAction(t, 'sentry'); // r20: bots deploy sentries in a fight
        else if (t.beacons && !(t.beaconT > 0) && ((this.time - (t.lastAtkT || -9) < 1 && !t.ai.target) || this.rng() < 0.0008)) this.doAction(t, 'beacon');
        else if (t.smokes && t.hp < t.maxHp * 0.3 && this.time - (t.lastAtkT || -9) < 1.5) this.doAction(t, 'smoke');
        else if (t.mines && this.time - (t.lastAtkT || -9) < 2 && this.rng() < 0.25) this.doAction(t, 'mine'); }
      // bots fire pack rockets when their target is inside lock range (weak bots hesitate more)
      if (t.ai && t.hrockets && t.ai.target && (t.ai.react || 0) <= 0 && this.rng() < (0.15 + t.ai.skill * 0.35) * (this.diff && this.diff.rk != null && (this.byId.get(t.ai.target) || {}).human ? this.diff.rk : 1)) { const o = this.byId.get(t.ai.target); if (o && o.alive && !o.inBush && Math.hypot(o.x - t.x, o.y - t.y) < HROCKET_LOCK * 1.3 && Math.abs(angDiff(t.ta, Math.atan2(o.y - t.y, o.x - t.x))) < 0.6) this.doAction(t, 'hrocket'); }
    }
    // turret
    let aimA = t.ta;
    if (inp.aim && (inp.ax || inp.ay)) aimA = Math.atan2(inp.ay, inp.ax);
    else if (mag > 0.15) aimA = t.a;
    const dA = angDiff(t.ta, aimA); t.ta += Math.sign(dA) * Math.min(Math.abs(dA), Math.min(1, 0.2 + Math.abs(dA) * 1.5) * dt * (t.human ? 16 : 7) * ((t.fx && t.fx.turn) || 1) * (t.pbroke & 1 ? 0.35 : 1) * (1 - 0.4 * (t.lk || 0)));
    if (inp.fire && t.sub) { this.surface(t); inp.fire = false; } // firing makes the tank surface first
    if (t.rvg) inp.fire = false; // can't shoot while repairing
    if (inp.fire && t.cd <= 0 && !frozen && !(t.empT > 0) && !(t.surfT > 0)) {
      if (t.ammo == null && t.shells != null && t.shells <= 0) { if (this.time - (t.noAmmoT ?? -9) > 1.5) { t.noAmmoT = this.time; this.ev({ k: 'noammo', id: t.id, w: 'base' }); } }
      else if (!t.mounts || !t.mounts.length || !((t.fgrp | 0) >= 2)) this.fire(t);
    }
    if (t.mounts && t.mounts.length) { for (const m of t.mounts) m.cd -= dt; const canM = !frozen && !(t.empT > 0) && !(t.surfT > 0) && !t.rvg && !t.sub; if (inp.fire && (t.fgrp | 0) !== 1 && canM) this.fireMounts(t); else if (canM && t.mounts.some(m => m.auto)) this.fireMounts(t, true); }
  }
  moveTank(t, dx, dy) {
    const m = this.map, r = TANK_R;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
    dx /= steps; dy /= steps;
    for (let s = 0; s < steps; s++) {
      if (dx) {
        if (!m.tankBlockedAt(t.x + dx, t.y, r)) t.x += dx;
        else { let ok = false; for (const o of [1, -1, 2, -2, 3, -3, 4, -4]) { if (Math.abs(dy) > Math.abs(dx) * 0.5) break; if (!m.tankBlockedAt(t.x + dx, t.y + o, r) && !m.tankBlockedAt(t.x, t.y + o, r)) { t.y += Math.sign(o) * Math.min(Math.abs(o), Math.abs(dx) * 0.9 + 0.3); ok = true; break; } } if (!ok) t.vx *= 0.5; }
      }
      if (dy) {
        if (!m.tankBlockedAt(t.x, t.y + dy, r)) t.y += dy;
        else { let ok = false; for (const o of [1, -1, 2, -2, 3, -3, 4, -4]) { if (Math.abs(dx) > Math.abs(dy) * 0.5) break; if (!m.tankBlockedAt(t.x + o, t.y + dy, r) && !m.tankBlockedAt(t.x + o, t.y, r)) { t.x += Math.sign(o) * Math.min(Math.abs(o), Math.abs(dy) * 0.9 + 0.3); ok = true; break; } } if (!ok) t.vy *= 0.5; }
      }
    }
  }
  separate() {
    const tmp = [];
    // r17: ramming — velocity estimated from movement since the last pass; mass from max HP + armour
    const now = this.time, idt = 1 / Math.max(1 / 120, now - (this._sepT ?? now - 1 / 30)); this._sepT = now;
    for (const t of this.tanks) { if (t._sx == null) { t._sx = t.x; t._sy = t.y; } t._vx = (t.x - t._sx) * idt; t._vy = (t.y - t._sy) * idt; t._sx = t.x; t._sy = t.y; }
    const mass = (t) => (t.maxHp || 100) * (1 + (t.armor || 0) * 0.5) * (t.isBoss ? 3 : 1);
    for (const t of this.tanks) {
      if (!t.alive || t.spawnT > 0) continue; this._L = t.layer | 0; const MM = t.layer && this.under ? this.under : this.map; // fix: layer index could leak from item loops (tanks ghosted through each other)
      for (const o of this.near(t.x, t.y, TANK_R * 2 + 2, tmp)) {
        if (o.id <= t.id || !o.alive || (o.layer | 0) !== (t.layer | 0)) continue;
        const dx = o.x - t.x, dy = o.y - t.y, d2 = dx * dx + dy * dy, min = TANK_R * 2;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, mt = mass(t), mo = mass(o), ov = min - d;
          const pt = ov * mo / (mt + mo), po = ov * mt / (mt + mo); // heavy builds push light ones
          if (!MM.tankBlockedAt(t.x - nx * pt, t.y - ny * pt, TANK_R)) { t.x -= nx * pt; t.y -= ny * pt; }
          if (!MM.tankBlockedAt(o.x + nx * po, o.y + ny * po, TANK_R)) { o.x += nx * po; o.y += ny * po; }
          const rv = (t._vx - o._vx) * nx + (t._vy - o._vy) * ny; // closing speed along the contact normal (px/s)
          if (rv > 45) { const key = t.id * 4096 + o.id, R = this._ramCd || (this._ramCd = new Map()); if ((R.get(key) || 0) > now) continue; R.set(key, now + 1.5); if (R.size > 4000) R.clear();
            const tFast = (t._vx * nx + t._vy * ny) >= -(o._vx * nx + o._vy * ny), A = tFast ? t : o, B = tFast ? o : t, mA = tFast ? mt : mo, mB = tFast ? mo : mt;
            const ex = Math.max(-1, (rv - 45) / 6); // knockback impulse
            if (!MM.tankBlockedAt(B.x + (tFast ? nx : -nx) * ex * mA / mB, B.y + (tFast ? ny : -ny) * ex * mA / mB, TANK_R)) { B.x += (tFast ? nx : -nx) * Math.min(14, ex * mA / mB); B.y += (tFast ? ny : -ny) * Math.min(14, ex * mA / mB); }
            const foe = !this.allyOf(t, o);
            const k = Math.min(1, (rv - 45) / 90), mr = Math.max(0.6, Math.min(1.6, mA / mB)), pct = (0.03 + 0.03 * k) * mr;
            if (foe && !(B.inv > 0)) { this.damage(B, Math.round(Math.min(0.06, pct) * B.maxHp), A.id, 'ram', B.x, B.y); this.damage(A, Math.round(0.012 * A.maxHp), B.id, 'ram', A.x, A.y);
              const side = Math.abs(Math.sin(Math.atan2(tFast ? ny : -ny, tFast ? nx : -nx) - B.a)); if (side > 0.7 && k > 0.5 && this.rng() < 0.2 && B.pd) B.pd[2] = Math.max(0, B.pd[2] - 0.45); }
            this.ev({ k: 'ram', x: (t.x + o.x) / 2, y: (t.y + o.y) / 2, a: A.id, b: B.id, f: foe ? 1 : 0, s: k });
          }
        }
      }
    }
  this._L = 0; }
  hrLockTarget(t) { let best = null, bd = HROCKET_LOCK * HROCKET_LOCK; for (const o of this.tanks) { if (!o.alive || (o.layer | 0) !== (t.layer | 0) || o.team === t.team || (o.inBush && !this.revealedTo(o, t.team)) || o.spawnT > 0) continue; const d2 = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d2 < bd) { bd = d2; best = o; } } return best; }
  inSmoke(x, y) { for (const s of this.smokes) if ((s.x - x) ** 2 + (s.y - y) ** 2 < s.r * s.r) return true; return false; }
  nearestPickup(t, r = 18) { let best = null, bd = r * r; for (const p of this.pickups) { if ((p.layer | 0) !== (t.layer | 0)) continue; const d = ((p.x - t.x) ** 2 + (p.y - t.y) ** 2) * (p.type === 'wreck' ? 0.4 : 1); if (d < bd) { bd = d; best = p; } } return best; }
  doAction(t, act) {
    if (act === 'buylife') { if (t.alive || !t.waitBuy || !t.human) return; t.lives = 1 + Math.min(3, (t.lifeBuys = (t.lifeBuys || 0) + 1) > 3 ? 0 : 1); t.waitBuy = false; t.respawnT = 0.6; this.ev({ k: 'life', id: t.id, n: t.lives, buy: 1 }); return true; } // r26: «Купить жизнь» on the death screen (coins are charged client-side)
    if (!t.alive || t.spawnT > 0) return;
    if (act === 'blocks') { if (!(t.blocksN > 0) || this.mode === 'classic') return; const m = this.map, a = t.ta ?? t.a ?? 0, cs = Math.cos(a), sn = Math.sin(a); let n = 0;
      for (let d = 0; d < 2; d++) for (let k = -2; k <= 2; k++) { const x = t.x + cs * (20 + d * CELL) - sn * k * CELL, y = t.y + sn * (20 + d * CELL) + cs * k * CELL, c = Math.floor(x / CELL), r = Math.floor(y / CELL); if (c < 1 || r < 1 || c >= m.w - 1 || r >= m.h - 1) continue; const v = m.get(c, r); if (v !== T_EMPTY && v !== T_ICE && v !== T_MUD) continue;
        if (this.tanks.some(o => o.alive && Math.abs(o.x - (c * CELL + 4)) < TANK_R + 4 && Math.abs(o.y - (r * CELL + 4)) < TANK_R + 4)) continue; m.set(c, r, 11); m.hp[r * m.w + c] = 1; n++; }
      if (n) { t.blocksN--; this.ev({ k: 'note', id: t.id, txt: 'Бетонные блоки установлены' }); this.ev({ k: 'brick', x: t.x + cs * 24, y: t.y + sn * 24 }); } return; }
    if (act === 'sentry') { if (t.sentryN > 0 && this.mode !== 'classic') { t.sentryN--; const S0 = this.sentries || (this.sentries = []); const x = t.x - Math.cos(t.a || 0) * 14, y = t.y - Math.sin(t.a || 0) * 14; S0.push({ id: this.id(), x, y, layer: t.layer | 0, team: t.team, owner: t.id, hp: SENTRY.hp, maxHp: SENTRY.hp, ammo: SENTRY.ammo, cd: 0.6, a: t.ta || 0 }); this.ev({ k: 'note', id: t.id, txt: 'Турель установлена' }); } return; }
    if (act === 'beacon') { if (t.beacons > 0 && !(t.beaconT > 0)) { t.beacons--; t.beaconT = BEACON_T; this.ev({ k: 'beacon', id: t.id, x: t.x, y: t.y }); } return; }
    if (act.startsWith('mbuy_')) { const k = act.slice(5); if (this.special === 'moba' && MSHOP[k] && !buyMoba(this, t, k) && t.human) this.ev({ k: 'note', id: t.id, s: 'Магазин: нужно быть на базе и иметь золото' }); return; }
    if (act === 'bunker') { if (this.under && onHatch(this, t)) { t.layer = t.layer ? 0 : 1; t.inv = Math.max(t.inv || 0, 0.6); t.sub = 0; this.ev({ k: 'bunker', id: t.id, x: t.x, y: t.y, l: t.layer }); } else if (t.human) this.ev({ k: 'note', id: t.id, s: 'Встаньте на люк бункера' }); return; }
    if (act === 'dive') { // r15: full submersion in a swamp («Погрузиться» / «Всплыть»)
      if (t.sub) { this.surface(t); return; }
      if (t.terr === 2 && (t.diveCd || 0) <= 0 && !(t.surfT > 0)) { t.sub = 1; t.oxy = t.oxy ?? DIVE_MAX; this.ev({ k: 'dive', id: t.id, x: t.x, y: t.y }); } else if (t.human) this.ev({ k: 'note', id: t.id, txt: (t.diveCd || 0) > 0 ? 'Нужно отдышаться: ' + Math.ceil(t.diveCd) + ' с' : 'Погрузиться можно только целиком в болоте' });
      return; }
    if (act === 'take') { const p = this.nearestPickup(t); if (p) this.takePickup(t, p); return; }
    if (act.startsWith('give_') || act.startsWith('drop_')) { const [, kind, n] = act.split('_'); this.giveItem(t, kind === 'mod' ? 'mod_' + n : kind, kind === 'mod' ? 1 : +n || 1, act[0] === 'd'); return; }
    if (act.startsWith('req_')) { const k = act.slice(4); if (REQ_TXT[k] && this.time - (t.reqT || -9) > 2) { t.reqT = this.time; this.request(t, k); } return; }
    if (act === 'rkt') { this.fireRocket(t); return; }
    if (act === 'rk_next') { if (t.rkA) { for (let k = 1; k <= ROCKETS.length; k++) { const j = ((t.rkT || 0) + k) % ROCKETS.length; if (j && t.rkA[j] > 0) { t.rkT = j; break; } } this.ev({ k: 'note', id: t.id, txt: 'Ракета: ' + ROCKETS[t.rkT || 0].name }); } return; }
    if (act === 'det') { t.det = true; return; }
    if (act === 'shell' || /^shell_\d{1,2}$/.test(act)) { if (t.shA) { let i = t.shT || 0; if (act === 'shell') { for (let k = 1; k <= SHELLS.length; k++) { const j = (i + k) % SHELLS.length; if (!j || t.shA[j] > 0) { i = j; break; } } } else i = +act.slice(6); this.setShell(t, i); this.ev({ k: 'note', id: t.id, txt: 'Снаряд: ' + SHELLS[t.shT].name + (t.shT ? ' · ' + t.shA[t.shT] : ' · ∞') }); } return; }
    if (act === 'fgrp') { if (t.mounts && t.mounts.length) { const n = t.mounts.length > 1 ? 3 + t.mounts.length : 3; t.fgrp = ((t.fgrp || 0) + 1) % n; this.ev({ k: 'note', id: t.id, txt: t.fgrp >= 3 ? 'Огонь: ' + ((WEAPONS[t.mounts[t.fgrp - 3].w] || {}).name || '') : ['Огонь: все орудия', 'Огонь: основное орудие', 'Огонь: доп. орудия'][t.fgrp] }); } return; }
    // r19: mount the held floor weapon as an extra gun (own ammo + cooldown, reduced damage, adds weight); 'unmount_i' drops it
    if (act === 'mountw') { if (this.mode === 'classic' || !t.weapon || t.weapon === (t.baseW || 'cannon') || t.ammo == null) return; const M = t.mounts || (t.mounts = []); if (M.length >= MOUNT_MAX) { if (t.human) this.ev({ k: 'note', id: t.id, txt: 'Нет места для орудия' }); return; }
      const pos = ['pod', 'side', 'coax', 'side'][M.length] || 'pod'; const mg = t.weapon === 'mg' && t.mgi != null ? MGS[t.mgi] : null; M.push({ w: t.weapon, pos, dk: mg && mg.sim ? 1 : 0.6, cd: 0.4, ammo: t.ammo, max: Math.max(t.ammo, mg ? mg.cap : MOUNT_AMMO[t.weapon] || 30), floor: 1, tier: t.wtier || 1, mgi: mg ? mg.i : null, auto: mg && mg.sim ? 1 : 0 }); t.mgi = null; if (t.fgrp == null) t.fgrp = 0;
      t.weapon = t.baseW || 'cannon'; t.ammo = t.human ? null : (AMMO[t.weapon] ?? null); t.wtier = 1; this.ev({ k: 'note', id: t.id, txt: 'Орудие установлено: ' + ((WEAPONS[M[M.length - 1].w] || {}).name || '') }); return; }
    if (/^unmount_\d$/.test(act)) { const i = +act.slice(8), M = t.mounts; if (!M || !M[i] || !M[i].floor) return; const m = M.splice(i, 1)[0]; if (t.fgrp >= 3) t.fgrp = 0;
      this.pickups.push({ id: this.id(), x: t.x - Math.cos(t.a || 0) * 16, y: t.y - Math.sin(t.a || 0) * 16, layer: t.layer | 0, type: 'weapon', wid: m.w, tier: m.tier || 1, ammo: m.ammo, mgi: m.mgi, t: 0, life: 60 }); return; }
    if (act === 'revive') { if (t.rvg) { const k = this.wrecks && this.wrecks.find(o => o.id === t.rvg.wk); if (k) k.rp = 0; t.rvg = null; this.ev({ k: 'revive', s: 'cancel', id: t.id, x: t.x, y: t.y }); return; }
      if (!(t.revives > 0)) return; let best = null, bd = REV_R * REV_R; for (const k of this.wrecks || []) { if (!k.tid || (k.layer | 0) !== (t.layer | 0)) continue; const o = this.byId.get(k.tid); if (!o || o.alive || !this.allyOf(t, o)) continue; const d = (k.x - t.x) ** 2 + (k.y - t.y) ** 2; if (d < bd) { bd = d; best = k; } }
      if (!best) { if (t.human) this.ev({ k: 'note', id: t.id, txt: 'Подъедьте вплотную к остову союзника' }); return; }
      t.rvg = { wk: best.id, tid: best.tid, p: 0 }; this.ev({ k: 'revive', s: 'start', id: t.id, tid: best.tid, x: best.x, y: best.y }); return; }
    if (act.startsWith('takei_')) { const p = this.nearestPickup(t); if (p && p.type === 'wreck') this.takePickup(t, p, act.slice(6) | 0); return; }
    if (act === 'med' && t.meds > 0 && t.hp < t.maxHp) { t.meds--; t.hp = Math.min(t.maxHp, t.hp + Math.round(t.maxHp * 0.45 * ((t.fx && t.fx.medBoost) || 1))); this.ev({ k: 'use', id: t.id, it: 'med', x: t.x, y: t.y }); }
    else if (act === 'invis') { if (!(t.invisN > 0) || t.invisCd > 0 || t.invisT > 0) return; t.invisN--; t.invisT = 10; const tr = t.invisTier || 1; t.invisCd = tr >= 5 ? 15 : tr >= 4 ? 20 : 25; t.revealI = 0; this.ev({ k: 'invis', id: t.id, x: t.x, y: t.y }); return true; } // r26 «Невидимка»
    else if ((act === 'drone' && t.dronesN > 0) || (act === 'ldrone' && t.ldronesN > 0)) { /* r25: combat drone — 15 s guard, auto-fire, 500 rounds; legendary also drops a medkit */
      const L = act === 'ldrone'; if (this.drones.some(d => d.o === t.id)) return; if (L) t.ldronesN--; else t.dronesN--;
      this.drones.push({ id: this.id(), o: t.id, team: t.team, leg: L, x: t.x - 40, y: t.y - 40, z: 0, a: 0, t: 15, ammo: 500, cd: 0, ph: Math.random() * 6, layer: t.layer | 0 });
      if (L) this.pickups.push({ id: this.id(), type: 'med', x: t.x + 16, y: t.y + 10, life: 30 });
      this.ev({ k: 'use', id: t.id, it: act, x: t.x, y: t.y }); }
    else if (act === 'smoke' && t.smokes > 0) { t.smokes--; this.smokes.push({ id: this.id(), x: t.x, y: t.y, r: 44, t: 9, max: 9 }); this.ev({ k: 'use', id: t.id, it: 'smoke', x: t.x, y: t.y }); }
    else if (act === 'twinr' && t.twinN > 0 && (t.twCd || 0) <= this.time) { /* r25: twin homing rockets mounted on the hull */ const lk = this.hrLockTarget(t) || this.autoTarget(t, 170); if (!lk) { if (t.human) this.ev({ k: 'noLock', id: t.id }); return; } t.twinN--; t.twCd = this.time + 0.5; this.fireTwin(t, lk, t.id); }
    else if (act === 'twintrap' && t.twinN > 0) { /* r25: deploy both rockets on the ground as an armed launcher trap */ this.traps.push({ id: this.id(), x: t.x - Math.cos(t.a) * 14, y: t.y - Math.sin(t.a) * 14, a: t.a, team: t.team, owner: t.id, n: t.twinN, hp: 18, arm: 1.5, cd: 0, layer: t.layer | 0 }); t.twinN = 0; this.ev({ k: 'use', id: t.id, it: 'twintrap', x: t.x, y: t.y }); }
    else if (act === 'hrocket' && t.hrockets > 0 && (t.hrCd || 0) <= this.time) {
      const lk = this.hrLockTarget(t); if (!lk) { if (t.human) this.ev({ k: 'noLock', id: t.id }); return; } // no enemy in lock radius: nothing is wasted
      t.hrockets--; t.hrCd = this.time + 0.35; const W = WEAPONS.hrocket, a = Math.atan2(lk.y - t.y, lk.x - t.x), bx = t.x + Math.cos(a) * 14, by = t.y + Math.sin(a) * 14;
      // homing pack rocket: 1/15 of a base (lv0) tank's HP per hit
      const dmg = Math.round(100 * (this.opts.hpMul ?? HP_MUL) / 15);
      this.bullets.push({ id: this.id(), x: bx, y: by, px: bx, py: by, vx: Math.cos(a) * W.speed, vy: Math.sin(a) * W.speed, dmg, owner: t.id, team: t.team, life: W.life, w: 'hrocket', splash: 0, pierce: false, steel: false, brick: 1, lockR: HROCKET_LOCK, lock: lk.id });
      this.ev({ k: 'shot', x: bx, y: by, a, w: 'hrocket', o: t.id }); }
    else if (act === 'mine' && t.mines > 0 && this.map.get(Math.floor(t.x / CELL), Math.floor(t.y / CELL)) === T_SWAMP) { if (t.human) this.ev({ k: 'note', id: t.id, txt: 'В болоте мину не поставить' }); }
    else if (act === 'mine' && t.mines > 0) { t.mines--; this.mines.push({ id: this.id(), x: t.x - Math.cos(t.a) * 12, y: t.y - Math.sin(t.a) * 12, team: t.team, owner: t.id, arm: 1.2, mk: t.mineK && t.mineK.length ? t.mineK.pop() : 0 }); this.ev({ k: 'use', id: t.id, it: 'mine', x: t.x, y: t.y }); }
  }
  fireTwin(src, lk, owner) { const W = WEAPONS.hrocket, a = Math.atan2(lk.y - src.y, lk.x - src.x), bx = src.x + Math.cos(a) * 12, by = src.y + Math.sin(a) * 12, dmg = Math.round(100 * (this.opts.hpMul ?? HP_MUL) / 5); // 3× a pack rocket
    this.bullets.push({ id: this.id(), x: bx, y: by, px: bx, py: by, vx: Math.cos(a) * W.speed * 0.9, vy: Math.sin(a) * W.speed * 0.9, dmg, owner, team: src.team, life: W.life * 1.3, w: 'hrocket', twin: 1, rhp: 6, splash: 18, pierce: false, steel: false, brick: 1, lockR: 170, lock: lk.id });
    this.ev({ k: 'shot', x: bx, y: by, a, w: 'hrocket', o: owner }); }
  stepItems(dt) {
    for (let i = this.traps.length - 1; i >= 0; i--) { const T = this.traps[i]; if (T.arm > 0) { T.arm -= dt; continue; } T.cd -= dt; if (T.hp <= 0 || T.n <= 0) { if (T.hp <= 0) { this.ev({ k: 'boom', x: T.x, y: T.y, s: 0.7, w: 'rocket' }); } this.traps.splice(i, 1); continue; }
      if (T.cd <= 0) { let best = null, bd = 150 * 150; for (const o of this.tanks) { if (!o.alive || o.team === T.team && this.mode !== 'ffa' || o.id === T.owner || (o.layer | 0) !== T.layer) continue; const d2 = (o.x - T.x) ** 2 + (o.y - T.y) ** 2; if (d2 < bd) { bd = d2; best = o; } }
        if (best) { T.n--; T.cd = 0.45; this.fireTwin(T, best, T.owner); } } }
    for (let i = this.drones.length - 1; i >= 0; i--) { const d = this.drones[i], o = this.byId.get(d.o); d.t -= dt; d.ph += dt;
      if (!o || !o.alive || d.t <= 0 || (d.ammo <= 0 && d.t > 1.5 && (d.t = 1.5, false))) { if (!o || !o.alive || d.t <= 0) { this.drones.splice(i, 1); this.ev({ k: 'droneEnd', x: d.x, y: d.y }); continue; } }
      const gx = o.x + Math.cos(d.ph * 1.3) * 26, gy = o.y + Math.sin(d.ph * 1.3) * 26, k = Math.min(1, dt * 3); d.x += (gx - d.x) * k; d.y += (gy - d.y) * k; d.z = Math.min(1, d.z + dt * 1.5);
      const tg = this.autoTarget(o, 170); if (tg) d.a = Math.atan2(tg.y - d.y, tg.x - d.x);
      d.cd -= dt; while (tg && d.ammo > 0 && d.cd <= 0 && d.z >= 1) { d.cd += 0.03; d.ammo--; d.n = (d.n || 0) + 1; const miss = Math.random() < 0.35; if (!miss) this.damage(tg, 0.6, o.id, 'drone', tg.x, tg.y); if (d.n % 4 === 0) this.ev({ k: 'dshot', x: d.x, y: d.y, tx: tg.x + (miss ? (Math.random() - 0.5) * 20 : 0), ty: tg.y + (miss ? (Math.random() - 0.5) * 20 : 0), leg: d.leg }); }
      if (!tg && d.cd < 0) d.cd = 0; }
    for (let i = this.smokes.length - 1; i >= 0; i--) { const s = this.smokes[i]; s.t -= dt; if (s.t <= 0) this.smokes.splice(i, 1); }
    for (let i = this.mines.length - 1; i >= 0; i--) { const m = this.mines[i]; if (m.arm > 0) { m.arm -= dt; continue; } this._L = m.layer | 0;
      const MK = MINES[m.mk || 0]; if (m.boom != null) { m.boom -= dt; if (m.boom <= 0) { this.mines.splice(i, 1); this.mineBoom(m, MK); } continue; }
      if (MK.remote) { const o = this.byId.get(m.owner); if (!o || !o.alive || o.det || (o.ai && this.tanks.some(q => q.alive && q.team !== m.team && Math.hypot(q.x - m.x, q.y - m.y) < 20))) { this.mines.splice(i, 1); this.mineBoom(m, MK); } continue; }
      const R = MK.r || 11; for (const t of this.near(m.x, m.y, R + 4, [])) { if (!t.alive || t.team === m.team || t.spawnT > 0 || Math.hypot(t.x - m.x, t.y - m.y) > R) continue; if (MK.pull) { const a = Math.atan2(m.y - t.y, m.x - t.x); t.vx += Math.cos(a) * MK.pull; t.vy += Math.sin(a) * MK.pull; } if (MK.delay) { m.boom = MK.delay; break; } this.mines.splice(i, 1); this.mineBoom(m, MK, t); break; } }
    for (const t of this.tanks) t.det = false;
  }
  autoTarget(t, R) { let best = null, bd = R * R; for (const o of this.tanks) { if (!o.alive || o === t || (o.team === t.team && this.mode !== 'ffa') || o.sub || (o.layer | 0) !== (t.layer | 0)) continue; const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2; if (d < bd && this.map.los(t.x, t.y, o.x, o.y)) { bd = d; best = o; } } return best; }
  stepSentries(dt) { for (let i = this.sentries.length - 1; i >= 0; i--) { const s = this.sentries[i]; s.cd -= dt; s.spin = (s.spin || 0) + dt;
      if (s.hp <= 0 || s.ammo <= 0) { this.sentries.splice(i, 1); this.ev({ k: s.hp <= 0 ? 'boom' : 'note', x: s.x, y: s.y, id: s.owner, txt: 'Турель: патроны кончились', r: 14 }); continue; }
      if (s.cd > 0) continue; const tg = this.autoTarget(s, SENTRY.range); if (!tg) continue; s.cd = SENTRY.reload; s.ammo--;
      const a = Math.atan2(tg.y + (tg.vy || 0) * 0.1 - s.y, tg.x + (tg.vx || 0) * 0.1 - s.x) + (this.rng() - 0.5) * 2 * SENTRY.spread; s.a = a; const bx = s.x + Math.cos(a) * 7, by = s.y + Math.sin(a) * 7;
      this.bullets.push({ id: this.id(), x: bx, y: by, px: bx, py: by, vx: Math.cos(a) * SENTRY.speed, vy: Math.sin(a) * SENTRY.speed, dmg: SENTRY.dmg * (this.opts.hpMul ?? HP_MUL) / 3, owner: s.owner, team: s.team, life: SENTRY.life, w: 'mg', splash: 0, layer: s.layer | 0, mount: 1, sentry: s.id });
      if (s.ammo % 3 === 0) this.ev({ k: 'shot', x: bx, y: by, a, w: 'mg', o: s.owner, m: 1 }); } }
  bulletHitsSentry(b) { for (const s of this.sentries) { if (s.team === b.team && this.mode !== 'ffa') continue; if (b.sentry === s.id || (s.layer | 0) !== (b.layer | 0)) continue; if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 < 49) { s.hp -= b.dmg; this.ev({ k: 'hit', x: b.x, y: b.y }); return true; } } return false; }
  weaponOf(t) { if (t.weapon === 'mg' && t.mgi != null && MGS[t.mgi]) return mgW(t.mgi, this.opts.equal); const w = WEAPONS[t.weapon] || WEAPONS.cannon; return t.tur != null && TURRETS[t.tur] && (w.id === 'cannon' || w.id === (t.baseW || 'cannon')) ? turW(w, t.tur, this.opts.equal) : w; }
  mgFx(b, id) { const SH = SHELLS.find(s => s.id === id); if (!SH) return; b.sh = SHELL_IDX_OF(SH); if (SH.vsArm) b.vsArm = SH.vsArm; if (SH.freeze) b.freeze = SH.freeze * 0.5; if (SH.burn) b.burn = SH.burn * 0.5; if (SH.emp) b.emp = SH.emp * 0.4; for (const k of ['reveal', 'acid', 'knock', 'pull', 'chain', 'pbreak']) if (SH[k]) b[k] = SH[k]; if (SH.pierce) b.pierce = true; if (SH.bounce) b.bounce = Math.max(b.bounce || 0, 1); }
  // r16 extra mounts: own cooldown + own ammo pool, reduced damage (total extra DPS capped in buildStats)
  fireMounts(t, autoOnly) { for (let i = 0; i < t.mounts.length; i++) { const m = t.mounts[i]; if (m.cd > 0 || (autoOnly && !m.auto) || ((t.fgrp | 0) >= 3 && t.fgrp - 3 !== i && !m.auto)) continue; let tg = null; if (m.auto) { tg = this.autoTarget(t, (m.mgi != null ? MGS[m.mgi].range : 200) * 0.95); if (!tg) continue; } if (m.ammo <= 0) { if (t.human && this.time - (m.noT || -9) > 3) { m.noT = this.time; this.ev({ k: 'noammo', id: t.id, w: m.w }); } continue; }
      const W = m.mgi != null && MGS[m.mgi] ? mgW(m.mgi, this.opts.equal) : WEAPONS[m.w] || WEAPONS.cannon; if (W.burst > 1) { m.bc = (m.bc || 0) + 1; } m.cd = (W.burst > 1 ? (m.bc % W.burst ? 0.55 : W.burst * 0.9) : 1) * W.reload * 1.25 * (t.ai ? 1.35 : 1) * (t.relMul || 1); m.ammo--;
      const rear = m.pos === 'rear', side = m.pos === 'side' ? (i % 2 ? -1 : 1) * 4.5 : m.pos === 'pod' ? -5 : m.pos === 'coax' ? 2.5 : 0, a0 = tg ? Math.atan2(tg.y - t.y, tg.x - t.x) : rear ? t.ta + Math.PI : t.ta, cs = Math.cos(a0), sn = Math.sin(a0);
      const dmg = W.dmg * m.dk * (1 + UPGRADES.dmg.per * t.lv.dmg) * (t.dmgMul || 1), spd = W.speed * (t.bulletMul || 1);
      for (let k = 0; k < (W.count || 1); k++) { const a = a0 + (this.rng() - 0.5) * 2 * (W.spread || 0.02), bx = t.x + cs * 9 - sn * side, by = t.y + sn * 9 + cs * side;
        this.bullets.push({ id: this.id(), x: bx, y: by, px: bx, py: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, owner: t.id, team: t.team, life: W.life, w: W.id, lob: !!W.lob, cluster: 0, bounce: W.bounce || 0, splash: W.splash || 0, layer: t.layer | 0, mount: 1 }); if (W.mgfx) this.mgFx(this.bullets[this.bullets.length - 1], W.mgfx); }
      t.lastFire = this.time; if (t.invisT > 0) t.revealI = 0.6; this.ev({ k: 'shot', x: t.x + cs * 11, y: t.y + sn * 11, a: a0, w: W.id, o: t.id, m: 1 }); } }
  fire(t) {
    const w = this.weaponOf(t);
    const md = t.mods || 0; let reload = w.reload * Math.pow(1 - UPGRADES.reload.per, t.lv.reload) * (md & 4 ? 0.82 : 1);
    if (this.mode === 'classic' && t.team === 1) reload = 1.5 - Math.min(0.5, this.loopBonus * 0.1) - (t.etype === 'p' ? 0.4 : 0);
    else if (t.ai) reload *= 1.35;
    if (t.slowT > 0) reload *= 1.6; if (t.pbroke & 2) reload *= 1.6; reload *= t.relMul || 1;
    if (t.shA && !t.human && (!t.shPick || this.time - t.shPick > 1.2)) { t.shPick = this.time; const tg = t.ai && t.ai.target ? this.byId.get(t.ai.target) : null; if (this.rng() < 0.35 + (t.ai ? t.ai.skill : 0.5) * 0.6) t.shT = pickShell(this, t, tg); }
    const SH = t.shA && t.ammo == null && t.shT ? SHELLS[t.shT] : (t.shA && t.ammo == null ? SHELLS[0] : null); if (SH && SH.id !== 'ap') { t.shA[t.shT]--; if (t.shA[t.shT] <= 0) { t.shT = 0; this.ev({ k: 'shellout', id: t.id }); } }
    if (t.wv && t.ammo != null) { reload *= t.wv.rel || 1; } if (t.fx) { if (t.fx.lowHpRel && t.hp < t.maxHp * 0.35) reload *= t.fx.lowHpRel; if (t.fx.ammoSave && t.ammo != null && this.rng() < t.fx.ammoSave) t.ammo++; }
    if (w.burst > 1) { t.bc = (t.bc || 0) + 1; reload *= t.bc % w.burst ? 0.55 : w.burst * 0.9; } /* r20: MG bursts */
    t.cd = reload; t.lastFire = this.time; t.recoil = 1; if (t.invisT > 0) t.revealI = 0.6; /* r26: firing reveals */
    const dmgBase = w.dmg * (1 + UPGRADES.dmg.per * t.lv.dmg) * t.dmgMul * (t.powerT > 0 ? 1.35 : 1) * (this.mode === 'classic' ? 1 : tierMul(t.wtier)) * (md & 2 ? 1.15 : 1) * (t.wv && t.ammo != null ? t.wv.dmg || 1 : 1) * (w.slots ? 1 + 0.06 * Math.min(w.slots, bitsN((t.mods || 0) & 15) + (t.modN || 0)) : 1); /* r20: MG mod slots */
    if (t.ammo != null && this.mode !== 'classic') { t.ammo--; if (t.ammo <= 0) { this.ev({ k: 'noammo', id: t.id, w: t.weapon }); t.outOfAmmo = true; } }
    else if (t.ammo == null && t.shells != null) t.shells--;
    const count = (this.mode === 'classic' && t.stars >= 2 && t.weapon === 'cannon') ? 2 : w.count;
    const steel = w.steel || (this.mode === 'classic' && t.stars >= 3);
    const spd = (t.wv && t.ammo != null ? t.wv.spd || 1 : 1) * w.speed * t.bulletMul * (this.mode === 'classic' && t.stars >= 1 && t.team === 0 ? 1.3 : 1);
    const cs = Math.cos(t.ta), sn = Math.sin(t.ta);
    for (let i = 0; i < count; i++) {
      const off = count > 1 ? (i - (count - 1) / 2) * 5 : 0;
      const a = t.ta + (this.rng() - 0.5) * 2 * (w.spread * (t.eq && t.eq.includes('optics') ? 0.65 : 1) * (t.wv && t.ammo != null ? t.wv.spread || 1 : 1) * (t.fx ? (t.fx.spread || 1) * (t.fx.moveSpread && Math.hypot(t.vx, t.vy) > 20 ? t.fx.moveSpread : 1) : 1) + (t.pbroke & 2 ? 0.12 : 0) + 0.07 * (t.lk || 0)) + (t.pbroke & 2 ? 0.05 : 0); // bent barrel; r19 overload spread
      const bx = t.x + cs * 11 - sn * off, by = t.y + sn * 11 + cs * off;
      this.bullets.push({ id: this.id(), x: bx, y: by, px: bx, py: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: dmgBase, owner: t.id, team: t.team, life: w.life * (this.mode === 'classic' ? 1.6 : 1) * (md & 1 ? 1.3 : 1), w: w.id, lob: !!w.lob, cluster: w.cluster || 0, bounce: w.bounce || 0, freeze: w.freeze || 0, splash: w.splash, pierce: w.pierce, steel, brick: w.brick, homing: w.homing || 0, hit: null, delay: count > 1 && w.id === 'twin' ? 0 : 0 });
    }
    if (SH) for (let i = this.bullets.length - count; i < this.bullets.length; i++) { const b = this.bullets[i]; if (!b) continue; b.sh = SHELL_IDX_OF(SH); b.dmg *= SH.dmg; if (SH.vsArm) b.vsArm = SH.vsArm; if (SH.spd) { b.vx *= SH.spd; b.vy *= SH.spd; } if (SH.splash && !b.splash) b.splash = SH.splash; if (SH.cluster) b.cluster = SH.cluster; if (SH.bounce) b.bounce = Math.max(b.bounce || 0, SH.bounce); if (SH.freeze) b.freeze = SH.freeze; if (SH.burn) b.burn = SH.burn; if (SH.emp) b.emp = SH.emp; if (SH.smoke) b.smk = 1; for (const k of ['reveal', 'acid', 'knock', 'pull', 'chain', 'pbreak']) if (SH[k]) b[k] = SH[k]; if (SH.homing) b.homing = SH.homing; if (SH.pierce) b.pierce = true; if (SH.brick) b.brick = SH.brick; if (SH.steel) b.steel = true; }
    if (w.mgfx) for (let i = this.bullets.length - count; i < this.bullets.length; i++) if (this.bullets[i]) this.mgFx(this.bullets[i], w.mgfx);
    if (SH && SH.count && count === 1) for (let k = 1; k < SH.count; k++) { const b0 = this.bullets[this.bullets.length - 1], a = Math.atan2(b0.vy, b0.vx) + (k - SH.count / 2) * SH.spread / SH.count * 2, sp = Math.hypot(b0.vx, b0.vy); this.bullets.push({ ...b0, id: this.id(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, hit: null }); }
    if (t.outOfAmmo) { t.outOfAmmo = false; t.wv = null; t.mgi = null; t.weapon = t.baseW || 'cannon'; t.ammo = null; t.wtier = 1; }
    this.ev({ k: 'shot', x: t.x + cs * 13, y: t.y + sn * 13, a: t.ta, w: w.id, o: t.id });
  }

  // ---------- bullets ----------
  stepBullets(dt) {
    const tmp = []; const m0 = this.map; let m = m0;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]; b.life -= dt; b.px = b.x; b.py = b.y; m = b.layer && this.under ? this.under : m0; this.map = m; this._L = b.layer ? 1 : 0;
      if (!b.lob && this.wrecks && this.wrecks.length && b.owner !== -9 && this.bulletHitsWreck(b)) { this.bullets.splice(i, 1); continue; }
      if (this.traps.length && !b.twin) { let hitT = null; for (const T of this.traps) if (T.team !== b.team && (b.x - T.x) ** 2 + (b.y - T.y) ** 2 < 49) { hitT = T; break; } if (hitT) { hitT.hp -= b.dmg; this.ev({ k: 'hit', x: b.x, y: b.y }); this.bullets.splice(i, 1); continue; } } // r25: deployed rocket traps can be shot
      if (b.twin) { let hit = -1; for (let j = 0; j < this.bullets.length; j++) { const o = this.bullets[j]; if (o !== b && o.team !== b.team && !o.lob && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 < 36) { hit = j; break; } } if (hit >= 0) { const o = this.bullets[hit]; b.rhp -= o.dmg; if (!o.twin) { this.bullets.splice(hit, 1); if (hit < i) i--; } if (b.rhp <= 0) { this.ev({ k: 'boom', x: b.x, y: b.y, s: 0.5, w: 'rocket' }); this.bullets.splice(i, 1); continue; } } } // r25: twin rockets in flight can be shot down
      if (!b.lob && this.sentries && this.sentries.length && this.bulletHitsSentry(b)) { this.bullets.splice(i, 1); continue; }
      if (b.lockR) { // pack rocket: chase only while the target stays inside the lock radius and visible
        let tg = b.lock ? this.byId.get(b.lock) : null;
        if (tg && (!tg.alive || (tg.inBush && !this.revealedTo(tg, b.team)) || (tg.x - b.x) ** 2 + (tg.y - b.y) ** 2 > b.lockR * b.lockR)) { tg = null; b.lock = 0; }
        if (!tg) { let bd = b.lockR * b.lockR; for (const o of this.near(b.x, b.y, b.lockR, tmp)) { if (!o.alive || o.team === b.team || (o.inBush && !this.revealedTo(o, b.team)) || o.spawnT > 0 || o.cloaked || (o.fx && o.fx.jam && ((b.id * 7 + o.id) % 100) / 100 < o.fx.jam)) continue; const d2 = (o.x - b.x) ** 2 + (o.y - b.y) ** 2; if (d2 < bd) { bd = d2; tg = o; } } b.lock = tg ? tg.id : 0; }
        const sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx); let want = cur;
        if (tg) want = Math.atan2(tg.y + (tg.vy || 0) * 0.08 - b.y, tg.x + (tg.vx || 0) * 0.08 - b.x);
        // fly around walls: if the path ahead is solid, bend toward the open side
        const ah = (a) => this.map.solidForBullet(this.map.get(Math.floor((b.x + Math.cos(a) * 12) / CELL), Math.floor((b.y + Math.sin(a) * 12) / CELL)));
        if (ah(want)) { for (const o of [0.5, -0.5, 1, -1, 1.5, -1.5]) if (!ah(want + o)) { want += o; break; } }
        const d = angDiff(cur, want), na = cur + Math.sign(d) * Math.min(Math.abs(d), 6.5 * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      } else if (b.guide) { const o = this.byId.get(b.guide); if (o && o.alive) { const D = Math.hypot(b.x - o.x, b.y - o.y) + 70, tx = o.x + Math.cos(o.ta) * D, ty = o.y + Math.sin(o.ta) * D, sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx), d = angDiff(cur, Math.atan2(ty - b.y, tx - b.x)), na = cur + Math.sign(d) * Math.min(Math.abs(d), 3.5 * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
      } else if (b.homing) {
        let best = null, bd = 140 * 140;
        for (const t of this.near(b.x, b.y, 140, tmp)) { if (!t.alive || t.team === b.team || t.inBush) continue; const dx = t.x - b.x, dy = t.y - b.y, d2 = dx * dx + dy * dy; if (d2 < bd) { const ang = Math.abs(angDiff(Math.atan2(b.vy, b.vx), Math.atan2(dy, dx))); if (ang < 1.1) { bd = d2; best = t; } } }
        if (best) { const sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx), want = Math.atan2(best.y - b.y, best.x - b.x), d = angDiff(cur, want), na = cur + Math.sign(d) * Math.min(Math.abs(d), b.homing * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
      }
      let dead = b.life <= 0;
      const dist = Math.hypot(b.vx, b.vy) * dt, n = Math.max(1, Math.ceil(dist / 3));
      for (let s = 0; s < n && !dead; s++) {
        const ox = b.x, oy = b.y; b.x += b.vx * dt / n; b.y += b.vy * dt / n;
        if (!b.lob && this.map.get(Math.floor(b.x / CELL), Math.floor(b.y / CELL)) === T_SWAMP) { const f = Math.exp(-1.6 * dt / n); b.vx *= f; b.vy *= f; } // shells drag through the swamp
        if (!b.lob && !b.layer && this.towers && bulletHitsTower(this, b)) { if (b.splash) this.explode(b.x, b.y, b.splash, 0, b.owner, b.w, b.team); dead = true; break; }
        if (b.lob) continue; // mortar shell flies over everything and bursts where it lands
        const c = Math.floor(b.x / CELL), r = Math.floor(b.y / CELL), v = m.get(c, r);
        if (m.solidForBullet(v) && b.bounce > 0 && v !== T_BASE) { const sx = m.solidForBullet(m.get(Math.floor(b.x / CELL), Math.floor(oy / CELL))), sy = m.solidForBullet(m.get(Math.floor(ox / CELL), Math.floor(b.y / CELL))); if (sx || !sy) b.vx = -b.vx; if (sy || !sx) b.vy = -b.vy; b.x = ox; b.y = oy; b.bounce--; this.ev({ k: 'hit', x: ox, y: oy, s: 2, w: b.w }); continue; }
        if (m.solidForBullet(v)) {
          if (v === T_BASE) { if (this.mode === 'classic' && b.team !== 0) this.destroyBase(); else this.ev({ k: 'hit', x: b.x, y: b.y, s: 0 }); dead = true; break; }
          this.impactTiles(b, b.x, b.y, v);
          if (b.pierce && v !== T_STEEL && v !== 11) continue;
          dead = true; break;
        }
        for (const t of this.near(b.x, b.y, 12, tmp)) {
          if (!t.alive || t.id === b.owner || t.spawnT > 0 || (t.sub && !(b.lock && t.id === b.lock))) continue; // submerged: direct shells pass over, only explosions reach it
          if (b.hit && b.hit.has(t.id)) continue;
          const dx = t.x - b.x, dy = t.y - b.y; if (dx * dx + dy * dy > (TANK_R + 1.5) ** 2) continue;
          if (t.team === b.team) { if (this.mode === 'classic' && t.team === 0) { t.frozen = 0; } if (this.mode !== 'br' || this.squad > 1) { dead = !b.pierce; if (dead) { this.ev({ k: 'hit', x: b.x, y: b.y, s: 0 }); break; } continue; } }
          if (b.splash) { dead = true; break; }
          if (t.armorK === 2 && t.armorHp > 0 && this.rng() < 0.3) { this.ev({ k: 'hit', x: b.x, y: b.y, s: 2 }); dead = true; break; } // ricochet armour
          if (b.w !== 'hrocket' && !b.lob && this.mode !== 'classic') { const ca = Math.cos(t.a), sa = Math.sin(t.a), lx = (b.x - t.x) * ca + (b.y - t.y) * sa, ly = -(b.x - t.x) * sa + (b.y - t.y) * ca, nx = Math.abs(lx) / 9 > Math.abs(ly) / 7 ? [ca, sa] : [-sa, ca], sp = Math.hypot(b.vx, b.vy) || 1, cosI = Math.abs((b.vx * nx[0] + b.vy * nx[1]) / sp); if (cosI < 0.26 && this.rng() < 0.55) { const d = (b.vx * nx[0] + b.vy * nx[1]) / sp; this.ev({ k: 'rico', id: t.id, x: Math.round(b.x), y: Math.round(b.y), a: Math.atan2(b.vy / sp - 2 * d * nx[1], b.vx / sp - 2 * d * nx[0]) }); dead = true; break; } } // glancing hit on angled armour
          this.damage(t, b.w === 'hrocket' ? (t.maxHp / 15 + 0.01) * (t.eq && t.eq.includes('jammer') ? 0.5 : 1) : b.dmg * (b.vsArm && (t.armorHp > 0 || t.maxHp > 140) ? b.vsArm : 1), b.owner, b.w, b.x, b.y); if (b.freeze && t.alive) t.slowT = b.freeze; if (b.sh) this.shellHit(b, t); // pack rocket: 1/15 of the target's full HP
          if (b.pierce) { (b.hit || (b.hit = new Set())).add(t.id); continue; }
          dead = true; break;
        }
        if (!dead) { // bullet vs bullet (cancel)
          for (let j = this.bullets.length - 1; j >= 0; j--) { const o = this.bullets[j]; if (o === b || o.team === b.team || o.life <= 0) continue; if (Math.abs(o.x - b.x) < (b.aa ? 16 : 3.5) && Math.abs(o.y - b.y) < (b.aa ? 16 : 3.5)) { o.life = -1; dead = true; this.ev({ k: 'hit', x: b.x, y: b.y, s: 0 }); break; } }
        }
      }
      if (dead) {
        if (b.sh && b.splash) this.areaFx(b);
        if (b.splash) { this.explode(b.x, b.y, b.splash, b.dmg, b.owner, b.w, b.team); if (b.cluster) for (let k = 0; k < b.cluster; k++) { const a = k / b.cluster * TAU + this.rng(); this.explode(b.x + Math.cos(a) * 22, b.y + Math.sin(a) * 22, b.splash * 0.5, b.dmg * 0.35, b.owner, b.w, b.team); } }
        else if (b.life > 0) this.ev({ k: 'hit', x: b.x, y: b.y, s: 1, w: b.w });
        if (b.smk && this.smokes) this.smokes.push({ id: this.id(), x: b.x, y: b.y, r: 36, t: 6, max: 6 });
        this.bullets.splice(i, 1);
      }
    }
    this.map = m0; this._L = 0;
  }
  impactTiles(b, x, y, v) {
    const m = this.map, R = b.w === 'mg' ? 3 : 6, power = b.brick;
    let hitSomething = false;
    for (let r = Math.floor((y - R) / CELL); r <= Math.floor((y + R) / CELL); r++) for (let c = Math.floor((x - R) / CELL); c <= Math.floor((x + R) / CELL); c++) {
      const tv = m.get(c, r), cx = c * CELL + 4, cy = r * CELL + 4; if (Math.hypot(cx - x, cy - y) > R + 4) continue;
      if (tv === T_BRICK) { const i = r * m.w + c; m.hp[i] -= power; hitSomething = true; if (m.hp[i] <= 0.001) { m.set(c, r, T_EMPTY); this.ev({ k: 'brick', x: cx, y: cy }); } }
      else if (tv === T_STEEL && b.steel && !m.hard && c > 1 && r > 1 && c < m.w - 2 && r < m.h - 2) { m.set(c, r, T_EMPTY); this.ev({ k: 'brick', x: cx, y: cy, steel: 1 }); hitSomething = true; }
      else if (tv === 11) { if (b.w === 'rocket' || b.w === 'hrocket' || b.rk) { const i = r * m.w + c; m.hp[i] = (m.hp[i] || 1) - 0.5; hitSomething = true; if (m.hp[i] <= 0.001) { m.set(c, r, T_EMPTY); this.ev({ k: 'brick', x: cx, y: cy, steel: 1 }); } } }
      else if (tv === T_CRATE) { const i = r * m.w + c; m.hp[i] -= b.dmg / 70; hitSomething = true; if (m.hp[i] <= 0) this.breakCrate(c, r); }
    }
    this.ev({ k: 'hit', x, y, s: v === T_STEEL ? 2 : 1, w: b.w });
  }
  breakCrate(c, r) {
    const m = this.map; let c0 = c, r0 = r; if (m.get(c - 1, r) === T_CRATE && (c % 2 !== 0 || m.get(c + 1, r) !== T_CRATE)) c0 = c - 1; if (m.get(c0, r - 1) === T_CRATE && (r % 2 !== 0 || m.get(c0, r + 1) !== T_CRATE)) r0 = r - 1;
    for (let a = 0; a < 2; a++) for (let bb = 0; bb < 2; bb++) if (m.get(c0 + a, r0 + bb) === T_CRATE) m.set(c0 + a, r0 + bb, T_EMPTY);
    const x = c0 * CELL + 8, y = r0 * CELL + 8; this.ev({ k: 'crate', x, y });
    this.dropLoot(x, y);
  }
  rollTier() { const r = this.rng() * 100; return r < 46 ? 1 : r < 75 ? 2 : r < 91 ? 3 : 4; } // r23: no mythic (5) on the map
  dropLoot(x, y, forceWeapon, forceTier) {
    if (this.mode === 'classic') return;
    if (forceWeapon !== 'beacon' && this.rng() < 1 - LOOT_K) return; // r19: 40% less floor loot (same type mix; Маяк untouched)
    const r = this.rng(); let type, wid = null, tier = 1;
    if (!forceWeapon && this.rng() < 0.5) { const lid = rollLootX(this.rng); this.pickups.push({ id: this.id(), x, y, type: 'lx', lid, wid: null, tier: LOOTX[lid].r, t: 0, life: this.mode === 'team' ? 30 : 999 }); return; }
    if (forceWeapon === 'beacon') { this.pickups.push({ id: this.id(), x, y, type: 'beacon', wid: null, tier: 5, t: 0, life: 9999 }); return; }
    if (forceWeapon) { type = 'weapon'; wid = forceWeapon; tier = forceTier || this.rollTier(); }
    else if (r < 0.07) type = 'hrocket'; else if (r < 0.1215 && r >= 0.12 && this.mode === 'br') type = 'beacon'; else if (r < 0.135 && r >= 0.12) type = 'radar'; else if (r < 0.12) type = 'part_' + PARTS[Math.floor(this.rng() * 5)]; else if (r < 0.2) { const q = this.rng(); type = q < 0.4 ? 'med' : q < 0.65 ? 'med_s' : q < 0.8 ? 'med_l' : q < 0.92 ? 'repair' : 'med_team'; } else if (r < 0.3) type = 'shield'; else if (r < 0.37) type = 'speed'; else if (r < 0.44) type = 'power';
    else if (r < 0.53 && this.mode !== 'classic') { const lid = rollGear(this.rng); this.pickups.push({ id: this.id(), x, y, type: 'lx', lid, wid: null, tier: LOOTX[lid].r, t: 0, life: this.mode === 'team' ? 30 : 999 }); return; }
    else if (r < 0.58) { type = 'armor'; tier = this.rollTier(); } else if (r < 0.68) type = 'ammo'; else if (r < 0.735) type = 'smoke'; else if (r < 0.75) { const q = Math.random(); type = q < 0.6 ? 'drone' : q < 0.72 ? 'ldrone' : q < 0.85 ? 'twinr' : 'invis'; if (type === 'invis') tier = this.rollTier(); } else if (r < 0.82) type = 'mine';
    else if (r < 0.87 && this.mode === 'br') type = this.rng.pick(Object.keys(MODS));
    else { type = 'weapon'; wid = this.rng.pick(LOOT_WEAPONS); tier = this.rollTier(); }
    this.pickups.push({ id: this.id(), x, y, type, wid, tier, ak: type === 'armor' && this.rng() < 0.45 ? 1 + Math.floor(this.rng() * 4) : 0, t: 0, life: this.mode === 'team' ? 25 : 999 });
    if ((type === 'ammo' || type === 'med' || type === 'med_s' || type === 'med_l') && this.rng() < 0.1) this.pickups.push({ id: this.id(), x: x + 10, y: y + 6, type, wid, tier, ak: 0, t: 0, life: this.mode === 'team' ? 25 : 999 }); // r26: +10% ammo packs & medkits
  }
  // «Маяк»: an active beacon reveals hidden enemies (bush/smoke/mud/swamp/submerged) around its holder to the holder's team
  beaconStep() { for (const b of this.tanks) { if (!b.alive || !(b.beaconT > 0)) continue; for (const o of this.near(b.x, b.y, BEACON_R, [])) { if (!o.alive || o.team === b.team || Math.hypot(o.x - b.x, o.y - b.y) > BEACON_R) continue;
      if (!(o.revT > 0) && (o.inBush || o.terr)) this.ev({ k: 'revealed', id: o.id, by: b.id, x: o.x, y: o.y }); o.revT = 0.6; o.revTeam = b.team; } } }
  revealedTo(o, team) { return o.revT > 0 && o.revTeam === team; }
  surface(t) { if (!t.sub) return; t.sub = 0; t.surfT = 0.5; t.lastFire = Math.max(t.lastFire, this.time - 0.6); this.ev({ k: 'surface', id: t.id, x: t.x, y: t.y }); }
  explode(x, y, rad, dmg, owner, w, team) {
    this.ev({ k: 'boom', x, y, s: rad / 26, conc: rad * 2.2, w });
    const m = this.map;
    for (let r = Math.floor((y - rad * 0.6) / CELL); r <= Math.floor((y + rad * 0.6) / CELL); r++) for (let c = Math.floor((x - rad * 0.6) / CELL); c <= Math.floor((x + rad * 0.6) / CELL); c++) {
      const v = m.get(c, r); if (v === T_BRICK) { m.set(c, r, T_EMPTY); } else if (v === T_CRATE) this.breakCrate(c, r);
      else if (v === T_BASE && this.mode === 'classic' && team !== 0) this.destroyBase();
    }
    if (this.towers && dmg > 0) for (const T of this.towers) if (T.alive && T.team !== team && Math.hypot(T.x - x, T.y - y) < rad + 12) damageTower(this, T, dmg * 0.8, owner);
    for (const t of this.near(x, y, rad + 10, [])) {
      if (!t.alive || (t.team === team && t.id !== owner) || t.spawnT > 0) continue; const d = Math.hypot(t.x - x, t.y - y); if (d > rad + TANK_R) continue;
      const f = t.id === owner ? 0.3 : 1; this.damage(t, dmg * f * (1 - 0.5 * Math.max(0, d - TANK_R) / rad), owner, w, t.x, t.y);
    }
  }
  damage(t, amount, ownerId, w, x, y) {
    if (!t.alive) return;
    if (t.inv > 0) { this.ev({ k: 'hit', x, y, s: 3 }); return; }
    if (w !== 'zone' && w !== 'hrocket' && w !== 'thorns' && w !== 'twinr') amount *= DMG_BASE; // r26: +30% base damage for every weapon (cannon, MG, rockets, turrets, drones…) for everyone
    // r26: NO hidden player-vs-bot multipliers — damage depends only on weapon, upgrades, gear tier/level, mods and hit angle (same rules for everyone)
    if (this.mode === 'classic' && t.team === 1 && w === 'zone') return;
    const owner = this.byId.get(ownerId);
    let a = w === 'hrocket' ? amount : amount / (t.armMul || 1); const ty = DMG_TYPE[w] || 'kin'; let crit = false;
    // hit direction vs hull: side x1.2, rear x1.45; parts suffer more from side/rear hits
    let dirK = 1, partK = 1; if (x !== undefined && (x !== t.x || y !== t.y) && ty !== 'zone' && w !== 'burn') { const rel = Math.abs(angDiff(t.a, Math.atan2(y - t.y, x - t.x))); if (rel > 2.36) { dirK = 1.45; partK = 2; crit = true; } else if (rel > 0.79) { dirK = 1.2; partK = 1.5; } }
    if (w === 'hrocket') { dirK = 1; } // homing rocket stays exactly 15 hits
    if (t.apsN > 0 && (w === 'rocket' || w === 'hrocket' || w === 'xrocket' || w === 'twinr') && this.mode !== 'classic') { t.apsN--; this.ev({ k: 'aps', id: t.id, x, y }); this.ev({ k: 'hit', x, y, s: 6 }); return; } // r27 active protection intercepts a rocket
    const OF = owner && owner.fx, TF = t.fx;
    if (TF && TF.ramRes && w === 'ram') amount *= 1 - TF.ramRes; if (OF && OF.ramDmg && w === 'ram') amount *= OF.ramDmg; if (TF && TF.ext && w === 'burn') amount *= 1 - TF.ext;
    if (OF) { if (OF.berserk) a *= 1 + 0.5 * (1 - owner.hp / owner.maxHp); if (OF.crit && this.rng() < OF.crit) { a *= 2; crit = true; } if (OF.exec && t.hp < t.maxHp * 0.3) a *= OF.exec; if (OF.splashDmg && (WEAPONS[w] || {}).splash) a *= OF.splashDmg; if (OF.rocketDmg && (w === 'rocket' || w === 'hrocket' || w === 'xrocket')) a *= OF.rocketDmg; if (OF.mineDmg && w === 'mine') a *= OF.mineDmg; if (OF.burnDmg && w === 'burn') a *= OF.burnDmg; }
    if (TF) { if (TF.critRes && crit) { dirK = Math.min(dirK, 1.2); crit = false; } if (TF.rearArm && dirK > 1.3) a *= TF.rearArm; if (TF.splashRes && (WEAPONS[w] || {}).splash) a *= TF.splashRes; if (TF.mineImm && w === 'mine') a *= 0.3; if (TF.burnImm && w === 'burn') a *= 0.3; }
    if (this.mode !== 'classic') a *= dirK;
    if (t.pbroke & 16 && w !== 'hrocket') a *= 1.2; // missing armour plates
    if (t.armorHp > 0 && t.armorK === 5 && ty === 'fire') a *= 0.5;
    if (this.mode !== 'classic' && ty !== 'zone') {
      if (ty === 'fire' && w !== 'burn' && !(t.armorHp > 0 && t.armorK === 5)) { t.burnT = 3; t.burnBy = ownerId; }
      if (ty === 'emp' && !(t.armorHp > 0 && t.armorK === 6) && !(TF && TF.empImm)) t.empT = 1.8;
      if (ty === 'frost' && !(t.armorHp > 0 && t.armorK === 6)) t.slowT = Math.max(t.slowT || 0, 1.2);
      if ((crit && amount >= 20) || amount >= t.maxHp * 0.12) t.stunT = 0.45;
      if (ty !== 'fire') { const pd = t.pd || (t.pd = [1, 1, 1, 1, 1]), pi = Math.floor(this.rng() * 5), pk = amount / (t.maxHp * 0.3) * partK * (t.human ? 0.8 : 1); const was = pd[pi] > 0; pd[pi] = Math.max(0, pd[pi] - pk); if (was && pd[pi] <= 0) this.ev({ k: 'part', id: t.id, p: pi, x: t.x, y: t.y }); }
    }
    if (t.armorK === 1 && t.armorHp > 0 && (WEAPONS[w] || {}).splash) a *= 0.55; if (t.eq && t.eq.includes('spall') && ((WEAPONS[w] || {}).splash || w === 'mine')) a *= 0.75; t.lastHurt = this.time; if (t.armorK === 4 && t.armorHp > 0 && w === 'mine') a *= 0.25;
    if (t.armorHp > 0) { const red = a * armorReduce(t.armorT); a -= red; t.armorHp -= red * 2 + a * 0.15; if (t.armorHp <= 0) { t.armorHp = 0; t.armorT = 0; t.armorK = 0; this.ev({ k: 'armorBreak', id: t.id, x: t.x, y: t.y }); } }
    if (t.shield > 0) { const s = Math.min(t.shield, a); t.shield -= s; a -= s; }
    if (t.shBHp > 0 && w !== 'zone') { const ab = Math.min(t.shBHp, a); t.shBHp -= ab; a -= ab; t.shBT = 6; } /* r27 energy shield */ if (OF && OF.empHit && this.rng() < OF.empHit && !(TF && TF.empImm)) t.empT = 1.2;
    t.hp -= a; t.hitT = 0.12; if (t.invisT > 0) t.revealI = 0.8; // r26: taking damage briefly reveals a cloaked tank
    if (OF && owner !== t && a > 0) { if (OF.leech) owner.hp = Math.min(owner.maxHp, owner.hp + a * OF.leech); }
    if (TF && TF.thorns && owner && owner !== t && owner.alive && w !== 'thorns' && w !== 'burn' && w !== 'zone') { const r = a * TF.thorns; if (r > 0.3) this.damage(owner, r, t.id, 'thorns', t.x, t.y); }
    if (t.hp <= 0 && owner && owner !== t && owner.fx) { if (owner.fx.killHeal) owner.hp = Math.min(owner.maxHp, owner.hp + owner.fx.killHeal); if (owner.fx.shieldKill) owner.shield = Math.min(140, (owner.shield || 0) + owner.fx.shieldKill); }
    if (owner && owner !== t) { owner.dmg += amount; t.lastAtk = owner.id; t.lastAtkT = this.time; }
    this.ev({ k: 'dmg', id: t.id, hx: Math.round(x ?? t.x), hy: Math.round(y ?? t.y), x: t.x, y: t.y - 10, v: Math.round(amount * dirK), o: ownerId, sh: a <= 0, dt: crit ? 'crit' : ty });
    if (t.hp <= 0) this.kill(t, owner, w);
  }
  kill(t, killer, w) { const L0 = this._L; this._L = t.layer | 0; try { return this.kill0(t, killer, w); } finally { this._L = L0; if (this.mode !== 'classic' && this.special !== 'race' && !t.alive) { this.addWreck(t); if (killer && killer.ai && killer !== t && Math.random() < 0.12) chat(this, killer, 'gg'); } } }
  // r15 permanent wrecks: solid cover for tanks and shells; only heavy weapons wreck them further
  addWreck(t) { if (t.layer) return; /* r19: no permanent wrecks in narrow bunker corridors (they wedged bots) */ const W = this.wrecks || (this.wrecks = []); for (const k of W) if (k.tid === t.id) k.tid = 0; W.push({ id: this.id(), x: t.x, y: t.y, a: t.a || 0, ta: (t.ta || 0) + (this.rng() - 0.5) * 1.2, hp: 260, layer: t.layer | 0, t0: this.time, tid: t.id, team: t.team, rp: 0, model: t.model ?? -1, skin: t.skin }); if (W.length > 160) W.shift(); }
  stepWrecks() { const W = this.wrecks; if (!W || !W.length) return; const R = 8 + TANK_R;
    for (const t of this.tanks) { t.wcov = 0; if (!t.alive) continue; for (const w of W) { if ((w.layer | 0) !== (t.layer | 0)) continue; const dx = t.x - w.x, dy = t.y - w.y, d2 = dx * dx + dy * dy; if (d2 > 900) continue; const d = Math.sqrt(d2) || 0.01;
      if (d < 22 && this.time - w.t0 < 150) t.wcov = 1; if (d < R) { const k = (R - d), nx = t.x + dx / d * k, ny = t.y + dy / d * k; const m = (t.layer && this.under) ? this.under : this.map; if (!m.tankBlockedAt(nx, ny, TANK_R)) { t.x = nx; t.y = ny; } else { w.x -= dx / d * k * 0.3; w.y -= dy / d * k * 0.3; } } } } }
  bulletHitsWreck(b) { const W = this.wrecks; if (!W) return false; for (let i = W.length - 1; i >= 0; i--) { const w = W[i]; if ((w.layer | 0) !== (b.layer | 0)) continue; if ((b.x - w.x) ** 2 + (b.y - w.y) ** 2 > 64) continue;
      const heavy = b.w === 'rocket' || b.w === 'hrocket' || b.w === 'rail' || b.w === 'mortar' || (b.dmg || 0) >= 45; if (heavy) { w.hp -= b.dmg || 50; const vl = Math.hypot(b.vx, b.vy) || 1; w.x += b.vx / vl * 3; w.y += b.vy / vl * 3; if (w.hp <= 0) { W.splice(i, 1); this.ev({ k: 'boom', x: w.x, y: w.y, s: 1, wk: 1 }); } }
      this.ev({ k: 'hit', x: b.x, y: b.y, s: 2, w: b.w, wreck: 1 }); return true; } return false; }
  // r27: 3 lives in every respawn mode (team deathmatch, CTF, KotH, FFA, duel…). Last life → humans get 8 s to buy one; then out until the match ends.
  lifeGate(t) { if (this.opts.oneLife || this.opts.infLives || t.wave || t.isBoss) return false; const sp = this.special; if (sp === 'race' || sp === 'moba' || sp === 'survival' || sp === 'zombie') return false;
    if ((t.lives ?? 3) > 1) { t.lives = (t.lives ?? 3) - 1; this.ev({ k: 'life', id: t.id, n: t.lives }); return false; }
    if (t.human && !t.noBuy) { t.lives = 0; t.waitBuy = true; t.respawnT = 8; this.ev({ k: 'life', id: t.id, n: 0, ask: 1 }); return true; }
    this.lifeOut(t); return true; }
  lifeOut(t) { t.lives = 0; t.respawnT = 0; t.outL = 1; t.x = -1000; t.y = -1000; this.ev({ k: 'life', id: t.id, n: 0, out: 1 });
    if (this.ffa) { const left = this.tanks.filter(o => !o.outL); if (left.length <= 1 && !this.result) this.finish({ winner: left[0] ? left[0].id : 0, lives: 1 }); }
    else if (this.mode === 'team') for (const tm of [0, 1]) if (this.tanks.some(o => o.team === tm) && this.tanks.filter(o => o.team === tm).every(o => o.outL) && !this.result) { this.finish({ winnerTeam: 1 - tm, lives: 1 }); break; } }
  kill0(t, killer, w) {
    t.alive = false; t.hp = 0; t.deaths++;
    this.ev({ k: 'boom', x: t.x, y: t.y, s: 1.4, tank: 1 });
    const feed = { killer: killer ? killer.name : (w === 'zone' ? 'Зона' : '—'), victim: t.name, kid: killer ? killer.id : 0, vid: t.id, kt: killer ? killer.team : -1, vt: t.team, w: w || 'cannon', time: this.time };
    this.feed.push(feed); if (this.feed.length > 6) this.feed.shift();
    this.ev({ k: 'kill', ...feed });
    if (killer && killer !== t && killer.team !== t.team) { killer.kills++; if (killer.ai && !killer.human && this.mode !== 'classic') this.botUpgrade(killer); }
    if (this.ffa) {
      t.respawnT = 1.5; this.dropWreck(t);
      if (killer && killer.kills >= this.target) this.finish({ winner: killer.id }); else this.lifeGate(t);
    } else if (this.mode === 'br') {
      // r26: 3 lives for everyone (players can buy extra with coins, this match only). A lost life respawns you at a safe spot inside the zone with brief protection.
      if (!this.opts.oneLife && (t.lives ?? 3) > 1 && !t.waitBuy) { t.lives = (t.lives ?? 3) - 1; this.dropWreck(t); t.respawnT = 2.5; this.ev({ k: 'life', id: t.id, n: t.lives }); return; }
      if (!this.opts.oneLife && t.human && !t.waitBuy && !t.noBuy) { t.lives = 0; t.waitBuy = true; t.respawnT = 8; this.dropWreck(t); this.ev({ k: 'life', id: t.id, n: 0, ask: 1 }); return; } // last life: 8 s to buy one more
      t.waitBuy = false; t.lives = 0;
      this.brOut(t);
    } else if (this.mode === 'team') {
      const sp = this.special;
      if (sp === 'race') { t.respawnT = 1.5; return; }
      this.dropWreck(t);
      if (sp === 'ctf') { for (const F of this.flags) if (F.carrier === t.id) { F.carrier = 0; F.x = t.x; F.y = t.y; F.dropT = 12; this.ev({ k: 'flag', s: 'drop', team: F.team }); } }
      if (sp === 'koth' || sp === 'ctf') { /* points come from objectives */ } else if (sp === 'survival' || sp === 'zombie') { if (killer && killer.team === 0 && t.team === 1) this.score[0]++; }
      else if (killer && killer.team !== t.team) this.score[killer.team]++; else if (!killer) this.score[1 - t.team]++;
      if (t.isBoss) { this.finish({ winnerTeam: 0, boss: true }); return; }
      if (t.wave) { t.respawnT = 0; if (this.rng() < 0.3) this.dropLoot(t.x, t.y); return; }
      if ((sp === 'survival' || sp === 'zombie') && t.human) { this.lives--; if (this.lives <= 0) { t.respawnT = 0; if (!this.tanks.some(o => o.human && o.alive)) this.finish({ winnerTeam: 1, wave: this.wave }); return; } }
      if (sp === 'moba') { if (killer && killer.team !== t.team) this.gold[killer.team] += 25; t.respawnT = mobaRespawn(this) * (this.time >= 1200 ? 1.5 : 1); return; }
      t.respawnT = sp === 'ctf' ? 5 : 3; if (this.rng() < 0.35) this.dropLoot(t.x, t.y);
      if (this.score[0] >= this.target || this.score[1] >= this.target) this.finish({ winnerTeam: this.score[0] >= this.target ? 0 : 1 }); else this.lifeGate(t);
    } else {
      if (t.team === 1) {
        this.enemyKilled++; this.killsByType[t.etype]++; if (killer && killer.team === 0) this.score += ENEMY_TYPES[t.etype].pts;
        if (t.flash) this.spawnBonus();
        if (this.enemyKilled >= this.enemyTotal) { this.state = 'over'; this.finishT = 0; this.finish({ win: true }, 2.5); }
      } else {
        this.lives--; if (this.lives > 0) { t.respawnT = 0; this.respawnClassic(t); } else if (!this.tanks.some(o => o.team === 0 && o.alive)) this.finish({ win: false, reason: 'lives' }, 2);
      }
    }
  }
  finish(res, delay = 0) {
    if (this.result) return;
    this.state = 'over'; this.result = { ...res, time: this.time, delay };
    if (this.mode === 'team') { this.result.score = this.score.slice(); if (this.wave) this.result.wave = this.wave; }
    this.ev({ k: 'end' });
  }
  brOut(t) { // r26: final elimination in BR (after the last life)
      t.place = this.aliveCount; this.aliveCount--;
      if (this.squad > 1 && !this.tanks.some(o => o.alive && o.team === t.team)) { const pl = this.aliveTeams; this.aliveTeams--; this.teamPlace[t.team] = pl; for (const o of this.tanks) if (o.team === t.team) o.place = pl; }
      
      if (this.squad > 1) { if (this.aliveTeams <= 1) { const win = this.tanks.find(o => o.alive); if (win) { this.teamPlace[win.team] = 1; for (const o of this.tanks) if (o.team === win.team) o.place = 1; } this.finish({ winner: win ? win.id : 0, winnerTeam: win ? win.team : -1 }); } }
      else if (this.aliveCount <= 1) { const win = this.tanks.find(o => o.alive); if (win) win.place = 1; this.finish({ winner: win ? win.id : 0 }); }
  }
  respawnBR(t) { this.respawnFFA(t); const z = this.zone, m = this.map; if (z) { const live = this.tanks.filter(o => o.alive && o !== t && o.team !== t.team); for (let k = 0; k < 60; k++) { const a = this.rng() * TAU, r = Math.sqrt(this.rng()) * Math.max(20, z.r * 0.7), px = z.cx + Math.cos(a) * r, py = z.cy + Math.sin(a) * r;
      if (px < 40 || py < 40 || px > m.pw - 40 || py > m.ph - 40 || m.tankBlockedAt(px, py, TANK_R + 3)) continue; if (k < 50 && live.some(q => (q.x - px) ** 2 + (q.y - py) ** 2 < 140 * 140)) continue; t.x = px; t.y = py; break; } } t.inv = Math.max(t.inv || 0, 3); t.spawnT = 0; }
  respawnFFA(t) { t.layer = 0; t.rvg = null; if (this.wrecks) for (const k of this.wrecks) if (k.tid === t.id) k.tid = 0;
    let x, y; const live = this.tanks.filter(o => o.alive && o !== t), m = this.map;
    for (let k = 0; k < 40 && live.length; k++) { const o = live[Math.floor(this.rng() * live.length)], a = this.rng() * TAU, r = 150 + this.rng() * 120, px = o.x + Math.cos(a) * r, py = o.y + Math.sin(a) * r;
      if (px < 40 || py < 40 || px > m.pw - 40 || py > m.ph - 40 || m.tankBlockedAt(px, py, TANK_R + 3)) continue; if (live.some(q => (q.x - px) ** 2 + (q.y - py) ** 2 < 110 * 110)) continue; x = px; y = py; break; }
    if (x === undefined) [x, y] = this.freeSpot(120); t.x = x; t.y = y; t.alive = true; t.hp = t.maxHp; t.shield = 0; this.equipSpawn(t); t.inv = 2.5; t.vx = t.vy = 0; t.speedT = t.powerT = 0; t.cd = 0.3;
    if (t.human) t.weapon = t.baseW || 'cannon'; t.ammo = t.human ? null : (AMMO[t.weapon] ?? null); t.wtier = 1; t.armorT = 0; t.armorK = 0; t.armorHp = 0; if (t.build) { t.weapon = t.baseW; if (t.buildAk >= 0) { t.armorT = 1; t.armorHp = armorMax(1); t.armorK = t.buildAk; } } t.slowT = 0; t.regenT = 0; t.hrockets = 0; t.radar = 0; t.beacons = 0; t.beaconT = 0; t.sub = 0; t.oxy = DIVE_MAX; t.surfT = 0; t.diveCd = 0; t.pd = [1, 1, 1, 1, 1]; t.burnT = 0; t.empT = 0; t.stunT = 0; t.mods = 0; t.meds = Math.min(t.meds, 1); t.outOfAmmo = false;
    this.aliveCount = this.tanks.filter(o => o.alive).length; this.ev({ k: 'spawn', x: t.x, y: t.y });
  }
  ffaRanking() { return this.tanks.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths); }
  spawnWaveBot(zombie) {
    const sps = this.map.spawns[1], sp = sps[Math.floor(this.rng() * sps.length)], dl = this.diff;
    const t = this.makeTank({ x: sp[0] + this.rng.range(-20, 20), y: sp[1] + this.rng.range(-20, 20), team: 1, name: zombie ? 'Зомби' : 'Волна ' + (this.wave || 1), skin: zombie ? 'enemy_a' : 'enemy_p',
      weapon: zombie ? 'cannon' : WAVE_W[Math.floor(this.rng() * WAVE_W.length)], hp: Math.round((zombie ? 55 : 80 + (this.wave || 0) * 6) * (dl.hp || 1)), speed: zombie ? 82 + Math.min(30, (this.wave || 0) * 2) : 66, skill: Math.min(0.9, 0.35 + (this.wave || 0) * 0.04), a: Math.PI, inv: 0.5 });
    t.wave = true; t.ammo = null; if (zombie) t.zombie = true; return t;
  }
  pruneWave() { if (!this.tanks.some(t => t.wave && !t.alive)) return; this.tanks = this.tanks.filter(t => { if (t.alive || !t.wave) return true; this.byId.delete(t.id); return false; }); }
  stepSpecial(dt) {
    const sp = this.special;
    if (sp === 'survival' || sp === 'zombie') {
      this.pruneWave();
      if (!this.tanks.some(t => t.team === 1 && t.alive)) { this.waveT -= dt; if (this.waveT <= 0) { this.wave++; const n = sp === 'zombie' ? 4 + this.wave * 3 : 2 + this.wave * 2; for (let k = 0; k < Math.min(n, 40); k++) this.spawnWaveBot(sp === 'zombie'); this.waveT = 4; this.ev({ k: 'wave', n: this.wave }); } }
      if (sp === 'zombie') for (const z of this.tanks) { if (!z.zombie || !z.alive) continue; for (const o of this.tanks) { if (o.team === z.team || !o.alive || o.inv > 0) continue; if ((o.x - z.x) ** 2 + (o.y - z.y) ** 2 < 19 * 19) this.damage(o, 38 * dt, z.id, 'cannon', o.x, o.y); } }
    } else if (sp === 'boss') {
      this.pruneWave();
      this.minionT = (this.minionT || 6) - dt; if (this.minionT <= 0 && this.boss.alive) { this.minionT = 9; if (this.tanks.filter(t => t.wave && t.alive).length < 5) this.spawnWaveBot(false); }
    } else if (sp === 'race') this.stepRace(); else if (sp === 'ctf') this.stepCTF(dt); else if (sp === 'moba') stepMoba(this, dt);
    else if (sp === 'koth') {
      const H = this.hill, inn = [0, 0]; for (const t of this.tanks) if (t.alive && (t.x - H.x) ** 2 + (t.y - H.y) ** 2 < H.r * H.r) inn[t.team]++;
      const own = inn[0] && !inn[1] ? 0 : inn[1] && !inn[0] ? 1 : -1; H.contested = inn[0] > 0 && inn[1] > 0; H.owner = own;
      if (own >= 0) { H.acc[own] += dt; if (H.acc[own] >= 1) { H.acc[own] -= 1; this.score[own]++; if (this.score[own] >= this.target) this.finish({ winnerTeam: own }); } }
    }
  }
  initRace(humans) {
    const o = this.opts, m = this.map, total = Math.max(o.total || 8, humans.length), grid = m.spawns[0]; this.laps = o.laps || 3; this.score = [0, 0];
    const names = (this.opts.botNames || []).concat(BOT_NAMES.slice().sort(() => this.rng() - 0.5)); let i = 0;
    const mk = (extra) => { const [x, y] = grid[i % grid.length]; const t = this.makeTank({ x, y, team: 10 + i, a: -Math.PI / 2, inv: 4, ...extra }); t.cp = 1; t.lap = 0; t.cpPass = 0; i++; return t; };
    for (const h of humans) mk({ name: h.name, cc: h.cc, skin: h.skin, weapon: h.weapon, lv: h.lv, human: true, tlv: h.tlv, rki: h.rki, extraLives: h.extraLives, cid: h.cid });
    while (i < total) mk({ name: names[i % names.length], skin: this.rng.pick(BOT_SKINS), weapon: this.rng() < 0.6 ? 'cannon' : this.rng.pick(['twin', 'mg', 'rocket']), lv: this.botLv(), skill: this.botSkill(), speed: 70 + this.rng() * 6, hp: 100 });
  }
  raceProgress(t) { const cps = this.map.checkpoints, N = cps.length, prev = (t.cp - 1 + N) % N, c = cps[t.cp]; return t.lap * N + prev + 1 - Math.min(1, Math.hypot(c[0] - t.x, c[1] - t.y) / 400); }
  raceRanking() { return this.tanks.slice().sort((a, b) => (b.finishT ? 1e6 - b.finishT : 0) - (a.finishT ? 1e6 - a.finishT : 0) || this.raceProgress(b) - this.raceProgress(a)); }
  stepRace() {
    const cps = this.map.checkpoints, N = cps.length, R = this.map.cpR;
    for (const t of this.tanks) { if (!t.alive || t.finishT) continue; const c = cps[t.cp]; if ((t.x - c[0]) ** 2 + (t.y - c[1]) ** 2 > R * R) continue;
      if (t.cp === 0) { t.lap++; if (t.lap >= this.laps) { t.finishT = this.time; this.ev({ k: 'raceFin', id: t.id }); if (!this.raceFirst) { this.raceFirst = t.id; this.raceEndT = this.time + 20; } } else this.ev({ k: 'lap', id: t.id, n: t.lap + 1 }); }
      t.cp = (t.cp + 1) % N; t.cpPass = this.time; }
    const humans = this.tanks.filter(t => t.human);
    if (this.raceFirst && (this.time >= this.raceEndT || (humans.length ? humans.every(h => h.finishT) : true))) this.finish({ winner: this.raceFirst, race: true });
  }
  stepCTF(dt) {
    for (const F of this.flags) {
      if (F.carrier) { const c = this.byId.get(F.carrier); if (!c || !c.alive) { F.carrier = 0; F.dropT = 12; continue; } F.x = c.x; F.y = c.y;
        const own = this.flags[c.team]; if (own.home && (c.x - own.hx) ** 2 + (c.y - own.hy) ** 2 < 26 * 26) { this.score[c.team]++; F.carrier = 0; F.home = true; F.x = F.hx; F.y = F.hy; c.kills += 0; this.ev({ k: 'flag', s: 'cap', team: c.team, id: c.id }); if (this.score[c.team] >= this.target) this.finish({ winnerTeam: c.team }); }
        continue; }
      if (!F.home) { F.dropT -= dt; if (F.dropT <= 0) { F.home = true; F.x = F.hx; F.y = F.hy; this.ev({ k: 'flag', s: 'ret', team: F.team }); continue; } }
      for (const t of this.tanks) { if (!t.alive || (t.x - F.x) ** 2 + (t.y - F.y) ** 2 > 16 * 16) continue;
        if (t.team !== F.team) { if (this.flags.some(o => o.carrier === t.id)) continue; F.carrier = t.id; F.home = false; this.ev({ k: 'flag', s: 'take', team: F.team, id: t.id }); break; }
        if (!F.home) { F.home = true; F.x = F.hx; F.y = F.hy; this.ev({ k: 'flag', s: 'ret', team: F.team, id: t.id }); break; } }
    }
  }
  respawnTeam(t) { t.layer = 0; t.rvg = null; if (this.wrecks) for (const k of this.wrecks) if (k.tid === t.id) k.tid = 0;
    if (this.special === 'race') { const cps = this.map.checkpoints, N = cps.length, a = cps[(t.cp - 1 + N) % N], b = cps[t.cp]; let x = a[0], y = a[1]; for (let k = 0; k < 20; k++) { const px = a[0] + this.rng.range(-40, 40), py = a[1] + this.rng.range(-40, 40); if (!this.map.tankBlockedAt(px, py, TANK_R + 3)) { x = px; y = py; break; } }
      t.x = x; t.y = y; t.alive = true; t.hp = t.maxHp; t.inv = 2; t.a = t.ta = Math.atan2(b[1] - y, b[0] - x); t.vx = t.vy = 0; t.cd = 0.3; t.ammo = t.human ? null : (AMMO[t.weapon] ?? null); t.outOfAmmo = false; this.ev({ k: 'spawn', x, y }); return; }
    const sp = this.map.spawns[t.team][Math.floor(this.rng() * 10)];
    t.x = sp[0] + this.rng.range(-6, 6); t.y = sp[1] + this.rng.range(-8, 8); t.alive = true; t.hp = t.maxHp; t.shield = 0; this.equipSpawn(t); t.inv = 2.5; t.a = t.ta = t.team ? Math.PI : 0; t.vx = t.vy = 0; t.speedT = t.powerT = 0; t.cd = 0.3;
    if (t.human) t.weapon = t.baseWeapon || t.weapon;
    t.ammo = t.human ? null : (AMMO[t.weapon] ?? null); t.wtier = 1; t.armorT = 0; t.armorK = 0; t.armorHp = 0; if (t.build) { t.weapon = t.baseW; if (t.buildAk >= 0) { t.armorT = 1; t.armorHp = armorMax(1); t.armorK = t.buildAk; } } t.slowT = 0; t.regenT = 0; t.hrockets = 0; t.radar = 0; t.beacons = 0; t.beaconT = 0; t.sub = 0; t.oxy = DIVE_MAX; t.surfT = 0; t.diveCd = 0; t.pd = [1, 1, 1, 1, 1]; t.burnT = 0; t.empT = 0; t.stunT = 0; t.mods = 0; t.meds = Math.min(t.meds, 1); t.outOfAmmo = false;
    this.ev({ k: 'spawn', x: t.x, y: t.y });
  }
  respawnClassic(t) {
    const idx = this.tanks.filter(o => o.human).indexOf(t); const sp = this.map.spawns[Math.max(0, idx) % 2];
    t.x = sp[0]; t.y = sp[1]; t.alive = true; t.hp = t.maxHp; t.inv = 3; t.a = t.ta = -Math.PI / 2; t.vx = t.vy = 0; t.stars = 0; t.spawnT = 0.6;
    this.ev({ k: 'spawn', x: t.x, y: t.y });
  }
  destroyBase() {
    if (!this.baseAlive) return; this.baseAlive = false;
    const m = this.map; m.rect(24, 48, 4, 4, T_EMPTY); for (let i = 0; i < 16; i++) m.changes.push((48 + (i >> 2)) * m.w + 24 + (i & 3)); m.version++;
    this.ev({ k: 'boom', x: m.base.x, y: m.base.y, s: 2.4, tank: 1 }); this.ev({ k: 'baseDown' });
    this.finish({ win: false, reason: 'base' }, 2.2);
  }
  spawnBonus() {
    const types = ['star', 'helmet', 'grenade', 'life', 'shovel', 'clock'];
    const [x, y] = this.freeSpot(0, 200);
    this.pickups = this.pickups.filter(p => !['star', 'helmet', 'grenade', 'life', 'shovel', 'clock'].includes(p.type));
    this.pickups.push({ id: this.id(), x, y, type: this.rng.pick(types), t: 0, life: 20 });
    this.ev({ k: 'bonusSpawn' });
  }

  // ---------- pickups ----------
  stepPickups(dt) {
    const tmp = [];
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]; p.t += dt; p.life -= dt; if (p.life <= 0) { this.pickups.splice(i, 1); continue; }
      if (p.type === 'lx' && (p.id + ((this.time * 20) | 0)) % 3) continue; // giant maps: staggered checks
      this._L = p.layer | 0;
      const pr = p.type === 'wreck' ? 22 : 13;
      for (const t of this.near(p.x, p.y, pr * 1.6 + 3, tmp)) {
        if (!t.alive || Math.hypot(t.x - p.x, t.y - p.y) > pr * ((t.fx && t.fx.lootR) || 1)) continue;
        if (this.mode === 'classic' && t.team !== 0) continue;
        if (this.mode !== 'classic' && t.human) continue; // players press «ВЗЯТЬ»
        if (this.takePickup(t, p)) break;
      }
    }
  }
  statSnap(t) { const f = t.fx || {}; return { arm: t.armMul || 1, hp: t.maxHp, rng: t.bulletMul || 1, acc: t.accMul || 1, spd: t.speed, rel: 1 / (t.relMul || 1), dmg: t.dmgMul || 1, acc2: 1 / (f.spread || 1), turn: f.turn || 1 }; }
  statDiff(a, b) { const d = {}; for (const k in a) { const v = k === 'hp' ? b[k] - a[k] : (b[k] / a[k] - 1) * 100; if (Math.abs(v) >= 0.5) d[k] = Math.round(v); } return d; }
  // r23: mythic items never lie on the floor (real-money, pre-match only)
  noMythFloor() { const P = this.pickups; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; if (p.type === 'lx' && LOOTX[p.lid] && LOOTX[p.lid].r >= 5) P.splice(i, 1); else if (p.type === 'weapon' && p.mgi != null && MGS[p.mgi] && MGS[p.mgi].r >= 4) P.splice(i, 1); else if (p.type === 'weapon' && p.tier > 4) p.tier = 4; else if (p.type === 'armor' && p.tier > 4) p.tier = 4; } }
  takePickup(t, p, only) {
    if (p.type === 'wreck') return this.takeWreck(t, p, only);
    const S0 = this.statSnap(t);
    if (!this.applyPickup(t, p)) { if (t.human) this.ev({ k: 'pickFail', id: t.id, type: p.type, x: p.x, y: p.y }); return false; }
    const D = this.statDiff(S0, this.statSnap(t)); for (const e of this.events) if (e.k === 'pick' && e.id === t.id && !e.d) e.d = D; if (p.type !== 'lx') this.ev({ k: 'pick', id: t.id, type: p.type, wid: p.wid, tier: p.tier || 1, x: p.x, y: p.y, d: D });
    const i = this.pickups.indexOf(p); if (i >= 0) this.pickups.splice(i, 1); return true;
  }
  // r15: a destroyed tank drops EVERYTHING it carried in this match as one «Трофеи» crate (garage items stay on the account;
  // garage upgrades drop as a temporary in-match copy, capped at level 2 for fairness)
  dropWreck(t) {
    const it = [], add = (o) => it.push(o);
    if (t.weapon && t.weapon !== 'cannon') add({ type: 'weapon', wid: t.weapon, tier: Math.min(4, t.wtier || 1), ammo: t.ammo });
    if ((t.hrockets || 0) > 0) add({ type: 'hrocket', n: Math.min(10, t.hrockets) });
    if (t.armorT) add({ type: 'armor', tier: t.armorT, ak: t.armorK || 0, hp: t.armorHp || 0 });
    for (const k of ['med', 'smoke', 'mine']) { const n = t[k + 's'] || 0; if (n > 0) add({ type: k, n }); }
    if (t.beacons) add({ type: 'beacon' }); if (t.radar) add({ type: 'radar' });
    for (const [k, v] of Object.entries(MODS)) if ((t.mods || 0) & v.bit) add({ type: k });
    if (t.pd) for (let i = 0; i < 5; i++) if (t.pd[i] > 0.6) add({ type: 'part_' + PARTS[i] }); else if (!t.pd) add({ type: 'part_' + PARTS[i] });
    const lv = t.lv || {}, up = {}; let any = 0; for (const k of ['dmg', 'engine', 'reload']) if (lv[k] > 0) { up[k] = Math.min(2, lv[k]); any = 1; } if (any) add({ type: 'upg', lv: up });
    if (t.mu) { const m = {}; let a = 0; for (const k in t.mu) if (t.mu[k] > 0) { m[k] = t.mu[k]; a = 1; } if (a) add({ type: 'mupg', mu: m }); }
    if (this.mode === 'br' && t.shells != null && t.shells > 0) add({ type: 'ammo' });
    if (!it.length) { if (this.rng() < 0.5) this.dropLoot(t.x + 6, t.y); return; }
    this.pickups.push({ id: this.id(), x: t.x, y: t.y, type: 'wreck', wid: null, tier: 3, t: 0, life: this.mode === 'team' ? 60 : 9999, items: it, owner: t.name });
  }
  wreckItem(t, o) {
    switch (o.type) {
      case 'weapon': { const ok = this.applyPickup(t, { type: 'weapon', wid: o.wid, tier: o.tier, x: t.x, y: t.y }); if (ok && o.ammo != null && t.weapon === o.wid) t.ammo = Math.max(t.ammo || 0, o.ammo); return ok; }
      case 'hrocket': { const c = t.hrockets || 0; if (c >= 10) return false; const g = Math.min(10 - c, o.n); t.hrockets = c + g; o.n -= g; return o.n <= 0 ? true : 'part'; }
      case 'med': case 'smoke': case 'mine': { const key = o.type + 's', mx = ITEM_MAX[o.type] || 3, c = t[key] || 0; if (c >= mx) return false; const g = Math.min(mx - c, o.n); t[key] = c + g; o.n -= g; return o.n <= 0 ? true : 'part'; }
      case 'armor': { const ok = this.applyPickup(t, { type: 'armor', tier: o.tier, ak: o.ak }); if (ok && o.hp) t.armorHp = Math.min(t.armorHp, Math.max(o.hp, t.armorHp * 0.5)); return ok; }
      case 'rkt': { const A = t.rkA || (t.rkA = ROCKETS.map(() => 0)); const g = Math.min(4 - (A[o.i] || 0), o.n); if (g <= 0) return false; A[o.i] = (A[o.i] || 0) + g; if (!t.rkT || !A[t.rkT]) t.rkT = o.i; o.n -= g; return o.n <= 0 ? true : 'part'; }
      case 'shl': { if (!t.shA) t.shA = SHELLS.map((S, j) => j ? 0 : -1); const g = Math.min(SHELL_TYPE_CAP - (t.shA[o.i] || 0), o.n); if (g <= 0) return false; t.shA[o.i] += g; if (!t.human && !t.shT) t.shT = o.i; o.n -= g; return o.n <= 0 ? true : 'part'; }
      case 'upg': { let g = 0; t.lv = { ...t.lv }; for (const k in o.lv) if ((t.lv[k] || 0) < o.lv[k]) { t.lv[k] = o.lv[k]; g = 1; } return !!g; }
      case 'mupg': { let g = 0; t.mu = t.mu || {}; for (const k in o.mu) if ((t.mu[k] || 0) < o.mu[k]) { t.mu[k] = o.mu[k]; g = 1; } return !!g; }
      default: return this.applyPickup(t, { type: o.type, tier: o.tier || 1, x: t.x, y: t.y });
    }
  }
  takeWreck(t, p, only) {
    let got = 0; const idx = only != null ? [only] : p.items.map((_, i) => i);
    for (const i of idx.sort((a, b) => b - a)) { const o = p.items[i]; if (!o) continue; const S0 = this.statSnap(t); const r = this.wreckItem(t, o); if (r) { got++; this.ev({ k: 'pick', id: t.id, type: o.type, wid: o.wid, tier: o.tier || 1, x: p.x, y: p.y, d: this.statDiff(S0, this.statSnap(t)) }); if (r === true) p.items.splice(i, 1); } }
    if (!got && t.human) this.ev({ k: 'pickFail', id: t.id, type: 'wreck', x: p.x, y: p.y });
    if (!p.items.length) { const j = this.pickups.indexOf(p); if (j >= 0) this.pickups.splice(j, 1); }
    return got > 0;
  }
  applyPickup(t, p) {
    const tier = p.tier || 1; if (p.type === 'lx') { if (LOOTX[p.lid] && LOOTX[p.lid].r >= 5) return false; return this.takeLX(t, p); }
    switch (p.type) {
      case 'armor': if (t.armorT > tier || (t.armorT === tier && (p.ak || 0) === (t.armorK || 0) && t.armorHp >= armorMax(tier) * 0.9)) return false; t.armorT = tier; t.armorK = p.ak || 0; t.armorHp = armorMax(tier); return true;
      case 'med_s': if (t.hp >= t.maxHp) return false; t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.25); return true;
      case 'med_l': if (t.hp >= t.maxHp) return false; t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.8); return true;
      case 'part_tur': case 'part_gun': case 'part_trk': case 'part_eng': case 'part_pl': { const i = PARTS.indexOf(p.type.slice(5)), pd = t.pd || (t.pd = [1, 1, 1, 1, 1]); if (pd[i] >= 0.99) return false; pd[i] = 1; return true; }
      case 'beacon': if (t.beacons) return false; t.beacons = 1; return true;
      case 'revive': if (t.revives >= 1) return false; t.revives = 1; return true;
      case 'radar': if (t.radar) return false; t.radar = 1; return true;
      case 'repair': { const fixed = t.pd && t.pd.some(v => v < 1); if (t.pd) t.pd.fill(1); if (t.hp >= t.maxHp || t.regenT > 0) return !!fixed; } t.regenT = 8; t.regenR = t.maxHp * 0.5 / 8; return true;
      case 'med_team': { let n = 0; for (const o of this.tanks) if (o.alive && o.team === t.team && Math.hypot(o.x - t.x, o.y - t.y) < 130 && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.35); n++; } if (!n) return false; this.ev({ k: 'use', id: t.id, it: 'med', x: t.x, y: t.y }); return true; }
      case 'ammo': if (t.mounts && t.mounts.some(m => m.ammo < m.max)) { for (const m of t.mounts) m.ammo = Math.min(m.max, m.ammo + Math.ceil(m.max * 0.5)); if (t.ammo == null && (t.shells == null || t.shells >= BR_SHELLS * 2)) return true; }
        if (t.ammo == null) { if (t.shells == null || t.shells >= BR_SHELLS * 2) return false; t.shells = Math.min(BR_SHELLS * 2, t.shells + 50); return true; } t.ammo += Math.ceil((AMMO[t.weapon] || 10) * 0.6); return true;
      case 'smoke': case 'mine': if (t[p.type + 's'] >= ITEM_MAX[p.type]) return false; t[p.type + 's']++; return true;
      case 'twinr': { if ((t.twinN || 0) >= 2) return false; t.twinN = 2; return true; }
      case 'invis': { if ((t.invisN || 0) >= ITEM_MAX.invis) return false; t.invisN = (t.invisN || 0) + 1; t.invisTier = Math.max(t.invisTier || 1, p.tier || 1); return true; }
      case 'drone': case 'ldrone': { const k = p.type + 'sN'; if ((t[k] || 0) >= ITEM_MAX[p.type]) return false; t[k] = (t[k] || 0) + 1; return true; }
      case 'hrocket': if ((t.hrockets || 0) > 0) return false; t.hrockets = HROCKET_PACK; return true; // one pack max: new pack only when empty
      case 'med': if (this.mode === 'classic' || t.hp < t.maxHp * 0.5 && t.meds === 0) { if (t.hp >= t.maxHp && t.ai) return false; t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.45); return true; } if (t.meds >= ITEM_MAX.med) return false; t.meds++; return true;
      case 'mod_scope': case 'mod_barrel': case 'mod_loader': case 'mod_mag': { const bit = MODS[p.type].bit; if ((t.mods || 0) & bit) return false; t.mods = (t.mods || 0) | bit; if (bit === 8 && t.ammo != null) t.ammo = Math.round(t.ammo * 1.5); return true; }
      case 'shield': t.shield = Math.min(140, t.shield + 80); return true;
      case 'speed': t.speedT = 10; return true;
      case 'power': t.powerT = 12; return true;
      case 'weapon': if (t.ai && t.weapon !== 'cannon' && (p.tier || 1) <= t.wtier) return false;
        if (t.ammo != null && this.mode !== 'classic' && !(t.weapon === p.wid)) this.pickups.push({ id: this.id(), x: t.x + 10, y: t.y + 6, type: 'weapon', wid: t.weapon, mgi: t.mgi, ammo: t.mgi != null ? t.ammo : undefined, tier: t.wtier, t: 0, life: this.mode === 'team' ? 25 : 999 });
        if (t.weapon === p.wid && t.ammo != null) { t.ammo += AMMO[p.wid] || 0; t.wtier = Math.max(t.wtier, tier); } else { t.weapon = p.wid; t.mgi = p.wid === 'mg' && p.mgi != null ? p.mgi : null; t.ammo = p.mgi != null && MGS[p.mgi] ? (p.ammo || MGS[p.mgi].cap) : this.mode === 'classic' ? null : Math.round((AMMO[p.wid] || 0) * (1 + 0.25 * (tier - 1)) * ((t.mods || 0) & 8 ? 1.5 : 1)) || null; t.wtier = tier; }
        t.cd = 0.2; return true;
      case 'star': t.stars = Math.min(3, t.stars + 1); return true;
      case 'helmet': t.inv = 10; return true;
      case 'grenade': for (const e of this.tanks) if (e.alive && e.team === 1 && e.spawnT <= 0) this.kill(e, t, 'grenade'); return true;
      case 'life': this.lives++; return true;
      case 'shovel': this.shovelT = 18; classicRing(this.map, T_STEEL); this.markRing(); return true;
      case 'clock': this.freezeT = 10; return true;
    }
    return true;
  }
  markRing() { const m = this.map; for (let r = 46; r < 52; r++) for (let c = 22; c < 30; c++) m.changes.push(r * m.w + c); m.version++; }

  // ---------- modes ----------
  stepZone(dt) {
    if (!this.ffa && !this.result && (this.opts.brTime || this.opts.brKills)) { const top = this.tanks.filter(t => t.alive).sort((x, y) => y.kills - x.kills || y.hp - x.hp)[0]; // «Игра с друзьями»: optional time limit / kill target for BR
      if (top && ((this.opts.brTime && this.time >= this.opts.brTime) || (this.opts.brKills && top.kills >= this.opts.brKills))) { this.finish({ winner: top.id, timeout: this.time >= (this.opts.brTime || 1e9) }); return; } }
    if (this.ffa) { if (this.time >= this.timeLimit) { const top = this.ffaRanking()[0]; this.finish({ winner: top ? top.id : 0, timeout: true }); } return; }
    const z = this.zone;
    if (z.state === 'wait') { z.timer -= dt; if (z.timer <= 0) { z.state = 'shrink'; const ph = this.zonePhases[z.phase]; z.timer = ph.shrink; z.total = ph.shrink; z.sr = z.r; z.scx = z.cx; z.scy = z.cy; z.dps = ph.dps; this.ev({ k: 'zone' }); } }
    else if (z.state === 'shrink') { z.timer -= dt; const f = 1 - Math.max(0, z.timer) / z.total; z.r = z.sr + (z.tr - z.sr) * f; z.cx = z.scx + (z.tcx - z.scx) * f; z.cy = z.scy + (z.tcy - z.scy) * f; if (z.timer <= 0) this.nextZone(); }
    else if (z.state === 'final') { z.dps = 50; }
    this.zoneTick = (this.zoneTick || 0) + dt;
    if (this.zoneTick >= 0.5) {
      this.zoneTick -= 0.5;
      for (const t of this.tanks) if (t.alive && Math.hypot(t.x - z.cx, t.y - z.cy) > z.r) { t.inv = 0; const s = t.shield; t.shield = 0; this.damage(t, z.dps * 0.5 * (this.opts.hpMul ?? HP_MUL), 0, 'zone', t.x, t.y); t.shield = s; }
    }
  }
  stepTeam(dt) { if (this.special) this.stepSpecial(dt); if (this.result) return; if (this.time >= this.timeLimit) this.finish(this.special === 'race' ? { winner: this.raceRanking()[0].id, race: true, timeout: true } : { winnerTeam: this.special === 'boss' ? 1 : this.score[0] === this.score[1] ? -1 : (this.score[0] > this.score[1] ? 0 : 1), timeout: true }); }
  stepClassic(dt) {
    this.freezeT = Math.max(0, this.freezeT - dt);
    if (this.shovelT > 0) { this.shovelT -= dt; if (this.shovelT <= 0 && this.baseAlive) { classicRing(this.map, T_BRICK); this.markRing(); } }
    const onField = this.tanks.filter(t => t.team === 1 && t.alive).length;
    this.spawnTimer -= dt;
    if (this.queue.length && onField < 4 && this.spawnTimer <= 0) { this.spawnClassicEnemy(); this.spawnTimer = Math.max(1.2, 2.6 - this.level * 0.15); }
    // remove dead enemies from list to keep it small
    if (this.tanks.length > 30) this.tanks = this.tanks.filter(t => t.alive || t.human);
  }
  // ---------- queries ----------
  humans() { return this.tanks.filter(t => t.human); }
  byCid(cid) { return this.tanks.find(t => t.cid === cid); }
  teamOf(t) { return t.team; }
}
