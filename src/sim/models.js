// r15: 108 procedural tank models (9 classes x 12). Deterministic from the index: hull, turret, barrel, tracks,
// armour kit, decal and paint scheme are independent axes, so every model has a different silhouette, not just a recolour.
// Stat multipliers stay within ±15% for fairness.
export const CLASSES = [
  { id: 'light', name: 'Лёгкий', hp: 0.88, spd: 1.13, arm: 0.92, rel: 0.95 },
  { id: 'medium', name: 'Средний', hp: 1, spd: 1, arm: 1, rel: 1 },
  { id: 'heavy', name: 'Тяжёлый', hp: 1.14, spd: 0.87, arm: 1.1, rel: 1.08 },
  { id: 'rocket', name: 'Ракетный', hp: 0.95, spd: 0.98, arm: 0.95, rel: 0.92 },
  { id: 'arty', name: 'Артиллерия', hp: 0.9, spd: 0.9, arm: 0.92, rel: 1.12 },
  { id: 'scout', name: 'Разведчик', hp: 0.86, spd: 1.15, arm: 0.9, rel: 1 },
  { id: 'assault', name: 'Штурмовой', hp: 1.06, spd: 1.02, arm: 1.04, rel: 0.96 },
  { id: 'defender', name: 'Защитник', hp: 1.12, spd: 0.9, arm: 1.13, rel: 1.04 },
  { id: 'special', name: 'Особый', hp: 1.04, spd: 1.04, arm: 1.02, rel: 0.97 },
];
export const RARITIES = [
  { id: 0, name: 'обычный', color: '#b8c4cf' }, { id: 1, name: 'редкий', color: '#4fa8ff' }, { id: 2, name: 'эпический', color: '#b46bff' },
  { id: 3, name: 'легендарный', color: '#ffb02e' }, { id: 4, name: 'мифический', color: '#ff4d7a' },
];
const ROOTS = [['Ястреб', 'Стриж', 'Сокол', 'Кречет', 'Чиж', 'Пустельга', 'Ласка', 'Рысь', 'Вихрь', 'Сапсан', 'Колибри', 'Искра'],
  ['Гроза', 'Витязь', 'Ратник', 'Буран', 'Сармат', 'Кедр', 'Тайфун', 'Вепрь', 'Беркут', 'Ураган', 'Степняк', 'Гранит'],
  ['Бастион', 'Мамонт', 'Цитадель', 'Голиаф', 'Утёс', 'Монолит', 'Зубр', 'Титан', 'Колосс', 'Курган', 'Глыба', 'Твердыня'],
  ['Смерч', 'Град', 'Торнадо', 'Комета', 'Метеор', 'Пламя', 'Факел', 'Болид', 'Протон', 'Сполох', 'Зарница', 'Импульс'],
  ['Гиацинт', 'Пион', 'Тюльпан', 'Мста', 'Акация', 'Гвоздика', 'Нона', 'Мортира', 'Каронада', 'Бомбарда', 'Гаубица', 'Кулеврина'],
  ['Призрак', 'Тень', 'Филин', 'Лис', 'Сумрак', 'Мираж', 'Шорох', 'Следопыт', 'Дозор', 'Ветер', 'Нерпа', 'Сыч'],
  ['Таран', 'Молот', 'Клинок', 'Кистень', 'Булава', 'Секира', 'Штурм', 'Натиск', 'Рубака', 'Буйвол', 'Медведь', 'Варяг'],
  ['Щит', 'Страж', 'Оплот', 'Рубеж', 'Заслон', 'Броненосец', 'Черепаха', 'Форпост', 'Редут', 'Вал', 'Кремль', 'Застава'],
  ['Феникс', 'Левиафан', 'Химера', 'Василиск', 'Дракон', 'Кракен', 'Церберус', 'Грифон', 'Перун', 'Сварог', 'Велес', 'Аврора']];
const SUF = ['', '-М', ' Т-9', '-2', ' МК', '-Э', ' Д-4', '-К', ' Т-12', '-С', ' Б-7', '-Х'];
const PAL = [['#6b7a3a', '#4b5628'], ['#a8915c', '#7d6a3f'], ['#5b6670', '#3c444b'], ['#3f5b3a', '#2a3d27'], ['#8a8f96', '#5e636a'], ['#2f3a4a', '#1f2733'],
  ['#7a4a2e', '#55321e'], ['#c9c3b0', '#9b9583'], ['#3b4f63', '#283646'], ['#4a3b5c', '#30263d'], ['#8c2f2f', '#5e1f1f'], ['#1e1e22', '#0f0f12'],
  ['#c7a12f', '#8e721f'], ['#2fa0a0', '#1f6e6e'], ['#e8e8ee', '#b0b0b8'], ['#5a2a7a', '#3a1a52']];
function rnd(seed) { let s = seed * 2654435761 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export const MODELS = [];
for (let c = 0; c < 9; c++) for (let k = 0; k < 12; k++) {
  const i = c * 12 + k, r = rnd(i + 7), C = CLASSES[c];
  const rar = c === 8 ? (k < 4 ? 3 : k < 9 ? 3 + (k % 2) : 4) : k < 4 ? 0 : k < 7 ? 1 : k < 10 ? 2 : k < 11 ? 3 : 4;
  const j = () => 1 + (r() - 0.5) * 0.06; // ±3% per-model spice on top of the class
  const cl = (v) => Math.max(0.85, Math.min(1.15, +v.toFixed(3)));
  const pal = PAL[(i * 5 + c) % PAL.length];
  MODELS.push({ id: i, name: '«' + ROOTS[c][k] + SUF[(k * 7 + c) % SUF.length] + '»', cls: C.id, ci: c, rar,
    hp: cl(C.hp * j()), spd: cl(C.spd * j()), arm: cl(C.arm * j()), rel: cl(C.rel * j()),
    // visual axes (6 hulls x 6 turrets x 5 barrels x 4 tracks x 5 kits x 6 decals, combined with the class silhouette)
    hull: (k + c * 2) % 6, tur: (k * 5 + c) % 6, bar: c === 3 ? 3 : c === 4 ? 4 : (k + c) % 3, trk: (k * 3 + c) % 4, kit: (k + c * 3) % 5, dec: (k * 7 + c * 2) % 6,
    c1: pal[0], c2: pal[1], acc: RARITIES[rar].color, camo: r() < 0.5,
    // unlocks: 10 free starters, the rest by level, coins, missions or IAP (stub)
    unlock: null });
}
// r25: second series «Mk II» → 200 distinct models: new palette, re-mixed hull/turret/barrel/tracks/kit/decal axes, ±4% stat spice (same class caps)
for (let n = 0; MODELS.length < 200; n++) { const B = MODELS[(n * 7) % 108], r = rnd(1000 + n), pal = PAL[(n * 3 + 5) % PAL.length], cl = (v) => Math.max(0.85, Math.min(1.15, +v.toFixed(3))), j = () => 1 + (r() - 0.5) * 0.08, id = MODELS.length;
  MODELS.push({ ...B, id, name: B.name.replace('»', ' II»'), rar: Math.min(4, B.rar), hp: cl(B.hp * j()), spd: cl(B.spd * j()), arm: cl(B.arm * j()), rel: cl(B.rel * j()),
    hull: (B.hull + 1 + (n % 5)) % 6, tur: (B.tur + 2 + (n % 4)) % 6, bar: B.ci === 3 || B.ci === 4 ? B.bar : (B.bar + 1 + (n % 2)) % 3, trk: (B.trk + 1 + (n % 3)) % 4, kit: (B.kit + 1 + (n % 4)) % 5, dec: (B.dec + 3) % 6, c1: pal[0], c2: pal[1], camo: !B.camo, unlock: null }); }
const FREE = [0, 1, 12, 13, 24, 36, 48, 60, 72, 84];
for (const m of MODELS) {
  if (FREE.includes(m.id)) m.unlock = { t: 'free' };
  else if (m.rar === 4) m.unlock = { t: 'iap', iap: 'tank_' + m.id, price: '449 ₽' }; // мифический: только за реальные деньги
  else if (m.rar === 3) m.unlock = { t: 'box', iap: 'tank_' + m.id, price: '199 ₽' }; // легендарный: только ящики или реальные деньги
  else if (m.id % 3 === 0) m.unlock = { t: 'level', lv: 2 + (m.id % 24) };
  else m.unlock = { t: 'coins', price: 400 + m.rar * 600 + (m.id % 5) * 100 };
}
export const MODEL_COUNT = MODELS.length;
export const modelOf = (id) => MODELS[id | 0] || MODELS[0];

// ---------- r15: tank constructor («Конструктор BR») ----------
// A build is [hull, turret, weapon, tracks, engine, armour, paint, camo, decal]. Every part costs points; the total must fit
// the budget, and the resulting multipliers are clamped to ±15% so builds stay fair. The server re-validates the same way.
export const BUDGET = 120;
export const C_HULL = [
  { n: 'Лёгкий корпус', c: 10, hp: 0.9, spd: 1.08, v: 0 }, { n: 'Клиновидный', c: 16, hp: 0.97, spd: 1.04, v: 1 }, { n: 'Средний', c: 20, hp: 1, spd: 1, v: 2 },
  { n: 'Угловатый', c: 24, hp: 1.05, spd: 0.97, v: 3 }, { n: 'Тяжёлый', c: 30, hp: 1.12, spd: 0.9, v: 4 }, { n: 'Крепость', c: 34, hp: 1.15, spd: 0.86, v: 5 }];
export const C_TUR = [
  { n: 'Круглая', c: 6, rel: 1, arm: 1 }, { n: 'Шестигранная', c: 10, rel: 0.97, arm: 1.03 }, { n: 'Клиновая', c: 12, rel: 0.95, arm: 1.02 },
  { n: 'Коробчатая', c: 12, rel: 1, arm: 1.07 }, { n: 'С нишей', c: 16, rel: 0.92, arm: 1.03 }, { n: 'Купол', c: 14, rel: 0.98, arm: 1.08 }];
export const C_WPN = [['cannon', 8], ['twin', 14], ['mg', 12], ['shotgun', 14], ['flame', 14], ['laser', 18], ['ricochet', 16], ['rail', 22], ['rocket', 18], ['emp', 20]];
export const C_TRK = [{ n: 'Узкие', c: 4, spd: 1.03, hp: 0.98 }, { n: 'Стандартные', c: 8, spd: 1, hp: 1 }, { n: 'Широкие', c: 10, spd: 0.97, hp: 1.04 }, { n: 'Скоростные', c: 14, spd: 1.07, hp: 0.98 }];
export const C_ENG = [{ n: 'Дизель 600', c: 4, spd: 0.94 }, { n: 'Дизель 900', c: 10, spd: 1 }, { n: 'Турбина 1200', c: 16, spd: 1.06 }, { n: 'Гибрид 1500', c: 22, spd: 1.1 }];
export const C_ARM = [{ n: 'Без экрана', c: 0, k: -1, arm: 0.96 }, { n: 'Противоракетная', c: 12, k: 1, arm: 1 }, { n: 'Рикошетная', c: 14, k: 2, arm: 1 }, { n: 'Регенерирующая', c: 16, k: 3, arm: 1 },
  { n: 'Противоминная', c: 8, k: 4, arm: 1 }, { n: 'Огнеупорная', c: 10, k: 5, arm: 1 }, { n: 'Экранированная', c: 12, k: 6, arm: 1 }];
export const C_PAINT = PAL.map((p, i) => ({ n: 'Окраска ' + (i + 1), c1: p[0], c2: p[1] }));
export const C_DEC = ['Нет', 'Звезда', 'Полосы', 'Номер', 'Шеврон', 'Круг', 'Молния'];
export const DEFAULT_BUILD = [2, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0];
// r16 extra weapon mounts: build[9..11]. Mount count depends on the hull; every extra gun adds weight (speed + acceleration
// penalty), uses its own ammo pool, and the total extra DPS is capped (each extra fires at reduced damage).
export const C_MOUNT = [{ n: 'Нет', c: 0, wt: 0 }, { n: 'Спаренный пулемёт', w: 'mg', c: 6, wt: 0.12, pos: 'coax' }, { n: 'Второй ствол', w: 'twin', c: 10, wt: 0.15, pos: 'side' },
  { n: 'Ракетный блок', w: 'rocket', c: 12, wt: 0.18, pos: 'pod' }, { n: 'Кормовое орудие', w: 'cannon', c: 10, wt: 0.16, pos: 'rear' }, { n: 'Тяжёлое орудие', w: 'heavy', c: 14, wt: 0.2, pos: 'side' }];
export const HULL_MOUNTS = [1, 2, 2, 3, 4, 4]; // total guns incl. the main turret gun
export const EXTRA_DPS_CAP = 0.6; // all extra guns together add at most +60% of the main gun's damage per volley
const LIM = [C_HULL.length, C_TUR.length, C_WPN.length, C_TRK.length, C_ENG.length, C_ARM.length, C_PAINT.length, 2, C_DEC.length, C_MOUNT.length, C_MOUNT.length, C_MOUNT.length];
export const normBuild = (b) => Array.isArray(b) && b.length === 9 ? b.concat([0, 0, 0]) : b;
export function buildCost(b) { b = normBuild(b); return C_HULL[b[0]].c + C_TUR[b[1]].c + C_WPN[b[2]][1] + C_TRK[b[3]].c + C_ENG[b[4]].c + C_ARM[b[5]].c + C_MOUNT[b[9]].c + C_MOUNT[b[10]].c + C_MOUNT[b[11]].c; }
export function buildValid(b) { b = normBuild(b); if (!(Array.isArray(b) && b.length === 12 && b.every((v, i) => Number.isInteger(v) && v >= 0 && v < LIM[i]) && buildCost(b) <= BUDGET)) return false; const ex = HULL_MOUNTS[b[0]] - 1; for (let i = 0; i < 3; i++) if (i >= ex && b[9 + i]) return false; return true; }
export function buildStats(b) {
  const H = C_HULL[b[0]], T = C_TUR[b[1]], R = C_TRK[b[3]], E = C_ENG[b[4]], A = C_ARM[b[5]], cl = (v) => Math.max(0.85, Math.min(1.15, +v.toFixed(3)));
  b = normBuild(b); const mounts = [], ms = [b[9], b[10], b[11]].filter(v => v > 0); let wk = 1; for (const v of ms) { wk *= 1 - C_MOUNT[v].wt; }
  const dk = ms.length ? Math.min(0.5, EXTRA_DPS_CAP / ms.length) : 0; for (const v of ms) mounts.push({ w: C_MOUNT[v].w, pos: C_MOUNT[v].pos, dk });
  return { hp: cl(H.hp * R.hp), spd: +(cl(H.spd * R.spd * E.spd) * wk).toFixed(3), acc: +wk.toFixed(3), arm: cl(T.arm * A.arm), rel: cl(T.rel), weapon: C_WPN[b[2]][0], ak: A.k, cost: buildCost(b), mounts, guns: 1 + ms.length };
}
// visual axes for the renderer (same shape as a catalogue model)
export function buildVis(b) { b = normBuild(b); const P = C_PAINT[b[6]]; return { mounts: [b[9], b[10], b[11]].filter(v => v > 0).map(v => C_MOUNT[v].pos + ':' + C_MOUNT[v].w), hue: b[12] || 0, hull: C_HULL[b[0]].v, tur: b[1], bar: C_WPN[b[2]][0] === 'rocket' ? 3 : b[0] >= 4 ? 2 : b[2] % 3, trk: b[3], kit: b[5] < 0 ? 0 : b[5] % 5, dec: b[8] ? b[8] - 1 : -1, c1: P.c1, c2: P.c2, camo: !!b[7], ci: b[0] >= 4 ? 2 : b[0] <= 1 ? 0 : 1, acc: '#ffd23d' }; }
export function randomBuild(rnd) { for (let k = 0; k < 80; k++) { const b = LIM.map(n => Math.floor(rnd() * n)); const ex = HULL_MOUNTS[b[0]] - 1; for (let i = 0; i < 3; i++) if (i >= ex || rnd() < 0.5) b[9 + i] = 0; if (buildValid(b)) return b; } return DEFAULT_BUILD.slice(); }
// r16: personality-matched bot builds; quality (budget actually spent) scales with difficulty
const PB = { aggressive: { hull: [3, 4, 5], wpn: [0, 1, 5, 8], trk: [1, 2], eng: [1, 2, 3], mnt: [2, 3, 4, 5], mntP: 0.85 }, flanker: { hull: [0, 1], wpn: [2, 3, 4, 1], trk: [3, 0], eng: [2, 3], mnt: [1], mntP: 0.3 },
  sniper: { hull: [1, 2, 3], wpn: [7, 5], trk: [1, 2], eng: [1, 2], mnt: [1], mntP: 0.3, scope: 1 }, medic: { hull: [2, 3], wpn: [0, 9, 6], trk: [1, 2], eng: [1, 2], arm: [3], mnt: [1, 4], mntP: 0.5 },
  looter: { hull: [1, 2], wpn: [0, 3, 6, 2], trk: [3, 1], eng: [2, 3], mnt: [1, 2], mntP: 0.4 }, coward: { hull: [4, 5, 3], wpn: [2, 4, 0], trk: [2], eng: [1, 2], arm: [6, 1, 2], mnt: [4, 1], mntP: 0.6 } };
export function personaBuild(pers, rnd, skill = 0.5) { const P = PB[pers] || PB.looter, pick = (a) => a[Math.floor(rnd() * a.length)], budget = Math.round(BUDGET * (0.72 + 0.28 * Math.min(1, skill + 0.1)));
  for (let k = 0; k < 60; k++) { const b = [pick(P.hull), Math.floor(rnd() * 6), pick(P.wpn), pick(P.trk), pick(P.eng), P.arm && rnd() < 0.7 ? pick(P.arm) : Math.floor(rnd() * C_ARM.length), Math.floor(rnd() * C_PAINT.length), rnd() < 0.4 ? 1 : 0, Math.floor(rnd() * C_DEC.length), 0, 0, 0];
    const ex = HULL_MOUNTS[b[0]] - 1; for (let i = 0; i < ex; i++) if (rnd() < P.mntP * (i ? 0.6 : 1)) b[9 + i] = pick(P.mnt);
    if (k > 30) { b[4] = Math.max(0, b[4] - 1); b[9 + 2] = 0; } if (k > 45) b[10] = 0; if (buildValid(b) && buildCost(b) <= budget + (k > 40 ? 30 : 0)) return b; } return randomBuild(rnd); }
// visual signature (what the eye can tell apart); hue = small per-tank tint index added on top of the paint / team colour
export const visSig = (b, hue = 0) => { b = normBuild(b); return [C_HULL[b[0]].v, b[1], b[2], b[3], b[5], b[6], b[7], b[8], b[9], b[10], b[11], hue].join('.'); };
export function visOf(t) { const b = visOf0(t); return t.visO ? { ...(b || MODELS[0]), ...t.visO } : b; } // r25: parts picked up in battle override the look
function visOf0(t) { return t.build ? buildVis(t.hue ? normBuild(t.build).slice(0, 12).concat([t.hue]) : t.build) : t.model != null && t.model >= 0 ? MODELS[t.model] : null; }
