// r27: gameplay mods — 32 kinds × 3 tiers (common / legendary / mythic) × levels 1–3. Each kind has a distinct mechanic,
// a colour + glyph shown on the tank plate and a visible hull overlay (spikes, blade, bubble, net…).
// fx keys reuse the sim's applyFx; new mechanics: aps, shB, ramDmg, ramRes, amph, jam, decoy, mineLay, ext, winch.
export const GM_TIERS = [{ id: 1, k: 1, n: 'Обычный' }, { id: 4, k: 1.6, n: 'Легендарный' }, { id: 5, k: 2.2, n: 'Мифический' }];
const L = (lv, t) => ({ 1: 1, 2: 1.5, 3: 2 }[lv]) * t; // strength = level × tier
// [id, name, desc, colour, glyph, fx(s)]  s = strength 1…4.4
export const GMODS = [
  ['reactive', 'Динамическая защита', 'Снижает урон от взрывов', '#ff8a3d', 'ДЗ', s => ({ splashRes: 1 - 0.07 * s })],
  ['spaced', 'Разнесённая броня', 'Меньше урона в борт и корму', '#c9b38a', 'РБ', s => ({ rearArm: 1 - 0.07 * s })],
  ['smoke', 'Дымовой мортир', 'Дополнительные дымовые шашки', '#d8d8d8', 'Дм', s => ({ smokesAdd: Math.round(s) })],
  ['thermal', 'Тепловизор', 'Видит сквозь дым; +дальность обзора', '#ff4f7a', 'ТВ', s => ({ smokeSee: 1, view: 0.04 * s })],
  ['rangef', 'Дальномер', 'Точнее и быстрее снаряд', '#7dd3ff', 'ДМ', s => ({ spread: 1 - 0.05 * s, bspd: 1 + 0.03 * s })],
  ['camo', 'Маскировочная сеть', 'Скрытность в кустах и на месте', '#6f8f3a', 'МС', s => ({ stealth: 1, camo: 0.1 * s })],
  ['aps', 'Активная защита', 'Перехватывает ракеты (заряды)', '#4ff0ff', 'АЗ', s => ({ aps: Math.max(1, Math.round(s)) })],
  ['nitro', 'Нитро', 'Резкий разгон', '#ff3bd0', 'Н2О', s => ({ acc: 1 + 0.08 * s })],
  ['turbo', 'Турбо-двигатель', 'Выше максимальная скорость', '#ffd23d', 'Тб', s => ({ speed: 1 + 0.025 * s })],
  ['wide', 'Широкие гусеницы', 'Быстрее по грязи и болоту, лучше поворот', '#8b7355', 'ШГ', s => ({ turn: 1 + 0.06 * s, mudRes: 0.1 * s })],
  ['amph', 'Амфибийный комплект', 'Быстрее по воде', '#3d8bff', 'Ам', s => ({ amph: 0.15 * s })],
  ['repair', 'Авторемонт', 'Медленно восстанавливает прочность', '#6cff9a', 'Рм', s => ({ regen: 0.18 * s })],
  ['ext', 'Огнетушитель', 'Тушит пожар быстрее, меньше урона огнём', '#ff5a3d', 'Ог', s => ({ ext: Math.min(0.8, 0.15 * s) })],
  ['ricochet', 'Рикошетные снаряды', 'Шанс крита', '#e8e8f0', 'Рк', s => ({ crit: 0.025 * s })],
  ['heat', 'Кумулятивные (HEAT)', '+урон по бронированным', '#ffb347', 'КС', s => ({ dmg: 1 + 0.025 * s })],
  ['apfsds', 'Подкалиберные (APFSDS)', 'Пробой и скорость снаряда', '#b0c4de', 'БПС', s => ({ pierceC: 0.04 * s, bspd: 1 + 0.03 * s })],
  ['he', 'Фугасные (HE)', 'Сильнее взрыв', '#ff7f50', 'ОФ', s => ({ splashDmg: 1 + 0.06 * s })],
  ['incend', 'Зажигательные', 'Сильнее горение', '#ff4500', 'Зж', s => ({ burnDmg: 1 + 0.12 * s })],
  ['emp', 'ЭМИ-снаряды', 'Шанс оглушить электронику цели', '#9d7bff', 'ЭМ', s => ({ empHit: 0.03 * s })],
  ['autoload', 'Автомат заряжания', 'Быстрее перезарядка', '#ffe08a', 'АЗр', s => ({ rel: 1 - 0.035 * s })],
  ['stab', 'Стабилизатор', 'Точность в движении', '#a0ffd8', 'Ст', s => ({ moveSpread: 1 - 0.1 * s })],
  ['radar', 'Радар', 'Враги рядом видны на миникарте', '#00e5ff', 'Рд', s => ({ radar: 1, view: 0.02 * s })],
  ['minel', 'Минный заградитель', 'Дополнительные мины', '#a08a5a', 'МЗ', s => ({ mineLay: Math.round(s) })],
  ['magmine', 'Магнитные мины', 'Мины сильнее', '#c0c0c0', 'ММ', s => ({ mineDmg: 1 + 0.1 * s })],
  ['decoy', 'Голограмма-приманка', 'Сбивает прицел врагов', '#b9a7ff', 'Гл', s => ({ decoy: 0.05 * s })],
  ['jammer', 'Глушилка наведения', 'Самонаводящиеся ракеты теряют захват', '#ff6aff', 'Гш', s => ({ jam: Math.min(0.85, 0.15 * s) })],
  ['shield', 'Энергощит', 'Щит поглощает урон, восстанавливается', '#5ab8ff', 'Щ', s => ({ shB: Math.round(8 * s) })],
  ['spikes', 'Таранные шипы', 'Таран наносит больше урона', '#ff3b3b', 'Ш', s => ({ ramDmg: 1 + 0.25 * s })],
  ['dozer', 'Бульдозерный отвал', 'Меньше урона от тарана и спереди', '#ffcc33', 'От', s => ({ ramRes: Math.min(0.8, 0.15 * s), arm: 1 + 0.01 * s })],
  ['winch', 'Лебёдка', 'Быстро выбирается из болота, ремонт гусениц', '#d2b48c', 'Лб', s => ({ mudRes: 0.08 * s, regen: 0.06 * s })],
  ['optic', 'Командирская оптика', 'Дальше видит цели', '#90ee90', 'Оп', s => ({ view: 0.05 * s })],
  ['hydro', 'Гидроподвеска', 'Меньше оглушение от попаданий', '#87cefa', 'Гп', s => ({ critRes: 1, acc: 1 + 0.02 * s })],
].map(([id, name, desc, col, g0, f], i) => ({ i, id, name, desc, col, g: id.slice(0, 3).toUpperCase(), f }));
export const gmFx = (M, tier, lv) => M.f(L(lv, (GM_TIERS.find(x => x.id === tier) || GM_TIERS[0]).k));
export const GM_CAP = 8; // mounted gameplay mods per tank per battle
export const gmInfo = (M, tier, lv) => { const fx = gmFx(M, tier, lv); return M.desc + ' · ' + Object.entries(fx).map(([k, v]) => k + ' ' + (typeof v === 'number' ? (v > 0 && v < 3 && v !== Math.round(v) ? (v > 1 ? '+' + Math.round((v - 1) * 100) + '%' : v < 1 && ['spread','moveSpread','rel','splashRes','rearArm'].includes(k) ? '−' + Math.round((1 - v) * 100) + '%' : '+' + Math.round(v * 100) + '%') : '+' + v) : v)).join(', '); };
