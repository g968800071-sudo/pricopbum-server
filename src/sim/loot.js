// r16b floor loot catalogue: rockets, mines, weapon variants, spare parts, perks, mods (+ the 25 shells). Deterministic, data-driven.
import { SHELLS } from './loadout.js';
export const ROCKETS = [
  { id: 'hom', name: 'Самонаводящаяся (пачка 10)', col: '#ff4d4d', homing: 1, desc: 'Захват цели, правила пачки ×10' },
  { id: 'clu', name: 'Кассетная', col: '#ffb347', dmg: 30, splash: 18, cluster: 6 },
  { id: 'emp', name: 'ЭМИ-ракета', col: '#7fd8ff', dmg: 15, splash: 30, emp: 3 },
  { id: 'inc', name: 'Зажигательная', col: '#ff5a1f', dmg: 25, splash: 24, burn: 4 },
  { id: 'bnk', name: 'Бункерная', col: '#a0a0a0', dmg: 55, splash: 20, brick: 4, steel: 1 },
  { id: 'aa', name: 'Антидрон (ПВО)', col: '#9fe8ff', dmg: 12, aa: 1, spd: 1.5 },
  { id: 'smk', name: 'Дымовая', col: '#c8c8c8', dmg: 5, splash: 10, smoke: 2 },
  { id: 'tan', name: 'Тандемная', col: '#ff4d7a', dmg: 60, vsArm: 1.7 },
  { id: 'thb', name: 'Термобарическая', col: '#ff3d1f', dmg: 50, splash: 42, burn: 2 },
  { id: 'gid', name: 'Управляемая', col: '#ffd23d', dmg: 46, splash: 16, guide: 1, spd: 0.8 },
  { id: 'frz', name: 'Криогенная', col: '#bff4ff', dmg: 21, splash: 26, freeze: 3 },
  { id: 'flr', name: 'Осветительная', col: '#ff4dd2', dmg: 4, splash: 40, reveal: 10 },
  { id: 'grv', name: 'Гравитационная', col: '#8a6cff', dmg: 18, splash: 40, pull: 120 },
  { id: 'shk', name: 'Ударно-волновая', col: '#ffd9a0', dmg: 22, splash: 34, knock: 220 },
  { id: 'acd', name: 'Кислотная', col: '#9cff3d', dmg: 19, splash: 24, acid: 50 },
  { id: 'lgt', name: 'Грозовая', col: '#7ff7ff', dmg: 28, chain: 0.6 },
  { id: 'mrv', name: 'РГЧ (MIRV)', col: '#ff8a3d', dmg: 17, splash: 14, cluster: 10 },
  { id: 'snp', name: 'Скоростная «Игла»', col: '#e0e0e0', dmg: 70, spd: 2 },
  { id: 'nap', name: 'Напалм', col: '#ff7b00', dmg: 14, splash: 32, burn: 6, smoke: 1 },
  { id: 'trp', name: 'Минная (раскидывает 3 мины)', col: '#ffe27a', dmg: 10, splash: 10, mines: 3 },
  // r20: +32 rockets (52 total): arcing (навесные), straight, cluster, thermobaric, EMP… and 8 HOMING types (pack 10, lock radius rules)
  { id: 'bal', name: 'Баллистическая', col: '#d9c27a', dmg: 64, splash: 22, arc: 1, rng: 2.4 },
  { id: 'mor', name: 'Миномётная', col: '#b0a070', dmg: 40, splash: 30, arc: 1, rng: 1.5 },
  { id: 'gau', name: 'Гаубичная', col: '#c9b48a', dmg: 58, splash: 26, arc: 1, rng: 2.6, spd: 0.9 },
  { id: 'acl', name: 'Навесная кассетная', col: '#ffc46b', dmg: 24, splash: 14, cluster: 8, arc: 1, rng: 2 },
  { id: 'tbm', name: 'Термобарическая-М', col: '#ff2d10', dmg: 62, splash: 48, burn: 3, rng: 1.6 },
  { id: 'vac', name: 'Вакуумная', col: '#ff6a4d', dmg: 57, splash: 52, pull: 60, rng: 1.7 },
  { id: 'emh', name: 'ЭМИ-тяжёлая', col: '#5fc8ff', dmg: 26, splash: 36, emp: 5, rng: 1.9 },
  { id: 'pls', name: 'Плазменная', col: '#c86bff', dmg: 66, vsArm: 1.3, rng: 1.4, spd: 1.3 },
  { id: 'kum', name: 'Кумулятивная', col: '#ff8fa8', dmg: 63, vsArm: 1.9, rng: 1.5 },
  { id: 'lom', name: 'Бронебойная «Лом»', col: '#d0d0d0', dmg: 68, vsArm: 1.5, spd: 1.6, rng: 1.3 },
  { id: 'fug', name: 'Фугасная', col: '#e8a060', dmg: 52, splash: 30, brick: 3, rng: 1.8 },
  { id: 'osk', name: 'Осколочная', col: '#ffd080', dmg: 33, splash: 12, cluster: 12, rng: 1.7 },
  { id: 'inm', name: 'Зажигательная-М', col: '#ff4a00', dmg: 29, splash: 30, burn: 8, rng: 1.9 },
  { id: 'crb', name: 'Криобомба', col: '#9fe8ff', dmg: 31, splash: 34, freeze: 5, rng: 1.6 },
  { id: 'acr', name: 'Кислотный дождь', col: '#b8ff3d', dmg: 23, splash: 16, acid: 80, cluster: 5, arc: 1, rng: 2.1 },
  { id: 'chn', name: 'Цепная', col: '#7fffd4', dmg: 36, chain: 0.9, rng: 2 },
  { id: 'shp', name: 'Шрапнельная', col: '#e6c27a', dmg: 39, splash: 10, cluster: 7, rng: 1.5 },
  { id: 'prb', name: 'Пробивная', col: '#a8a8a8', dmg: 47, splash: 14, brick: 6, steel: 1, rng: 1.6 },
  { id: 'str', name: 'Дальнобойная «Стрела»', col: '#f0f0ff', dmg: 54, spd: 1.8, rng: 3 },
  { id: 'kuv', name: 'Ближняя «Кувалда»', col: '#ff9a5a', dmg: 75, splash: 20, rng: 0.7, spd: 0.8 },
  { id: 'hos', name: 'Самонаводящаяся «Оса»', col: '#ff6b6b', dmg: 34, hm: 1, rng: 2.2, spd: 1.1 },
  { id: 'hgd', name: 'Самонаводящаяся «Гадюка»', col: '#ff3b5c', dmg: 41, hm: 1, rng: 2, spd: 1.2 },
  { id: 'hkr', name: 'Самонаводящаяся «Коршун»', col: '#ff8a8a', dmg: 48, splash: 14, hm: 1, rng: 2.6, spd: 0.9 },
  { id: 'hrj', name: 'Самонаводящийся «Рой»', col: '#ffa0a0', dmg: 27, cluster: 4, splash: 10, hm: 1, rng: 2.1 },
  { id: 'hth', name: 'Тепловая самонаводящаяся', col: '#ff5a2a', dmg: 37, burn: 3, hm: 1, rng: 2.3 },
  { id: 'hem', name: 'ЭМИ-охотник', col: '#6fd0ff', dmg: 43, splash: 18, emp: 3, hm: 1, rng: 2.2 },
  { id: 'hic', name: 'Ледяной ястреб', col: '#c0f0ff', dmg: 32, splash: 16, freeze: 2, hm: 1, rng: 2.4 },
  { id: 'htd', name: 'Тандем-охотник', col: '#ff4d9a', dmg: 44, vsArm: 1.5, hm: 1, rng: 1.9 },
  { id: 'ssm', name: 'Сейсмическая', col: '#d8b080', dmg: 35, splash: 40, knock: 300, arc: 1, rng: 1.8 },
  { id: 'bln', name: 'Ослепляющая', col: '#ffffff', dmg: 9, splash: 30, reveal: 8, smoke: 2, rng: 2.2 },
  { id: 'net', name: 'Сетевая', col: '#a0ffd0', dmg: 13, splash: 28, freeze: 1.5, pull: 40, rng: 1.7 },
  { id: 'pbm', name: 'Противобункерная-М', col: '#909090', dmg: 61, splash: 24, brick: 6, steel: 1, arc: 1, rng: 2.2 },
];
export const MINES = [
  { id: 'std', name: 'Противотанковая', col: '#ff4d4d', dmg: 60, r: 11, splash: 30 },
  { id: 'prx', name: 'Неконтактная', col: '#ffb347', dmg: 42, r: 24, splash: 34 },
  { id: 'mag', name: 'Магнитная', col: '#5cc2ff', dmg: 55, r: 30, pull: 90, splash: 26 },
  { id: 'emp', name: 'ЭМИ-мина', col: '#7fd8ff', dmg: 10, r: 14, emp: 4, splash: 40 },
  { id: 'smk', name: 'Дымовая мина', col: '#c8c8c8', dmg: 0, r: 16, smoke: 2, splash: 10 },
  { id: 'clu', name: 'Кассетная мина', col: '#ffd23d', dmg: 30, r: 12, cluster: 5, splash: 18 },
  { id: 'rem', name: 'Радиоуправляемая', col: '#ff4dd2', dmg: 85, r: 0, remote: 1, splash: 38, desc: 'Подрыв кнопкой ДЕТ (или бот сам)' },
  { id: 'bnc', name: 'Прыгающая', col: '#ff8a3d', dmg: 50, r: 14, delay: 0.45, splash: 44 },
  { id: 'frz', name: 'Морозная мина', col: '#bff4ff', dmg: 15, r: 14, freeze: 4, splash: 36 },
  { id: 'dec', name: 'Мина-приманка', col: '#d2ff6c', dmg: 0, r: 16, decoy: 1, reveal: 8, splash: 0, desc: 'Фальшивый танк для ботов, подсвечивает наехавшего' },
];
// stat-effect vocabulary used by parts/perks/mods: multiplicative stats + specials (all applied in sim.applyFx)
const AFF = [['Скорострельный', { rel: 0.75, dmg: 0.9 }], ['Тяжёлый', { dmg: 1.3, rel: 1.2, spd: 0.9 }], ['Снайперский', { spd: 1.4, spread: 0.4 }], ['Ёмкий', { ammo: 1.8 }]];
const WBASE = ['twin', 'mg', 'shotgun', 'flame', 'rocket', 'ricochet', 'laser', 'rail', 'emp', 'heavy', 'mortar', 'salvo', 'homing', 'cannon'];
export const WEAPON_VARS = []; for (const w of WBASE) for (const [n, m] of AFF) WEAPON_VARS.push({ id: w + '_' + n, w, aff: n, m });
const P = (name, fx, pb) => ({ name, fx, pb });
export const SPARES = [P('Гусеничные траки', { speed: 1.04 }, 4), P('Ведущее колесо', { acc: 1.12 }, 4), P('Ствол-запаска', { spread: 0.85 }, 2), P('Казённик', { rel: 0.95 }, 2), P('Прицел-блок', { bspd: 1.08 }, 2), P('Масляный радиатор', { regen: 0.4 }, 8), P('Двигатель-блок', { speed: 1.06 }, 8), P('Топливный насос', { acc: 1.08, speed: 1.02 }, 8), P('Погон башни', { rel: 0.97, spread: 0.9 }, 1), P('Привод башни', { turn: 1.25 }, 1),
  P('Бронелист', { arm: 1.06 }, 16), P('Катки', { speed: 1.03, acc: 1.05 }, 4), P('Торсионы', { acc: 1.1 }, 4), P('Аккумулятор', { empImm: 1 }, 8), P('Огнеупорная обшивка', { burnImm: 1 }, 16), P('Гидравлика', { rel: 0.96 }, 2), P('Генератор', { regen: 0.6 }, 8), P('Фильтр', { smokeSee: 1 }, 8), P('Ленивец', { speed: 1.05 }, 4), P('Рация', { radar: 1 }, 16)];
export const PERKS = [P('Вампир', { leech: 0.12 }), P('Шипы', { thorns: 0.15 }), P('Бережливый', { ammoSave: 0.25 }), P('Регенерация', { regen: 1 }), P('Берсерк', { berserk: 1 }), P('Снайпер', { bspd: 1.15, spread: 0.7 }), P('Спринтер', { speed: 1.1 }), P('Танк', { arm: 1.12, speed: 0.95 }), P('Стрелок', { rel: 0.9 }), P('Подрывник', { splashDmg: 1.25 }),
  P('Охотник', { killHeal: 25 }), P('Призрак', { stealth: 1 }), P('Пиротехник', { burnImm: 1, burnDmg: 1.5 }), P('Электрик', { empImm: 1 }), P('Стальная воля', { critRes: 1 }), P('Мародёр', { lootR: 1.6 }), P('Адреналин', { lowHpRel: 0.7 }), P('Сапёр', { mineImm: 1 }), P('Щитоносец', { shieldKill: 30 }), P('Разгон', { acc: 1.25 }),
  P('Точность', { spread: 0.55 }), P('Пробой', { pierceC: 0.15 }), P('Крит', { crit: 0.12 }), P('Добивание', { exec: 1.3 }), P('Тяжёлая рука', { dmg: 1.08 }), P('Ракетчик', { rocketDmg: 1.3 }), P('Минёр', { mineDmg: 1.4 }), P('Медик', { medBoost: 1.5 }), P('Барьер', { shieldRegen: 1 }), P('Осторожный', { rearArm: 0.6 })];
export const MODS2 = [P('Мод: дульный тормоз', { spread: 0.8, rel: 1.03 }), P('Мод: удлинённый ствол', { bspd: 1.2 }), P('Мод: автомат заряжания', { rel: 0.88 }), P('Мод: усиленный заряд', { dmg: 1.12, rel: 1.05 }), P('Мод: турбина', { speed: 1.07 }), P('Мод: нитро-впрыск', { acc: 1.3 }), P('Мод: композит', { arm: 1.08 }), P('Мод: динамзащита', { splashRes: 0.7 }), P('Мод: экраны', { rearArm: 0.7 }), P('Мод: тепловизор', { smokeSee: 1 }),
  P('Мод: глушитель', { stealth: 1 }), P('Мод: стабилизатор', { moveSpread: 0.5 }), P('Мод: магазин', { ammo: 1.5 }), P('Мод: термокожух', { burnImm: 1 }), P('Мод: клетка Фарадея', { empImm: 1 }), P('Мод: сервоприводы', { turn: 1.4 }), P('Мод: ремкомплект', { regen: 0.5 }), P('Мод: трофейная система', { lootR: 1.4 }), P('Мод: кумулятивный экран', { arm: 1.04, splashRes: 0.85 }), P('Мод: форсаж', { speed: 1.04, acc: 1.1 })];
// unified catalogue: [cat, idx, name, col, rarity 1..5]
const RAR = (i, n) => 1 + Math.min(4, Math.floor((i * 7919 % n) / n * 5 * 0.999));
export const LOOTX = [];
SHELLS.forEach((s, i) => { if (i && !s.crate) LOOTX.push({ cat: 'shell', i, name: 'Снаряды: ' + s.name, col: s.col, r: i < 10 ? 1 + (i % 3) : 2 + (i % 3), g: s.short }); });
ROCKETS.forEach((s, i) => { if (i >= ROCKETS.length - 3) s.myth = 1; else if (i >= ROCKETS.length - 8) s.leg = 1; LOOTX.push({ cat: 'rocket', i, name: 'Ракета: ' + s.name, col: s.myth ? '#ff3b6b' : s.col, r: s.myth ? 5 : s.leg ? 4 : i === 0 ? 3 : 2 + (i % 3), g: 'Р', info: s.myth ? 'Мифическая · +20% урона' : s.leg ? 'Легендарная · +10% урона' : undefined }); });
MINES.forEach((s, i) => LOOTX.push({ cat: 'mine', i, name: 'Мина: ' + s.name, col: s.col, r: 1 + (i % 3), g: 'М' }));
WEAPON_VARS.forEach((s, i) => LOOTX.push({ cat: 'wvar', i, name: s.aff + ' · ' + s.w, col: '#ffd23d', r: RAR(i, WEAPON_VARS.length), g: 'О' }));
SPARES.forEach((s, i) => LOOTX.push({ cat: 'spare', i, name: 'Запчасть: ' + s.name, fx: s.fx, col: '#9fd8ff', r: 1 + (i % 3), g: 'З' }));
PERKS.forEach((s, i) => LOOTX.push({ cat: 'perk', i, name: 'Перк: ' + s.name, fx: s.fx, col: '#c77dff', r: 2 + (i % 4), g: 'П' }));
MODS2.forEach((s, i) => LOOTX.push({ cat: 'mod', i, name: s.name, fx: s.fx, col: '#6cff9a', r: 2 + (i % 3), g: 'Мд' }));
import { MGS, TURRETS, RAR_COL, mgInfo, turInfo } from './arms.js';
import { GMODS, GM_TIERS, gmInfo } from './gmods.js';
// r27: gameplay mods in the unified catalogue — every kind × tier × level 1–3 (mythic tier never drops on the floor)
GMODS.forEach(M => GM_TIERS.forEach(T => [1, 2, 3].forEach(lv => LOOTX.push({ cat: 'gmod', i: M.i, tier: T.id, lv, name: M.name + ' · ' + ['I', 'II', 'III'][lv - 1] + (T.id > 1 ? ' · ' + T.n : ''), info: T.n + ' · ' + gmInfo(M, T.id, lv), col: M.col, r: T.id === 5 ? 5 : T.id === 4 ? 4 : lv, g: M.g }))));
MGS.forEach((m, i) => LOOTX.push({ cat: 'mgt', i, name: 'Пулемёт: ' + m.name, info: mgInfo(m), col: RAR_COL[m.r], r: m.r + 1, g: 'П' }));
TURRETS.forEach((m, i) => LOOTX.push({ cat: 'tur', i, name: 'Башня: ' + m.name, info: turInfo(m), col: RAR_COL[m.r], r: m.r + 1, g: 'Б' }));
LOOTX.push({ cat: 'blocks', i: 0, name: 'Бетонные блоки', info: 'Укрытие 5×2 · Пули, пулемёты и снаряды не пробивают · Только ракеты разрушают', col: '#b9b4a8', r: 4, g: 'Бт' });
LOOTX.push({ cat: 'sentry', i: 0, name: 'Турель', info: 'Авто-турель · 400 патронов · Урон 1.4 · Темп 1333 · Дальность 175 · Прочность 70', col: '#4ff0ff', r: 4, g: 'Т' });

// r23: 2560 procedural common/legendary GEAR items (seeded, deterministic). Mythic never drops (real-money only, pre-match).
const G_SLOTS = [['Гусеницы', 'Гс', ['acc', 'speed']], ['Двигатель', 'Дв', ['speed', 'acc']], ['Бронеплита', 'Бп', ['arm', 'hp']], ['Ствол', 'Ст', ['bspd', 'dmg']], ['Прицел', 'Пр', ['spread', 'bspd']], ['Подвеска', 'Пд', ['acc', 'arm']], ['Трансмиссия', 'Тр', ['speed', 'rel']], ['Досылатель', 'Дс', ['rel', 'dmg']], ['Экран', 'Эк', ['arm', 'splashRes']], ['Башенный привод', 'Бв', ['turn', 'rel']], ['Корпус', 'Кп', ['hp', 'arm']]];
// r25: slots that change the tank's look on the fly (field of the model vis + value range)
const G_VIS = { 'Гусеницы': ['trk', 4], 'Корпус': ['hull', 6], 'Башенный привод': ['tur', 6], 'Ствол': ['bar', 5], 'Экран': ['kit', 5] };
const G_MAK = ['Сокол', 'Урал', 'Тайга', 'Вихрь', 'Гранит', 'Кобальт', 'Буран', 'Сапсан', 'Титан', 'Беркут', 'Ястреб', 'Шторм', 'Кедр', 'Аргон', 'Молот', 'Север'];
const G_MOD = ['М1', 'М2', 'М3', 'К', 'С', 'Д', 'Т-2', 'Т-4', 'ПРО', 'УС', 'ЛЕ', 'ТС', 'Х', 'Р-7', 'НВ', 'ГМ'];
export const GEAR = [];
const gh = (a) => { a = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b); a ^= a >>> 13; a = Math.imul(a, 0xc2b2ae35); return ((a ^ (a >>> 16)) >>> 0) / 4294967296; };
G_SLOTS.forEach(([sn, g, keys], si) => G_MAK.forEach((mk, mi) => G_MOD.forEach((md, di) => {
  const id = si * 256 + mi * 16 + di, q = gh(id + 1), r = q < 0.42 ? 1 : q < 0.7 ? 2 : q < 0.9 ? 3 : 4, lv = 1 + (di % 3), k = [0, 0.04, 0.07, 0.1, 0.15][r] * (0.75 + 0.5 * gh(id + 77)) * [1, 1.3, 1.6][lv - 1]; // r25: level 1–3 (separate from tier)
  const fx = {}, k2 = k * (0.35 + 0.4 * gh(id + 9));
  const put = (key, m) => { if (key === 'hp') fx.hp = Math.round(m * 1200 + id % 10) / 10; else if (key === 'spread' || key === 'splashRes') fx[key] = +(1 - m).toFixed(4); else if (key === 'rel') fx.rel = +(1 - m).toFixed(4); else fx[key] = +(1 + m).toFixed(4); };
  put(keys[0], k); put(keys[1], k2 + id * 1e-6);
  const VS = G_VIS[sn]; GEAR.push({ slot: si, sn, lv, vis: VS ? { [VS[0]]: (mi + di * 3) % VS[1] } : null, name: sn + ' «' + mk + '-' + md + '»', fx, r, g, hue: (mi * 22 + di * 7 + si * 3) % 360, pat: (di + si) % 10 });
})));
// r25: MYTHIC parts — real-money shop only (permanent IAP) / battle-pass top tier / mythic bots. 3 per slot, distinct look, +20% over the best legendary lv-3 part
export const MYTH_GEAR = []; const M_NAMES = ['Титан', 'Феникс', 'Фантом'];
G_SLOTS.forEach(([sn, g, keys], si) => M_NAMES.forEach((mn, k) => { const id = 9000 + si * 3 + k, m = 0.15 * 1.25 * 1.6 * 1.2, fx = {};
  const put = (key, v) => { if (key === 'hp') fx.hp = Math.round(v * 1200) / 10; else if (key === 'spread' || key === 'splashRes' || key === 'rel') fx[key] = +(1 - v).toFixed(4); else fx[key] = +(1 + v).toFixed(4); };
  put(keys[0], m); put(keys[1], m * 0.6); const VS = G_VIS[sn]; const i = GEAR.length;
  GEAR.push({ slot: si, sn, lv: 3, myth: 1, vis: VS ? { [VS[0]]: (k * 2 + 1 + si) % VS[1] } : null, name: sn + ' «' + mn + '» · миф', fx, r: 5, g, hue: [48, 300, 190][k], pat: k }); MYTH_GEAR.push(i); }));
GEAR.forEach((G, i) => LOOTX.push({ cat: 'gear', i, name: G.name, fx: G.fx, col: 'hsl(' + G.hue + ',70%,62%)', r: G.r, g: G.g, pat: G.pat, lv: G.lv, info: (G.r >= 5 ? 'Мифический' : G.r >= 4 ? 'Легендарный' : 'Обычный') + ' · Ур. ' + G.lv + ' · ' + G.sn + (G.vis ? ' · меняет вид танка' : '') }));
export const LOOT_COUNTS = { shells: SHELLS.length, rockets: ROCKETS.length, mines: MINES.length, weapons: WEAPON_VARS.length, spares: SPARES.length, perks: PERKS.length, mods: MODS2.length, mgs: MGS.length, turrets: TURRETS.length, gear: GEAR.length, total: LOOTX.length };
const RW = [0, 50, 28, 14, 6, 0]; // r23: mythic (r5) weight 0 — never on the map // rarity weights
// r37: 150 field mods («Полевые моды») — the ONLY tank modifications found on the map. Common tier only (no legendary/mythic
// on the floor), each +2…5% to ONE stat, they stack (with caps) and last for the current battle only.
export const FM_STATS = [['hp', 'Бронелист', 'прочности', '#8fd46a'], ['speed', 'Мотор', 'скорости', '#ffd23d'], ['dmg', 'Ствол', 'урона', '#ff7a5a'], ['rel', 'Досылатель', 'к перезарядке', '#ff9f3d'], ['arm', 'Экран', 'брони', '#7fd8ff'],
  ['acc', 'Трансмиссия', 'разгона', '#c6ff6a'], ['bspd', 'Пороховой заряд', 'скорости снаряда', '#ffb0e0'], ['spread', 'Прицел', 'точности', '#b0c8ff'], ['turn', 'Поворотный механизм', 'поворота башни', '#d8a8ff'], ['splashRes', 'Подбой', 'защиты от взрывов', '#ffcf8a']];
const FM_BR = ['«Ураган»', '«Сталь»', '«Кедр»', '«Буран»', '«Гроза»', '«Тайга»', '«Волна»', '«Искра»', '«Пик»', '«Клинок»', '«Ястреб»', '«Молот»', '«Север»', '«Рысь»', '«Вихрь»'];
export const FMODS = []; FM_BR.forEach((b, bi) => FM_STATS.forEach(([k, part, what, col], si) => { const v = 2 + ((bi * 3 + si * 7) % 4); FMODS.push({ k, v, col, name: part + ' ' + b + ' · +' + v + '% ' + what }); }));
export const FM_FIRST = LOOTX.length; FMODS.forEach((M, i) => LOOTX.push({ cat: 'fmod', i, name: M.name, col: M.col, r: 1, g: '+' + M.v + '%', info: 'Обычный · только этот бой' }));
export function rollFmod(rnd) { return FM_FIRST + Math.floor(rnd() * FMODS.length); }
export function fmodFx(M) { const v = M.v / 100; return M.k === 'rel' || M.k === 'spread' || M.k === 'splashRes' ? { [M.k]: 1 - v } : { [M.k]: 1 + v }; }
let CUM = null; export function rollLootX(rnd) { if (!CUM) { let s = 0; CUM = LOOTX.map(o => (s += RW[o.r] * (o.cat === 'rocket' && o.i ? 0.45 : o.cat === 'mgt' || o.cat === 'tur' ? 0.2 : o.cat === 'sentry' || o.cat === 'blocks' ? 0.6 : o.cat === 'gear' || o.cat === 'gmod' || o.cat === 'mod' || o.cat === 'spare' || o.cat === 'perk' ? 0 /* r37: on the map only common field mods */ : o.cat === 'fmod' ? 0.25 : 1))); /* r19: special rockets are rarer (homing pack unchanged) */ } const v = rnd() * CUM[CUM.length - 1]; let lo = 0, hi = CUM.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (CUM[m] < v) lo = m + 1; else hi = m; } return lo; }
// r19: damage-type tags + numeric damage for every shell / rocket (shown in the shell panel, inventory and pickup labels)
const DT = [['hm', 'Самонаведение'], ['arc', 'Навесная'], ['vsArm', 'Бронебойный'], ['splash', 'Фугасный'], ['burn', 'Огонь'], ['emp', 'ЭМИ'], ['freeze', 'Холод'], ['acid', 'Кислота'], ['chain', 'Электро'], ['pull', 'Гравитация'], ['knock', 'Отброс'], ['cluster', 'Кассета'], ['smoke', 'Дым'], ['reveal', 'Подсветка'], ['bounce', 'Рикошет'], ['pierce', 'Пробитие'], ['homing', 'Наведение'], ['guide', 'Наведение'], ['brick', 'Против стен'], ['pbreak', 'Ломает модули'], ['aa', 'ПВО'], ['mines', 'Мины'], ['count', 'Дробь']];
export const dmgTags = (o) => DT.filter(([k]) => o[k]).map(([, v]) => v).filter((v, i, a) => a.indexOf(v) === i);
export const shellDmg = (s, base = 34) => Math.round(base * s.dmg); // vs the base cannon round
export const rocketDmg = (r) => r.homing ? null : r.dmg;
export const rocketRange = (r) => Math.round(240 * (r.spd || 1) * (r.rng || 1.8));
export function ammoInfo(o, rocket, base) { const d = rocket ? rocketDmg(o) : shellDmg(o, base), tg = dmgTags(o); return (d == null ? 'Урон 1/15 HP' : 'Урон ' + d) + (rocket ? ' · Дальность ' + rocketRange(o) : '') + (tg.length ? ' · ' + tg.join(' · ') : ''); }
// r19: readable stat deltas for parts / perks / mods (shown before pickup / install)
const FXN = { speed: ['Скорость', 1], acc: ['Разгон', 1], rel: ['Перезарядка', -1], dmg: ['Урон', 1], arm: ['Броня', 1], bspd: ['Скорость снаряда', 1], spread: ['Разброс', -1], moveSpread: ['Разброс в движении', -1], turn: ['Поворот башни', 1], splashRes: ['Урон от взрывов', -1], rearArm: ['Урон в корму', -1], lootR: ['Радиус сбора', 1], ammo: ['Боезапас', 1], medBoost: ['Лечение', 1], splashDmg: ['Урон взрывом', 1], rocketDmg: ['Урон ракет', 1], mineDmg: ['Урон мин', 1], burnDmg: ['Урон огнём', 1], exec: ['Добивание', 1], lowHpRel: ['Перезарядка при низком HP', -1] };
const FXB = { regen: 'Регенерация', stealth: 'Скрытность', smokeSee: 'Видит сквозь дым', empImm: 'Иммунитет к ЭМИ', burnImm: 'Иммунитет к огню', radar: 'Радар', mineImm: 'Иммунитет к минам', critRes: 'Защита от критов', leech: 'Вампиризм', thorns: 'Шипы', ammoSave: 'Экономия боезапаса', killHeal: 'Лечение за убийство', shieldKill: 'Щит за убийство', shieldRegen: 'Восстановление щита', berserk: 'Берсерк', crit: 'Шанс крита', pierceC: 'Шанс пробития' };
export function fxText(fx) { const o = []; for (const k in fx) { const v = fx[k]; if (FXN[k]) { const p = Math.round((v - 1) * 100); o.push(FXN[k][0] + ' ' + (p > 0 ? '+' : '−') + Math.abs(p) + '%'); } else if (FXB[k]) o.push(v < 1 && v > 0 ? FXB[k] + ' +' + Math.round(v * 100) + '%' : v > 1 ? FXB[k] + ' +' + v : FXB[k]); } return o.join(', '); }

// r25: gear has its own drop slot (taken from the armour share), so shell/ammo packs keep their pre-gear frequency
let GCUM = null; export function rollGear(rnd) { if (!GCUM) { let s = 0; GCUM = LOOTX.map(o => (s += o.cat === 'gear' ? RW[o.r] : 0)); } const v = rnd() * GCUM[GCUM.length - 1]; let lo = 0, hi = GCUM.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (GCUM[m] > v) hi = m; else lo = m + 1; } return lo; }
