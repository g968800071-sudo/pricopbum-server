// r16: shell types «Снаряды» and equipment «Снаряжение». Pure data + validation (used by the sim, so the server validates too).
export const SHELLS = [
  { id: 'ap', name: 'Бронебойный', short: 'ББ', col: '#ffd23d', dmg: 1, vsArm: 1.3, desc: 'Базовый, бесконечный. +30% по бронированным' },
  { id: 'he', name: 'Осколочно-фугасный', short: 'ОФ', col: '#ff8a3d', dmg: 0.8, splash: 20, desc: 'Взрыв по площади — против групп' },
  { id: 'heat', name: 'Кумулятивный', short: 'КС', col: '#ff4d7a', dmg: 1.2, vsArm: 1.5, spd: 0.85, desc: 'Прожигает броню, медленнее' },
  { id: 'apds', name: 'Подкалиберный', short: 'ПК', col: '#9fe8ff', dmg: 0.92, spd: 1.55, desc: 'Очень быстрый, дальний' },
  { id: 'inc', name: 'Зажигательный', short: 'ЗЖ', col: '#ff5a1f', dmg: 0.75, burn: 3, desc: 'Поджигает цель на 3 с' },
  { id: 'emp', name: 'ЭМИ', short: 'ЭМ', col: '#7fd8ff', dmg: 0.5, emp: 1.8, desc: 'Отключает орудия и предметы на 1,8 с' },
  { id: 'frz', name: 'Замораживающий', short: 'ЗМ', col: '#bff4ff', dmg: 0.6, freeze: 2, desc: 'Замедляет цель на 2 с' },
  { id: 'smk', name: 'Дымовой', short: 'ДМ', col: '#c8c8c8', dmg: 0.3, smoke: 1, desc: 'Ставит дымовую завесу в точке попадания' },
  { id: 'ric', name: 'Рикошетный', short: 'РК', col: '#d2ff6c', dmg: 0.86, bounce: 2, desc: 'Отскакивает от стен дважды' },
  { id: 'clu', name: 'Кассетный', short: 'КАС', col: '#ffb347', dmg: 0.55, splash: 12, cluster: 4, desc: 'Разлетается на 4 суббоеприпаса' },
];
export const SHELL_IDX = Object.fromEntries(SHELLS.map((s, i) => [s.id, i]));
export const SHELL_CAP = 40; // total special shells in a loadout
export const EQUIP = [
  { id: 'smokel', name: 'Дымовой мортирный', desc: '+2 дымовые шашки при появлении' },
  { id: 'minel', name: 'Минный заградитель', desc: '+2 мины при появлении' },
  { id: 'repair', name: 'Ремонтный модуль', desc: 'Вне боя (4 с) чинит 2% HP/с' },
  { id: 'radar', name: 'Радар', desc: 'Показывает врагов на миникарте ближе 260' },
  { id: 'optics', name: 'Оптика', desc: 'Разброс −35%, боты видят дальше' },
  { id: 'spall', name: 'Подбой', desc: 'Урон от взрывов −25%' },
  { id: 'ext', name: 'Огнетушитель', desc: 'Горение гаснет в 3 раза быстрее' },
  { id: 'nitro', name: 'Нитро', desc: 'Скорость +8%' },
  { id: 'jammer', name: 'Глушилка', desc: 'Урон самонаводящихся ракет −50%' },
  { id: 'shieldg', name: 'Генератор щита', desc: 'Щит 15% HP при появлении и после 8 с без урона' },
  { id: 'reload', name: 'Досылатель', desc: 'Перезарядка −8%' },
  { id: 'track', name: 'Усиленные траки', desc: 'Гусеницы ломаются реже, разгон +10%' },
];
export const EQUIP_IDS = EQUIP.map(e => e.id);
export const EQUIP_SLOTS = 3;
export const DEFAULT_LOADOUT = { shells: { he: 12, heat: 8, apds: 8, inc: 4, emp: 2, frz: 2, smk: 2, ric: 1, clu: 1 }, equip: ['repair', 'optics', 'smokel'] };
// validation: unknown ids dropped, ints, total cap, unique equipment, slot count
export function normLoadout(L) {
  const out = { shells: {}, equip: [] }; if (!L || typeof L !== 'object') L = DEFAULT_LOADOUT;
  let tot = 0; const sh = L.shells && typeof L.shells === 'object' ? L.shells : {};
  for (const s of SHELLS) { if (s.id === 'ap') continue; let n = Math.max(0, Math.min(SHELL_CAP, Math.floor(+sh[s.id] || 0))); n = Math.min(n, SHELL_CAP - tot); tot += n; if (n) out.shells[s.id] = n; }
  if (Array.isArray(L.equip)) for (const e of L.equip) if (EQUIP_IDS.includes(e) && !out.equip.includes(e) && out.equip.length < EQUIP_SLOTS) out.equip.push(e);
  return out;
}
// bot loadouts by persona
const PL = { aggressive: [{ he: 12, heat: 12, inc: 8, clu: 4 }, ['nitro', 'reload', 'spall']], sniper: [{ apds: 18, heat: 10, frz: 4 }, ['optics', 'reload', 'jammer']], flanker: [{ heat: 10, inc: 8, emp: 6, ric: 4 }, ['nitro', 'track', 'smokel']], medic: [{ he: 6, smk: 10, frz: 6 }, ['repair', 'shieldg', 'smokel']], looter: [{ he: 10, apds: 8, ric: 8 }, ['radar', 'track', 'ext']], coward: [{ smk: 12, frz: 10, emp: 6 }, ['smokel', 'minel', 'shieldg']] };
export function personaLoadout(pers, rnd) { const p = PL[pers] || PL.looter, sh = {}; for (const k in p[0]) sh[k] = Math.max(0, Math.round(p[0][k] * (0.6 + rnd() * 0.8))); const eq = p[1].slice(); if (rnd() < 0.5) eq[(rnd() * 3) | 0] = EQUIP_IDS[(rnd() * EQUIP_IDS.length) | 0]; return normLoadout({ shells: sh, equip: eq }); }
// bot shell choice: HE/cluster vs groups, HEAT/AP vs armour, APDS at range, EMP vs multi-gun, etc.
export function pickShell(w, t, tg) {
  const has = (id) => id === 'ap' || (t.shA && t.shA[SHELL_IDX[id]] > 0);
  if (!tg) return 0; const d = Math.hypot(tg.x - t.x, tg.y - t.y); let grp = 0;
  for (const o of w.tanks) if (o !== tg && o.alive && o.team === tg.team && o.team !== t.team && (o.x - tg.x) ** 2 + (o.y - tg.y) ** 2 < 40 * 40) grp++;
  const armored = tg.armorHp > 0 || tg.maxHp > 140;
  const order = [];
  if (grp >= 2) order.push('clu', 'he'); if (grp >= 1) order.push('he');
  if (tg.mounts && tg.mounts.length > 1 && !(tg.empT > 0)) order.push('emp');
  if (armored) order.push('heat', 'ap');
  if (d > 190) order.push('apds');
  if (tg.vx * tg.vx + tg.vy * tg.vy > 900 && !(tg.slowT > 0)) order.push('frz');
  if (!armored && !(tg.burnT > 0)) order.push('inc');
  if (t.hp < t.maxHp * 0.3) order.push('smk');
  for (const id of order) if (has(id)) return SHELL_IDX[id];
  return 0;
}
// r16b: 15 more shell types (25 total)
SHELLS.push(
  { id: 'thb', name: 'Термобарический', short: 'ТБ', col: '#ff3d1f', dmg: 0.7, splash: 30, burn: 2, desc: 'Огромный огненный взрыв' },
  { id: 'cbr', name: 'Бетонобойный', short: 'БТ', col: '#a0a0a0', dmg: 0.88, brick: 3, steel: 1, desc: 'Ломает стены и сталь' },
  { id: 'trc', name: 'Трассирующий', short: 'ТР', col: '#fff36c', dmg: 0.83, reveal: 5, desc: 'Подсвечивает цель союзникам на 5 с' },
  { id: 'acd', name: 'Кислотный', short: 'КИ', col: '#9cff3d', dmg: 0.62, acid: 35, desc: 'Разъедает броню (−35 брони)' },
  { id: 'shr', name: 'Шрапнель', short: 'ШР', col: '#d9b38c', dmg: 0.35, count: 4, spread: 0.18, desc: 'Веер из 4 осколков' },
  { id: 'pls', name: 'Плазменный', short: 'ПЛ', col: '#c77dff', dmg: 1.35, spd: 0.7, desc: 'Мощный, но медленный' },
  { id: 'mag', name: 'Магнитный', short: 'МГ', col: '#5cc2ff', dmg: 0.81, homing: 2.2, desc: 'Слегка доворачивает к цели' },
  { id: 'exp', name: 'Разрывной', short: 'РЗ', col: '#ff6b6b', dmg: 1.05, splash: 9, desc: 'Малый взрыв + полный урон' },
  { id: 'elc', name: 'Электрический', short: 'ЭЛ', col: '#7ff7ff', dmg: 0.78, chain: 0.45, desc: 'Цепная молния на соседнего врага' },
  { id: 'grv', name: 'Гравитационный', short: 'ГР', col: '#8a6cff', dmg: 0.57, pull: 70, desc: 'Притягивает цель к стрелку' },
  { id: 'sig', name: 'Сигнальный', short: 'СГ', col: '#ff4dd2', dmg: 0.2, reveal: 10, flare: 1, desc: 'Ракета-маяк: видно всем 10 с' },
  { id: 'pho', name: 'Фосфорный', short: 'ФС', col: '#fffbe0', dmg: 0.52, burn: 4, smoke: 1, desc: 'Поджог + дым' },
  { id: 'crs', name: 'Дробящий', short: 'ДР', col: '#b08968', dmg: 0.95, pbreak: 1, desc: 'Ломает узлы (гусеницы/ствол)' },
  { id: 'flt', name: 'Стреловидный', short: 'СТ', col: '#e0e0e0', dmg: 0.73, pierce: 1, spd: 1.3, desc: 'Пробивает навылет' },
  { id: 'shk', name: 'Ударно-волновой', short: 'УВ', col: '#ffd9a0', dmg: 0.65, knock: 160, desc: 'Отбрасывает цель' },
);
SHELLS.push(
  // r36 «Молния»: lightning rounds from the «Ящик с молниями» (28 rounds). Tier by colour, normal-shell damage level.
  { id: 'lw', name: 'Молния (обычная)', short: 'МЛ', col: '#f4f8ff', dmg: 1.0, spd: 1.6, zap: 1, rar: 0, crate: 1, desc: 'Белая молния · базовый урон' },
  { id: 'lb', name: 'Молния (легендарная)', short: 'МЛ', col: '#4aa8ff', dmg: 1.1, spd: 1.6, zap: 2, rar: 3, crate: 1, desc: 'Синяя молния · урон +10%' },
  { id: 'lr', name: 'Молния (мифическая)', short: 'МЛ', col: '#ff3b4a', dmg: 1.2, spd: 1.6, zap: 3, rar: 4, crate: 1, desc: 'Красная молния · урон +20%' },
);
export const ZAP_N = 28;
SHELLS.forEach((s, i) => { SHELL_IDX[s.id] = i; });
