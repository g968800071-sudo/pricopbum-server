import { ROSTER } from './flags.js';
// PRICOPBUM — shared definitions (pure, no DOM). Used by client, server and Bluetooth host.
export const CELL = 8;            // world px per map cell
export const T_EMPTY = 0, T_BRICK = 1, T_STEEL = 2, T_WATER = 3, T_BUSH = 4, T_ICE = 5, T_CRATE = 6, T_BASE = 7;
// r15 terrain: «Грязь» (x0.7 speed, partial concealment) and «Болото» (x0.5, tank half-submerged, hidden unless within ~2.5 tiles or firing)
export const T_HATCH = 10;
export const T_CONC = 11; // r20: deployable concrete blocks — immune to bullets/MG/shells, only rockets break them
export const T_MUD = 8, T_SWAMP = 9, MUD_SPD = 0.7, SWAMP_SPD = 0.5, SWAMP_SEE = 20, MUD_SEE = 72, BUSH_SEE = 48;
export const BEACON_R = 12 * CELL, BEACON_T = 15; // «Маяк»: 12-tile reveal for 15 s
export const DIVE_MAX = 30, DIVE_CD = 10, DIVE_SEE = 14; // max 30 s under, 10 s cooldown when out of air; revealed only within 1 tile
export const TANK_R = 9.5; // r17: was 7.5 (tanks drawn 1.5x larger)

export const WEAPONS = {
  cannon: { id: 'cannon', name: 'Пушка',    dmg: 34, reload: 0.42, speed: 330, life: 0.9,  spread: 0.02, count: 1, splash: 0,  pierce: false, steel: false, brick: 1, color: '#ffe27a' },
  twin:   { id: 'twin',   name: 'Спарка',   dmg: 22, reload: 0.48, speed: 340, life: 0.85, spread: 0.03, count: 2, splash: 0,  pierce: false, steel: false, brick: 1, color: '#7af0ff' },
  mg:     { id: 'mg',     name: 'Пулемёт',  dmg: 8,  reload: 0.085,speed: 380, life: 0.65, spread: 0.09, count: 1, splash: 0,  pierce: false, steel: false, brick: 0.34, color: '#fff3b0' },
  rocket: { id: 'rocket', name: 'Ракеты',   dmg: 48, reload: 1.05, speed: 230, life: 1.4,  spread: 0.01, count: 1, splash: 26, pierce: false, steel: false, brick: 2, color: '#ff8a3d', homing: 2.2 },
  salvo:  { id: 'salvo',  name: 'Залповые ракеты', fam: 'rocket', loot: true, dmg: 24, reload: 1.2, speed: 250, life: 1.1, spread: 0.16, count: 3, splash: 16, pierce: false, steel: false, brick: 1, color: '#ffb35c' },
  heavy:  { id: 'heavy',  name: 'Фугасные ракеты', fam: 'rocket', loot: true, dmg: 78, reload: 1.75, speed: 190, life: 1.6, spread: 0.01, count: 1, splash: 46, pierce: false, steel: false, brick: 3, color: '#ff5a3d' },
  shotgun: { id: 'shotgun', name: 'Дробовик', dmg: 11, reload: 0.85, speed: 360, life: 0.33, spread: 0.2, count: 6, splash: 0, pierce: false, steel: false, brick: 0.5, color: '#ffd9a0' },
  flame:  { id: 'flame',  name: 'Огнемёт',  dmg: 4.2, reload: 0.06, speed: 175, life: 0.34, spread: 0.2, count: 1, splash: 0, pierce: false, steel: false, brick: 0.12, color: '#ff7a2a', flame: true },
  laser:  { id: 'laser',  name: 'Крио-лазер', dmg: 15, reload: 0.24, speed: 1300, life: 0.26, spread: 0, count: 1, splash: 0, pierce: false, steel: false, brick: 0.6, color: '#ff3d5a', beam: true },
  emp:    { id: 'emp',    name: 'ЭМИ-пушка', dmg: 24, reload: 0.8, speed: 300, life: 0.9, spread: 0.02, count: 1, splash: 0, pierce: false, steel: false, brick: 0.5, color: '#5df0ff', freeze: 1.6 },
  ricochet: { id: 'ricochet', name: 'Рикошет', dmg: 30, reload: 0.55, speed: 320, life: 1.3, spread: 0.02, count: 1, splash: 0, pierce: false, steel: false, brick: 0.5, color: '#b8ff5d', bounce: 2 },
  homing: { id: 'homing', name: 'Самонаводящиеся ракеты', fam: 'rocket', loot: true, dmg: 40, reload: 1.15, speed: 210, life: 1.8, spread: 0.02, count: 1, splash: 22, pierce: false, steel: false, brick: 2, color: '#ff6bd6', homing: 5.5 },
  mortar: { id: 'mortar', name: 'Кассетный миномёт', fam: 'rocket', loot: true, dmg: 52, reload: 1.9, speed: 170, life: 1.35, spread: 0.04, count: 1, splash: 38, pierce: false, steel: false, brick: 2, color: '#d0d0d0', lob: true, cluster: 4 },
  hrocket: { id: 'hrocket', name: 'Самонаводящаяся ракета', fam: 'rocket', loot: true, dmg: 16, reload: 0.35, speed: 230, life: 2.6, spread: 0, count: 1, splash: 0, pierce: false, steel: false, brick: 1, color: '#ff4fa3' },
  rail:   { id: 'rail',   name: 'Рельсотрон',dmg: 72, reload: 1.55, speed: 950, life: 0.45, spread: 0,    count: 1, splash: 0,  pierce: true,  steel: true,  brick: 2, color: '#c58bff' },
};
export const WEAPON_LIST = ['cannon', 'twin', 'mg', 'rocket', 'rail', 'salvo', 'heavy', 'shotgun', 'flame', 'laser', 'emp', 'ricochet', 'homing', 'mortar', 'hrocket'];
export const HROCKET_LOCK = 76; // lock radius, px (~9.5 tiles)
export const HROCKET_PACK = 10;
// r15: damageable tank parts (index = bit) and damage types. Broken parts stay broken until a part pickup or a repair kit.
export const PARTS = ['tur', 'gun', 'trk', 'eng', 'pl'];
export const PART_NAMES = { tur: 'Башня', gun: 'Пушка', trk: 'Гусеницы', eng: 'Двигатель', pl: 'Бронеплиты' };
export const DMG_TYPE = { flame: 'fire', emp: 'emp', laser: 'frost', mine: 'blast', mortar: 'blast', rocket: 'blast', salvo: 'blast', heavy: 'blast', homing: 'blast', hrocket: 'blast', zone: 'zone', burn: 'fire' };
export const DMG_COLOR = { kin: '#ffe27a', fire: '#ff8a2a', emp: '#5df0ff', frost: '#bfe9ff', blast: '#ffb35c', zone: '#c58bff', crit: '#ff4d6d' };
// r15 radar: enemies show on the minimap only inside this radius (13 tiles); bushes/smoke hide them unless very close;
// a shot reveals the shooter at RADAR_SHOT x radius; the «Радар» module extends it x1.5 until death.
export const RADAR_R = 13 * CELL, RADAR_CLOSE = 4 * CELL, RADAR_SHOT = 2.2, RADAR_MOD = 1.5;
export const NET_ENEMY_R = 330; // server never sends enemy tanks farther than this (screen + margin): anti map-hack
export const LOOT_SEE = 130; // r25: loot is visible (players) / known (bots) only within this radius
export const LOOT_REVEAL = 72; // px: BR loot shows its contents only this close
export const SHOP_WEAPONS = WEAPON_LIST.filter(w => !WEAPONS[w].loot);
export const LOOT_WEAPONS = ['twin', 'mg', 'rocket', 'rail', 'salvo', 'heavy', 'shotgun', 'flame', 'laser', 'emp', 'ricochet', 'homing', 'mortar'];
// weapon mods found in BR loot: bit, name, effect
export const MODS = { mod_scope: { bit: 1, name: 'Оптический прицел', short: 'Прицел', desc: '+30% дальности' }, mod_barrel: { bit: 2, name: 'Усиленный ствол', short: 'Ствол', desc: '+15% урона' }, mod_loader: { bit: 4, name: 'Автомат заряжания', short: 'Заряжание', desc: '−18% перезарядки' }, mod_mag: { bit: 8, name: 'Расширенный магазин', short: 'Магазин', desc: '+50% патронов' } };

// Garage upgrade tracks (fair: same caps for everyone, earned with coins, never sold for real money directly)
export const UPGRADES = {
  dmg:    { name: 'Урон',      per: 0.07, max: 5 },
  reload: { name: 'Перезарядка', per: 0.06, max: 5 },
  armor:  { name: 'Броня',     per: 0.10, max: 5 },
  engine: { name: 'Двигатель', per: 0.05, max: 5 },
};
export const UPGRADE_COST = [250, 600, 1200, 2200, 3600];
export const WEAPON_PRICE = { cannon: 0, twin: 600, mg: 900, shotgun: 1100, flame: 1300, rocket: 1500, ricochet: 1700, laser: 2000, rail: 2400, emp: 2600 };

// Cosmetic skins only (no stats)
export const SKINS = {
  olive:   { name: 'Олива',     body: '#6f8f3a', dark: '#4a6224', light: '#9bbd5a', price: 0,   cur: 'coins' },
  desert:  { name: 'Пустыня',   body: '#c9a15b', dark: '#8f6f37', light: '#e8c98a', price: 400, cur: 'coins' },
  arctic:  { name: 'Арктика',   body: '#c8d6e3', dark: '#8aa0b5', light: '#f3f8fc', price: 700, cur: 'coins' },
  night:   { name: 'Ночь',      body: '#3c4766', dark: '#252d44', light: '#6274a3', price: 1000, cur: 'coins' },
  crimson: { name: 'Багровый',  body: '#b8323a', dark: '#7c1d24', light: '#e86068', price: 60,  cur: 'gems' },
  neon:    { name: 'Неон',      body: '#1fd1a5', dark: '#0e8a6c', light: '#8dffe2', price: 120, cur: 'gems' },
  gold:    { name: 'Золото',    body: '#e0b43a', dark: '#9c7a1c', light: '#fff0a0', price: 0,   cur: 'iap', iap: 'skin_gold' },
  camo:    { name: 'Камуфляж',  body: '#56663a', dark: '#2f3a1e', light: '#8a9a5c', price: 250, cur: 'gems', camo: true },
};
export const SKIN_LIST = Object.keys(SKINS);
export const BOT_SKINS = ['olive', 'desert', 'arctic', 'night', 'crimson', 'neon', 'camo'];
export const TEAM_COLORS = [
  { body: '#3d7be0', dark: '#234c94', light: '#7fb0ff' },
  { body: '#e04848', dark: '#922727', light: '#ff8a8a' },
];

// Distinct per-team colours (well separated hues). 2-team modes: 0 = blue, 1 = red.
export const TEAM_PALETTE = ['#4d8dff', '#ff4d4d', '#3ddc6a', '#ffc53d', '#c66bff', '#3de0e0', '#ff8a2b', '#ff5fb8', '#a8e03d', '#8a9bff', '#e0e0e0', '#b8875a'];
const teamIdx = (team) => (team >= 1000 ? team - 1000 : team);
export function teamColor(team) { team = teamIdx(team); return TEAM_PALETTE[((team % TEAM_PALETTE.length) + TEAM_PALETTE.length) % TEAM_PALETTE.length]; }
// Short tag so teams sharing a hue (e.g. 50 duos) still differ: «К7».
export function teamTag(team) { return 'К' + (teamIdx(team) + 1); }

export const PICKUPS = {
  med:    { name: 'Аптечка',  color: '#ff5d6c' },
  shield: { name: 'Щит',      color: '#5dc8ff' },
  speed:  { name: 'Нитро',    color: '#ffd23d' },
  power:  { name: 'Мощь',     color: '#ff9f3d' },
  weapon: { name: 'Оружие',   color: '#c58bff' },
  armor:  { name: 'Броня',    color: '#9fb4c8' },
  ammo:   { name: 'Боеприпасы', color: '#e8d27a' },
  smoke:  { name: 'Дымовая шашка', color: '#b9c2cc' },
  drone:  { name: 'Боевой дрон', color: '#9fd3ff' },
  ldrone: { name: 'Легендарный дрон', color: '#ffb347' },
  invis:  { name: 'Невидимка', color: '#b9a7ff' }, // r26: 10 s cloak, tiers 1/4/5 → cooldown 25/20/15 s
  twinr:  { name: 'Спаренные ракеты', color: '#ff6b4a' },
  mine:   { name: 'Мина',     color: '#ff6b4a' },
  fire:   { name: 'Ящик с огнём · Молотов ×8', color: '#ff6a1f', lab: 'Молотов ×8' }, // r36
  zap:    { name: 'Ящик с молниями · Молния ×28', color: '#f4f8ff', lab: 'Молния ×28' }, // r36
  mod_scope: { name: 'Оптический прицел', color: '#7dffcf' }, mod_barrel: { name: 'Усиленный ствол', color: '#7dffcf' }, mod_loader: { name: 'Автомат заряжания', color: '#7dffcf' }, mod_mag: { name: 'Расширенный магазин', color: '#7dffcf' },
  loot:   { name: 'Добыча', color: '#d8c38a' },
  wreck:  { name: 'Трофеи', color: '#ff9a4a' },
  revive: { name: 'Ремкомплект воскрешения', color: '#6cff9a' },
  upg:    { name: 'Улучшения (на матч)', color: '#ffd23d' },
  mupg:   { name: 'Улучшения базы', color: '#ffd23d' },
  med_s:  { name: 'Малая аптечка', color: '#ff8a96' }, med_l: { name: 'Большая аптечка', color: '#ff3d55' },
  hrocket: { name: 'Самонаводящиеся ракеты ×10', color: '#ff4fa3' },
  part_tur: { name: 'Башня', color: '#c9d1d9' }, part_gun: { name: 'Пушка', color: '#c9d1d9' }, part_trk: { name: 'Гусеницы', color: '#c9d1d9' },
  part_eng: { name: 'Двигатель', color: '#c9d1d9' }, part_pl: { name: 'Бронеплиты', color: '#c9d1d9' },
  radar: { name: 'Модуль радара', color: '#7dffb0' },
  beacon: { name: 'Маяк (мифический)', color: '#ff4d7a' },
  repair: { name: 'Ремкомплект', color: '#7dff8a' }, med_team: { name: 'Полевой госпиталь', color: '#ff9fe0' },
  // classic-mode bonuses
  star: { name: 'Звезда', color: '#ffe066' }, helmet: { name: 'Шлем', color: '#9ad7ff' },
  grenade: { name: 'Граната', color: '#ff7a59' }, life: { name: 'Жизнь', color: '#7dff8a' },
  shovel: { name: 'Лопата', color: '#e0b07a' }, clock: { name: 'Часы', color: '#b8b8ff' },
};

export const BOT_NAMES = ROSTER.map(r => r.name); // r28: 1200 realistic nicknames from 200+ countries (src/sim/flags.js)

// 5 difficulty levels: bot aim skill range, upgrade level cap, hp multiplier, reward multiplier
// r19 (vs the human): dk = bot damage multiplier, ae = extra aim error (rad), rd = extra first-shot delay (s), fc = max bots focusing the player, rk = rocket chance multiplier
export const DIFFS = [
  { id: 0, name: 'Лёгкий', sk: [0.05, 0.35], lv: 0, hp: 0.8, rew: 0.7, dk: 0.31, ae: 0.55, rd: 1.6, fc: 1, rk: 0.2 },
  { id: 1, name: 'Обычный', sk: [0.12, 0.5], lv: 0, hp: 0.86, rew: 1, dk: 0.34, ae: 0.45, rd: 1.3, fc: 1, rk: 0.25 }, // r25: softened (user: dying too fast on Normal)
  { id: 2, name: 'Сложный', sk: [0.45, 0.85], lv: 3, hp: 1.1, rew: 1.3, dk: 0.85, ae: 0.05, rd: 0.15, fc: 3, rk: 0.8 },
  { id: 3, name: 'Очень сложный', sk: [0.65, 0.95], lv: 4, hp: 1.2, rew: 1.6, dk: 1, ae: 0, rd: 0.04, fc: 4, rk: 1 },
  { id: 4, name: 'Невыносимый', sk: [0.8, 0.95], lv: 3, hp: 1.2, rew: 2.2, dk: 0.95, ae: 0.02, rd: 0.08, fc: 4, rk: 1.2 },
];
export const SQUADS = [1, 2, 3, 4, 5, 20];

// Loot tiers (weapons and armor)
export const TIERS = [
  { name: 'Обычный', color: '#c9d1d9' }, { name: 'Необычный', color: '#5dff8a' }, { name: 'Редкий', color: '#5cc2ff' },
  { name: 'Эпический', color: '#c58bff' }, { name: 'Легендарный', color: '#ffb43d' },
];
// special armour kinds on top of the 5 tiers
export const ARMOR_KINDS = [
  { id: 0, name: '', short: '' },
  { id: 1, name: 'противоракетная', short: 'ПР', desc: '−45% урона от взрывов' },
  { id: 2, name: 'рикошетная', short: 'РК', desc: '30% снарядов отскакивают' },
  { id: 3, name: 'регенерирующая', short: 'РГ', desc: 'сама восстанавливается' },
  { id: 4, name: 'противоминная', short: 'ПМ', desc: '−75% урона от мин' },
  { id: 5, name: 'огнеупорная', short: 'ОГ', desc: 'не горит, −50% огня' },
  { id: 6, name: 'экранированная', short: 'ЭК', desc: 'иммунитет к ЭМИ и заморозке' },
];
export const ARMOR_NAMES = ['Лёгкая броня', 'Композитная броня', 'Реактивная броня', 'Керамическая броня', 'Титановая броня'];
export const AMMO = { cannon: null, twin: 40, mg: 160, rocket: 12, rail: 8, salvo: 15, heavy: 6, shotgun: 14, flame: 220, laser: 45, emp: 12, ricochet: 30, homing: 10, mortar: 6 };
export const ITEM_MAX = { hrocket: 10, med: 5, smoke: 5, mine: 5, revive: 2, drone: 5, ldrone: 5, invis: 3 } // r25: more perk slots;
export const armorReduce = (tier) => tier > 0 ? 0.08 + tier * 0.07 : 0; // 15%..43%
export const armorMax = (tier) => 60 + tier * 50; // r15: doubled with tank HP
export const TIER_DMG = [1, 1.03, 1.05, 1.07, 1.10, 1.20]; // r26: common small bonus, legendary +10%, mythic +20% — identical for players and bots
export const tierMul = (tier) => TIER_DMG[Math.max(0, Math.min(5, tier || 1))];

// Game variants on top of the 3 core rule sets (br / team / classic)
export const VARIANTS = {
  br:      { mode: 'br', opts: {} },
  brg:     { mode: 'br', opts: { giant: true, mapSize: 600, total: 100 } }, // «Гигантская карта»: 600×600 тайлов, ~60 мин
  cbr:     { mode: 'br', opts: { cbuild: true } },
  cbr2: { mode: 'br', opts: { cbuild: true, squad: 2 } }, cbr3: { mode: 'br', opts: { cbuild: true, squad: 3 } }, cbr4: { mode: 'br', opts: { cbuild: true, squad: 4 } },
  cbr5: { mode: 'br', opts: { cbuild: true, squad: 5 } }, cbr20: { mode: 'br', opts: { cbuild: true, squad: 20 } }, // «Конструктор BR»: own build vs varied bot builds
  ffa:     { mode: 'br', opts: { ffa: true, total: 30, mapSize: 210, target: 50, timeLimit: 900 } },
  team:    { mode: 'team', opts: { perTeam: 10, target: 100 } },
  team20:  { mode: 'team', opts: { perTeam: 20, target: 150, timeLimit: 600 } },
  arena:   { mode: 'team', opts: { perTeam: 3, target: 20, timeLimit: 300 } },
  duel:    { mode: 'team', opts: { perTeam: 1, target: 7, timeLimit: 240 } },
  survival: { mode: 'team', opts: { special: 'survival', allies: 0 } },
  zombie:  { mode: 'team', opts: { special: 'zombie', allies: 0, map: 13 } },
  boss:    { mode: 'team', opts: { special: 'boss', timeLimit: 300, map: 8 } },
  moba:    { mode: 'team', opts: { special: 'moba', perTeam: 30, timeLimit: 1505 } },
  hunt:    { mode: 'team', opts: { special: 'hunt', perTeam: 5, target: 1e9, timeLimit: 600, map: 15, noBunker: true } }, // r36 «Охота» 1×5 on BUGA.BUM
  trench:  { mode: 'team', opts: { special: 'trench', perTeam: 15, target: 1e9, timeLimit: 900, map: 16, mapW: 220, mapH: 130, noBunker: true } }, // r37 «Траншеи» 15×15, 15 min, more kills wins
  koth:    { mode: 'team', opts: { special: 'koth', perTeam: 5, target: 90, timeLimit: 420 } },
  sniper:  { mode: 'team', opts: { special: 'sniper', perTeam: 5, target: 30, timeLimit: 360, map: 6 } },
  ctf:     { mode: 'team', opts: { special: 'ctf', perTeam: 5, target: 3, timeLimit: 600, map: 4 } },
  race:    { mode: 'team', opts: { special: 'race', total: 8, laps: 3, timeLimit: 480 } },
  coop:    { mode: 'team', opts: { special: 'survival', allies: 0, coop: true } },
  classic: { mode: 'classic', opts: {} },
};
export const ARENA_FORMATS = [1, 2, 3, 'ffa6'];
export const FFA_TARGETS = [20, 50, 100];
export const WAVE_W = ['cannon', 'cannon', 'twin', 'mg', 'rocket'];

// r25: tanks can ford rivers/lakes: slower, 30 s safe, then armour → HP drain
export const WATER_SAFE = 30, WATER_SPD = 0.5;

// r36 «Охота»: target 5 lives + unlimited ammo + explicit armour/speed bonus (shown in the HUD); hunters 3 lives each; 10 min; hunters held at spawn for a head start
export const HUNT = { tLives: 5, hLives: 3, hpMul: 1.6, spdMul: 1.12, hold: 10, time: 600 };
