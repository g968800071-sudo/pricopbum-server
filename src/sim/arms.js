// r20: 50 machine-gun types + 50 turret types. Deterministic, data-driven, every entry distinct.
// rarity: 0 common, 1 rare, 2 epic, 3 legendary, 4 mythic
const FXN = { trc: 'Трассер', inc: 'Огонь', apds: 'Бронебойный', emp: 'ЭМИ', frz: 'Холод', acd: 'Кислота', elc: 'Цепная молния', shk: 'Оглушение', ric: 'Рикошет', pho: 'Разведка', mag: 'Притяжение', crs: 'Пробой модулей', flt: 'Отбрасывание', cbr: 'Кумулятивный', ap: 'Бронебойный' };
export const RAR = ['Обычный', 'Редкий', 'Эпический', 'Легендарный', 'Мифический'];
export const RAR_COL = ['#c8c8c8', '#6fb6ff', '#c58bff', '#ffb43a', '#ff5a7a'];
const rarOf = (i) => i < 25 ? 0 : i < 35 ? 1 : i < 43 ? 2 : i < 48 ? 3 : 4;
const MGW = ['Шквал', 'Град', 'Вихрь', 'Гром', 'Буря', 'Оса', 'Шершень', 'Кобра', 'Гадюка', 'Ястреб', 'Сокол', 'Беркут', 'Рысь', 'Волк', 'Медведь', 'Барс', 'Кречет', 'Тайфун', 'Смерч', 'Пурга', 'Молот', 'Клинок', 'Жало', 'Искра', 'Комета'];
const MG_FX = [null, 'trc', 'inc', 'apds', 'emp', 'frz', 'acd', 'elc', 'shk', 'ric', 'pho', 'mag', 'crs', 'flt', 'cbr', 'ap'];
export const MG_CAP = [150, 150, 150, 300, 500];
export const MGS = Array.from({ length: 50 }, (_, i) => {
  const r = rarOf(i), k = (i * 7) % 50 / 50, q = (i * 13) % 17 / 17;
  const dmg = +(7 + k * 2.2 + (i % 3) * 0.11).toFixed(2), reload = +(0.055 + q * 0.1 + (i % 4) * 0.004).toFixed(3);
  const burst = 1 + (i % 5 === 0 ? 0 : (i * 3) % 5), spread = +(0.03 + ((i * 11) % 23) / 23 * 0.11 - r * 0.006).toFixed(3);
  const life = +(0.45 + ((i * 17) % 29) / 29 * 0.45 + r * 0.04).toFixed(3), speed = 340 + ((i * 19) % 9) * 15;
  const fx = MG_FX[(i * 5 + r) % MG_FX.length];
  return { id: 'mg' + i, i, r, name: MGW[i % 25] + ' ' + (i < 25 ? 7 + (i % 5) : 12 + (i % 7) * 2), dmg, reload, burst, spread, life, speed, fx, slots: [1, 2, 3, 3, 4][r], cap: MG_CAP[r], sim: r >= 3, range: Math.round(speed * life) };
});
// main-gun turrets: caliber, damage multiplier by rarity (capped: mythic at most +25%), range, reload (bigger caliber is slower), distinct look
const TW = ['Бастион', 'Цитадель', 'Редут', 'Форт', 'Таран', 'Щит', 'Утёс', 'Скала', 'Гранит', 'Базальт', 'Кремень', 'Обсидиан', 'Сталь', 'Титан', 'Вольфрам', 'Колосс', 'Атлант', 'Голиаф', 'Самсон', 'Циклоп', 'Мамонт', 'Носорог', 'Бизон', 'Зубр', 'Тур'];
const DMG_R = [[0.97, 1.03], [0.97, 1.03], [0.97, 1.03], [0.97, 1.03], [0.97, 1.03]]; // r20: mythic base = legendary; the user-set mythic bonus (+20% dmg) is applied by the sim (MYTH_K), off in «Равные условия»
export const MYTH_K = 1.2, MYTH_HP = 1.2, RAR_K = [1, 1, 1, 1.1, 1.2]; // user-set: common baseline, legendary +10%, mythic +20% (HP for tanks, damage for MG/turret/rocket)
export const TURRETS = Array.from({ length: 50 }, (_, i) => {
  const r = rarOf(i), [lo, hi] = DMG_R[r], n = r === 0 ? 25 : r === 1 ? 10 : r === 2 ? 8 : r === 3 ? 5 : 2, j = i - [0, 25, 35, 43, 48][r];
  const dmg = +(lo + (hi - lo) * (n > 1 ? ((j * 7) % n) / (n - 1) : 1)).toFixed(3);
  const cal = 37 + ((i * 29) % 50) * 2 + r * 3, rel = +(0.78 + (cal - 37) / 115 * 0.45).toFixed(3), rng = +(0.85 + ((i * 23) % 41) / 41 * 0.4).toFixed(3);
  const look = { shape: i % 5, s: +(0.88 + ((i * 3) % 11) * 0.025).toFixed(3), h: +(0.85 + ((i * 7) % 9) * 0.05).toFixed(3), bl: +(0.85 + rng * 0.3).toFixed(3), br: +(0.7 + (cal - 37) / 115 * 0.7).toFixed(3), mz: (i * 3) % 4, tint: ((i * 37) % 60 - 30) / 300 };
  return { id: 't' + i, i, r, name: TW[i % 25] + ' ' + (i < 25 ? 'I' : 'II').length + cal, cal, dmg, rel, rng, look };
});
TURRETS.forEach(T => { T.name = TW[T.i % 25] + ' ' + T.cal; });
const pct = (v) => (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%';
export const mgInfo = (M) => RAR[M.r] + ' · Урон ' + +(M.dmg * RAR_K[M.r]).toFixed(2) + (M.r >= 3 ? ' (+' + Math.round((RAR_K[M.r] - 1) * 100) + '%)' : '') + ' · Дальность ' + M.range + ' · Темп ' + Math.round(60 / M.reload) + ' · Очередь ' + M.burst + ' · Разброс ' + Math.round(M.spread * 100) + ' · Магазин ' + M.cap + ' · Слоты ' + M.slots + (M.fx ? ' · ' + (FXN[M.fx] || M.fx) : '') + (M.sim ? ' · Одновременно с пушкой' : '');
export const turInfo = (T) => RAR[T.r] + ' · Калибр ' + T.cal + ' мм · Урон ' + pct(T.dmg * RAR_K[T.r]) + ' · Дальность ' + pct(T.rng) + ' · Перезарядка ' + pct(T.rel);
