// r16 item catalogue: 2000 обычных + 250 редких + 150 эпических + 100 легендарных + 250 мифических = 2750 items.
// Fully procedural from a fixed seed (identical on every client, ~0 bytes of data in the bundle).
// Rules: обычные/редкие/эпические — монеты, задания, ящики; ЛЕГЕНДАРНЫЕ — только ящики или реальные деньги; МИФИЧЕСКИЕ — только реальные деньги.
import { h } from './dom.js';
import { lang, tr } from './i18n.js';
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const SLOTS = [['gun', 'Орудие'], ['turret', 'Башня'], ['hull', 'Корпус'], ['armor', 'Броня'], ['tracks', 'Гусеницы'], ['engine', 'Двигатель'], ['module', 'Модуль'], ['camo', 'Камуфляж'], ['trail', 'След выстрела'], ['boom', 'Цвет взрыва'], ['victory', 'Анимация победы']];
export const RAR = [{ n: 'Обычный', c: '#b8c0c8' }, { n: 'Редкий', c: '#5cc2ff' }, { n: 'Эпический', c: '#c77dff' }, { n: 'Легендарный', c: '#ffb347' }, { n: 'Мифический', c: '#ff4d7a' }];
const STAT = { gun: ['dmg', 'Урон'], turret: ['rel', 'Перезарядка'], hull: ['hp', 'Прочность'], armor: ['arm', 'Броня'], tracks: ['acc', 'Разгон'], engine: ['spd', 'Скорость'], module: ['view', 'Обзор'] };
// stat budget per rarity (fraction); mythic = legendary × 1.05 at most (≤ +5% over legendary)
export const STAT_V = [0, 0.03, 0.05, 0.10, 0.20]; // r20 user-set: common baseline, legendary +10%, mythic +20% (off in «Равные условия»)
// Google Play price ladder: every real-money shop item/bundle/box is sold as one of these tier products (consumable «tier_XXXX», XXXX = cents).
export const PRICE_TIERS = [0.99, 1.99, 2.99, 3.99, 4.99, 5.99, 7.99, 9.99, 12.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99, 69.99, 99.99, 149.99, 199.99];
export const tierOf = (v) => PRICE_TIERS.find(t => t >= v - 0.005) || PRICE_TIERS[PRICE_TIERS.length - 1];
export const eur = (r) => ({ 299: '29,99 недоступно', 449: '39,99 недоступно', 599: '49,99 недоступно', 899: '69,99 недоступно', 199: '9,99 недоступно' }[r] || tierOf(r / 80).toFixed(2).replace('.', ',') + ' недоступно');
const NOUN = { gun: ['Пушка', 'Ствол', 'Орудие', 'Гаубица', 'Бомбарда'], turret: ['Башня', 'Купол', 'Рубка', 'Маска'], hull: ['Корпус', 'Шасси', 'Остов', 'Каркас'], armor: ['Броня', 'Панцирь', 'Щит', 'Экран'], tracks: ['Траки', 'Гусеницы', 'Катки', 'Ходовая'], engine: ['Двигатель', 'Мотор', 'Турбина', 'Дизель'], module: ['Модуль', 'Блок', 'Прибор', 'Узел'], camo: ['Камуфляж', 'Окрас', 'Узор', 'Раскраска'], trail: ['След', 'Шлейф', 'Трассер'], boom: ['Взрыв', 'Вспышка', 'Пламя'], victory: ['Салют', 'Танец', 'Триумф'] };
const ADJ = ['Стальной', 'Полевой', 'Лесной', 'Степной', 'Северный', 'Южный', 'Горный', 'Речной', 'Пустынный', 'Болотный', 'Городской', 'Ночной', 'Утренний', 'Штормовой', 'Медный', 'Чугунный', 'Литой', 'Сварной', 'Клёпаный', 'Тяжёлый', 'Лёгкий', 'Быстрый', 'Верный', 'Хмурый', 'Дикий'];
const MARK = ['Мк', 'Т', 'КВ', 'ИС', 'БТ', 'СУ', 'ПТ', 'М', 'Р', 'Л'];
const MYTH_P = ['Вечный', 'Небесный', 'Звёздный', 'Драконовый', 'Фениксовый', 'Громовой', 'Хрустальный', 'Солнечный', 'Лунный', 'Призрачный', 'Огненный', 'Ледяной', 'Пустотный', 'Золотой', 'Багровый', 'Изумрудный', 'Квантовый', 'Плазменный', 'Древний', 'Титанический', 'Астральный', 'Северного сияния', 'Кометный', 'Вулканический', 'Бездонный'];
const MYTH_N = ['Рассвет', 'Апокалипсис', 'Легион', 'Левиафан', 'Эгида', 'Цитадель', 'Комета', 'Буря', 'Затмение', 'Ковчег'];
const FX = ['искры', 'пламя', 'молнии', 'снежинки', 'звёзды', 'дым', 'сердца', 'руны', 'пузыри', 'лепестки'];
const FEM = new Set(['Пушка', 'Гаубица', 'Бомбарда', 'Башня', 'Рубка', 'Маска', 'Броня', 'Ходовая', 'Раскраска', 'Турбина', 'Вспышка']), NEU = new Set(['Орудие', 'Шасси', 'Пламя']), PL = new Set(['Траки', 'Гусеницы', 'Катки']);
const soft = (a) => /[гкхжшщч]ий$/.test(a) ? false : /ий$/.test(a);
const fem = (adj, noun) => { if (PL.has(noun)) return adj.replace(/(ый|ой|ий)$/, (m) => /[гкхжшщч]ий$/.test(adj) || soft(adj) ? 'ие' : 'ые'); if (FEM.has(noun)) return adj.replace(/(ый|ой|ий)$/, () => soft(adj) ? 'яя' : 'ая'); if (NEU.has(noun)) return adj.replace(/(ый|ой|ий)$/, () => soft(adj) ? 'ее' : 'ое'); return adj; };
let CAT = null;
export function catalog() { if (CAT) return CAT; const R = mulberry(0x9C0B0B), out = [], seen = new Set();
  const add = (rar, i) => { const slot = SLOTS[Math.floor(R() * SLOTS.length)][0], nn = NOUN[slot], noun = nn[Math.floor(R() * nn.length)]; let name;
    if (rar === 4) { do { name = fem(MYTH_P[Math.floor(R() * MYTH_P.length)], noun) + ' ' + noun + ' «' + MYTH_N[Math.floor(R() * MYTH_N.length)] + '»'; } while (seen.has(name)); }
    else { do { name = fem(ADJ[Math.floor(R() * ADJ.length)], noun) + ' ' + noun + ' ' + MARK[Math.floor(R() * MARK.length)] + '-' + (1 + Math.floor(R() * 99)); } while (seen.has(name)); }
    seen.add(name); const st = STAT[slot]; const id = out.length; const mk = rar === 4 ? name.slice(name.indexOf('«')) : name.slice(name.lastIndexOf(' ') + 1);
    out.push({ id, rar, slot, name, mk, hue: Math.floor(R() * 360), shape: Math.floor(R() * 6), fx: rar === 4 ? FX[Math.floor(R() * FX.length)] : null, stat: st ? st[0] : null, sv: st ? STAT_V[rar] : 0,
      price: rar <= 2 ? [2, 4, 6][rar] + (Math.floor(R() * 10) > 6 ? 1 : 0) : 0, iap: rar >= 3 ? (rar === 4 ? 'mythic_' : 'legend_') + String(id).padStart(4, '0') : null, rub: rar === 4 ? [299, 449, 599, 899][Math.floor(R() * 4)] : rar === 3 ? 199 : 0 }); };
  for (let i = 0; i < 2000; i++) add(0, i); for (let i = 0; i < 250; i++) add(1, i); for (let i = 0; i < 150; i++) add(2, i); for (let i = 0; i < 100; i++) add(3, i); for (let i = 0; i < 250; i++) add(4, i);
  CAT = out; return out; }
// how an item can be obtained (enforced by the shop / box code below)
export function sources(it) { return it.rar === 4 ? ['Только за реальные деньги · навсегда'] : it.rar === 3 ? ['Легендарный/Эпический ящик', 'или покупка за недоступно · навсегда'] : ['Монеты', 'Задания', 'Ящики']; }
// ---------- boxes ----------
export const BOXES = [
  { id: 'c', n: 'Обычный ящик', col: '#b8c0c8', odds: [85, 13, 2, 0], rub: 49 },
  { id: 'r', n: 'Редкий ящик', col: '#5cc2ff', odds: [55, 35, 9, 1], rub: 129 },
  { id: 'e', n: 'Эпический ящик', col: '#c77dff', odds: [0, 50, 40, 10], rub: 299 },
  { id: 'l', n: 'Легендарный ящик', col: '#ffb347', odds: [0, 0, 60, 40], rub: 649 },
];
export const DUPE = [{ shards: 5, coins: 20 }, { shards: 15, coins: 60 }, { shards: 40, coins: 150 }, { shards: 100, coins: 400 }];
// config: paid boxes off by region (e.g. Belgium bans paid loot boxes). Boxes stay earnable in play.
export const CONFIG = { paidBoxBlockedRegions: ['BE', 'NL'] };
export function region() { try { const L = (navigator.languages && navigator.languages[0]) || navigator.language || ''; const m = /-([A-Z]{2})$/i.exec(L); return m ? m[1].toUpperCase() : ''; } catch (e) { return ''; } }
export function paidBoxesAllowed(d) { const r = (d && d.regionOverride) || region(); return !CONFIG.paidBoxBlockedRegions.includes(r); }
export function openBox(d, boxId, rnd = Math.random) { const B = BOXES.find(b => b.id === boxId); const C = catalog(); let v = rnd() * 100, rar = 0; for (let k = 0; k < 4; k++) { if (v < B.odds[k]) { rar = k; break; } v -= B.odds[k]; }
  const pool = C.filter(x => x.rar === rar); const it = pool[Math.floor(rnd() * pool.length)]; const own = d.items || (d.items = []); const dupe = own.includes(it.id);
  if (dupe) { const D = DUPE[rar]; d.shards = (d.shards || 0) + D.shards; d.coins += D.coins; } else own.push(it.id); return { it, dupe, rar, conv: dupe ? DUPE[rar] : null }; }
// ---------- icons (procedural canvas, cached) ----------
const ICO = new Map();
export function itemIcon(it, size = 44, t = 0) { const cv = document.createElement('canvas'); cv.width = cv.height = size * 2; cv.style.width = cv.style.height = size + 'px'; drawItem(cv.getContext('2d'), it, size * 2, t); return cv; }
export function drawItem(g, it, S, t = 0) { const c = RAR[it.rar].c, hu = it.hue; g.clearRect(0, 0, S, S); const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, 'hsl(' + hu + ',35%,22%)'); gr.addColorStop(1, '#0d1016'); g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(2, 2, S - 4, S - 4, S * 0.2) : g.rect(2, 2, S - 4, S - 4); g.fill();
  g.strokeStyle = c; g.lineWidth = it.rar >= 3 ? 4 : 2; g.stroke(); g.save(); g.translate(S / 2, S / 2); const k = S / 44;
  if (it.rar === 4) { for (let i = 0; i < 8; i++) { const a = t * 1.5 + i * 0.785, r = 15 * k + Math.sin(t * 3 + i) * 2 * k; g.fillStyle = 'hsla(' + ((hu + i * 20) % 360) + ',100%,70%,' + (0.5 + 0.5 * Math.sin(t * 4 + i)) + ')'; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 1.8 * k, 0, 6.283); g.fill(); } g.shadowColor = 'hsl(' + hu + ',100%,60%)'; g.shadowBlur = 10 * k * (0.7 + 0.3 * Math.sin(t * 5)); }
  g.fillStyle = 'hsl(' + hu + ',' + (40 + it.rar * 12) + '%,' + (50 + it.rar * 4) + '%)'; const s = it.slot;
  if (s === 'gun') { g.fillRect(-14 * k, -3 * k, 26 * k, 6 * k); g.fillRect(-16 * k, -6 * k, 8 * k, 12 * k); } else if (s === 'turret') { g.beginPath(); g.arc(0, 0, 9 * k, 0, 6.283); g.fill(); g.fillRect(6 * k, -2 * k, 11 * k, 4 * k); }
  else if (s === 'hull') { g.fillRect(-14 * k, -8 * k, 28 * k, 16 * k); } else if (s === 'armor') { g.beginPath(); g.moveTo(0, -13 * k); g.lineTo(11 * k, -7 * k); g.lineTo(9 * k, 7 * k); g.lineTo(0, 13 * k); g.lineTo(-9 * k, 7 * k); g.lineTo(-11 * k, -7 * k); g.closePath(); g.fill(); }
  else if (s === 'tracks') { for (let i = -12; i <= 12; i += 4) g.fillRect(i * k, -9 * k, 2.6 * k, 18 * k); } else if (s === 'engine') { g.fillRect(-10 * k, -8 * k, 20 * k, 16 * k); g.fillStyle = '#0d1016'; for (let i = -6; i <= 6; i += 4) g.fillRect(i * k, -6 * k, 2 * k, 12 * k); }
  else if (s === 'module') { g.fillRect(-9 * k, -9 * k, 18 * k, 18 * k); g.fillStyle = '#0d1016'; g.fillRect(-4 * k, -4 * k, 8 * k, 8 * k); } else if (s === 'camo') { for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(((i * 37) % 20 - 10) * k, ((i * 53) % 20 - 10) * k, 5 * k, 3 * k, i, 0, 6.283); g.fill(); g.fillStyle = 'hsl(' + ((hu + 60 * i) % 360) + ',40%,45%)'; } }
  else if (s === 'trail') { g.lineWidth = 3 * k; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(-14 * k, 8 * k); g.quadraticCurveTo(0, -12 * k, 14 * k, -4 * k); g.stroke(); } else if (s === 'boom') { for (let i = 0; i < 10; i++) { const a = i * 0.628, r = i % 2 ? 6 * k : 14 * k; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); }
  else { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * 0.628 - 1.57, r = i % 2 ? 5 * k : 13 * k; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
  g.restore(); }
// gameplay effect of equipped catalogue items (offline only; online / «равные условия» ignore all of them)
export function itemBonus(d) { const C = catalog(), b = {}; for (const s in (d.itemEq || {})) { const it = C[d.itemEq[s]]; if (it && it.stat) b[it.stat] = Math.max(b[it.stat] || 0, it.sv); } return b; }
// virtualized list: renders only the rows in view (handles all 2750 items at 60 fps)
export function vlist(items, rowH, renderRow, height = 420) { const box = h('div', { class: 'vlist', style: { height: height + 'px', overflowY: 'auto', position: 'relative' } }), inner = h('div', { style: { height: items.length * rowH + 'px', position: 'relative' } }); box.appendChild(inner);
  const pool = new Map(); const draw = () => { const a = Math.max(0, Math.floor(box.scrollTop / rowH) - 4), b = Math.min(items.length, Math.ceil((box.scrollTop + height) / rowH) + 4);
    for (const [i, el] of pool) if (i < a || i >= b) { el.remove(); pool.delete(i); } for (let i = a; i < b; i++) if (!pool.has(i)) { const el = renderRow(items[i], i); el.style.position = 'absolute'; el.style.top = i * rowH + 'px'; el.style.left = '0'; el.style.right = '0'; el.style.height = (rowH - 6) + 'px'; inner.appendChild(el); pool.set(i, el); } };
  box.addEventListener('scroll', draw, { passive: true }); setTimeout(draw, 0); box._draw = draw; box._pool = pool; return box; }

// localized display name: ru keeps the full generated name; other languages use the localized slot name + model code (proper noun)
const TL = { А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ж:'Zh',З:'Z',И:'I',Й:'Y',К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'Kh',Ц:'Ts',Ч:'Ch',Ш:'Sh',Щ:'Sch',Ы:'Y',Э:'E',Ю:'Yu',Я:'Ya',Ь:'',Ъ:'' };
const latin = s => String(s).replace(/[А-ЯЁа-яё]/g, c => { const u = c.toUpperCase(), r = TL[u === 'Ё' ? 'Е' : u]; return r == null ? c : c === u ? r : r.toLowerCase(); });
export function locName(it) { if (lang() === 'ru') return it.name; return tr(Object.fromEntries(SLOTS)[it.slot]) + ' ' + (['uk'].includes(lang()) ? it.mk : latin(it.mk)); }
