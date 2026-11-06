// r15: season pass «Сезон 1 · Болотный фронт» (30 tiers, free + premium track) and first-launch onboarding.
import { h } from './dom.js';
import { icon } from './icons.js';
import { MODELS } from '../sim/models.js';
import { LOOTX, GEAR, MYTH_GEAR } from '../sim/loot.js';

// r25: 35 tiers. Premium (6,99 недоступно): 35 different modifications — tier 35 is the ONE permanent mythic, the other 34 are legendary/common parts for 3–5 battles. Free: coins + a few common parts.
export const SEASON = { n: 'Сезон 1 · Болотный фронт', tiers: 35, need: 220, ends: '2026-12-31T23:59:59' };
const MYTH_TOP = MYTH_GEAR.length ? MYTH_GEAR[MYTH_GEAR.length - 4] : null; // Корпус «Титан» · миф
const pickGear = (i, leg) => { const slot = i % 11; let best = -1; for (let k = 0, n = 0; k < LOOTX.length; k++) { const L = LOOTX[k]; if (L.cat !== 'gear' || GEAR[L.i].slot !== slot || (leg ? L.r !== 4 : L.r > 2)) continue; if (n++ === Math.floor(i / 11) * 3 + (leg ? 1 : 0)) { best = k; break; } } return best; };
export function seasonReward(i, prem) { // i = tier 1..35
  if (prem) { if (i === SEASON.tiers) return { myth: 'gear:' + MYTH_TOP }; const leg = i % 3 !== 1; if (i % 2) { const gi = Math.floor(i / 2) % 32, lid = LOOTX.findIndex(x => x.cat === 'gmod' && x.i === gi && x.tier === (leg ? 4 : 1) && x.lv === 1 + (i % 3)); if (lid >= 0) return { lid, n: leg ? 3 : 5 }; } return { lid: pickGear(i, leg), n: leg ? 3 : 5 }; }
  return i % 5 === 0 ? { lid: pickGear(i + 40, false), n: 3 } : { coins: 6 + Math.floor(i / 2) };
}
const rwText = (r) => r.myth ? '✦ ' + GEAR[+r.myth.split(':')[1]].name + ' · НАВСЕГДА' : r.lid != null && LOOTX[r.lid] ? LOOTX[r.lid].name + ' · ' + (LOOTX[r.lid].r >= 4 ? 'Легендарный' : 'Обычный') + ' · на ' + r.n + ' боя' : '+' + r.coins + ' 🪙';
const left = () => { const ms = Math.max(0, new Date(SEASON.ends).getTime() - Date.now()), d = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24; return d + ' д ' + hh + ' ч'; };
export function bpOf(d) { return d.bp || (d.bp = { xp: 0, fc: [], pc: [], prem: false }); }
export function bpTier(d) { return Math.min(SEASON.tiers, Math.floor(bpOf(d).xp / SEASON.need)); }

export function installSeason(UI) {
  const P = UI.prototype;
  P.studioSplash = function (done) { studioSplash(this, done); };
  P.season = function () {
    const d = this.m.d, bp = bpOf(d), tier = bpTier(d), into = bp.xp % SEASON.need, ui = this;
    const info = (i, prem) => { const r = seasonReward(i, prem), got = (prem ? bp.pc : bp.fc).includes(i), needP = prem && !bp.prem; ui.app.audio.play('click'); // r36: locked/claimed cells open an info sheet instead of doing nothing
      ui.modal([h('h3', null, (prem ? 'Премиум' : 'Бесплатно') + ' · уровень ' + i), h('p', null, rwText(r)), h('p', { class: 'note' }, got ? '✓ Уже получено' : i > tier ? 'Откроется на уровне пропуска ' + i + ' (сейчас ' + tier + '). Опыт сезона — за каждый бой.' : needP ? 'Нужен премиум-пропуск.' : ''),
        needP ? ui.confirmBtns(['', 'no', 'Закрыть'], ['y', 'prem', 'Премиум · 7,00 недоступно']) : ui.confirmBtns(['y', 'no', 'Понятно'])], (m) => { if (m === 'prem') ui.app.IAP.purchase('season_pass').then(ok => { if (ok) { bp.prem = true; ui.m.save(); ui.toast('Премиум-пропуск активирован', 'star'); } ui.season(); }); }); };
    const claim = (i, prem) => { const L = prem ? bp.pc : bp.fc; if (L.includes(i) || i > tier || (prem && !bp.prem)) return info(i, prem); const r = seasonReward(i, prem); L.push(i); if (r.coins) d.coins += r.coins; if (r.lid != null && r.lid >= 0) (d.tmp || (d.tmp = [])).push({ lid: r.lid, n: r.n, name: LOOTX[r.lid].name }); if (r.myth) { d.myth = d.myth || []; if (!d.myth.includes(r.myth)) d.myth.push(r.myth); } this.m.save(); this.app.audio.play('levelup'); this.app.vibrate && this.app.vibrate(30); this.toast('Получено: ' + rwText(r), 'gift'); this.season(); };
    const cell = (i, prem) => { const r = seasonReward(i, prem), got = (prem ? bp.pc : bp.fc).includes(i), can = i <= tier && !got && (!prem || bp.prem);
      return h('button', { class: 'bpc' + (prem ? ' prem' : '') + (got ? ' got' : can ? ' can' : i > tier ? ' lock' : ''), onclick: () => claim(i, prem) }, h('small', null, prem ? 'ПРЕМИУМ' : 'БЕСПЛАТНО'), h('b', null, rwText(r)), h('em', null, got ? '✓ получено' : can ? 'Забрать' : prem && !bp.prem ? '🔒 премиум' : '🔒')); };
    const rows = []; for (let i = 1; i <= SEASON.tiers; i++) rows.push(h('div', { class: 'bpr' + (i === tier + 1 ? ' next' : '') }, h('div', { class: 'bpn' }, String(i)), cell(i, false), cell(i, true)));
    this.show('season', [h('div', { class: 'menu-bg season' }), this.hdr('Боевой пропуск'), h('div', { class: 'scroll' },
      h('div', { class: 'panel bphead' }, h('h3', null, SEASON.n), h('p', { class: 'note' }, '⏳ До конца сезона: ' + left() + ' · опыт сезона начисляется за каждый бой'), (d.tmp && d.tmp.length) ? h('p', { class: 'note', style: 'text-align:left' }, 'Активные награды: ' + d.tmp.map(x => x.name + ' — осталось боёв: ' + x.n).join('; ')) : null,
        h('div', { class: 'bpbar' }, h('i', { style: { width: (tier >= SEASON.tiers ? 100 : into / SEASON.need * 100) + '%' } })), h('p', null, 'Уровень пропуска ' + tier + ' / ' + SEASON.tiers + (tier < SEASON.tiers ? ' · ' + into + ' / ' + SEASON.need + ' XP' : '')),
        bp.prem ? h('p', { class: 'note', style: 'color:#ffd23d' }, '★ Премиум активен') : h('button', { class: 'btn big y', onclick: () => ui.app.IAP.purchase('season_pass').then(ok => { if (ok) { bp.prem = true; ui.m.save(); ui.toast('Премиум-пропуск активирован', 'star'); } ui.season(); }) }, 'Премиум-пропуск · 7,00 недоступно · 35 наград · 1 мифическая навсегда')),
      h('div', { class: 'bplist' }, rows))]);
    const nx = this.root.querySelector('.bpr.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center' }), 40);
  };
  // first-launch onboarding: 5 glass cards, then an optional training match vs easy bots
  P.onboarding = function () {
    const d = this.m.d; if (d.onboarded) return; const steps = [
      ['Добро пожаловать в PRICOPBUM!', 'Танковые сражения на 150 игроков, режимы с друзьями и онлайн. Пара советов перед первым боем.', 'play'],
      ['Движение и прицел', 'Левый палец — езда, правый палец — прицел и огонь. Помощь прицеливания можно настроить в «Настройках».', 'crown'],
      ['Лут и снаряжение', 'Подъезжай к ящикам и предметам и жми «ВЗЯТЬ»: оружие, броня, аптечки, ракеты, «Маяк» и модуль радара.', 'gift'],
      ['Местность', 'Кусты и болото прячут танк, в болоте можно погрузиться. Грязь замедляет. Сломанные гусеницы чинит только деталь или ремкомплект.', 'shield'],
      ['Танки и сезон', 'Собирай 200 моделей танков, создавай свой в «Конструкторе BR» и проходи боевой пропуск сезона.', 'star']];
    let i = 0; const ui = this;
    const step = () => { const [t, p, ic] = steps[i]; ui.modal([h('div', { class: 'onb-dots' }, steps.map((_, k) => h('i', { class: k === i ? 'on' : '' }))), h('div', { style: 'color:#ffd23d' }, icon(ic, 44)), h('h3', null, t), h('p', null, p),
      i < steps.length - 1 ? ui.confirmBtns(['', 'skip', 'Пропустить'], ['y', 'next', 'Далее']) : ui.confirmBtns(['', 'done', 'В меню'], ['y', 'train', 'Тренировка'])],
      (m) => { if (m === 'next') { i++; setTimeout(step, 230); } else { d.onboarded = 1; ui.m.save(); if (m === 'train') setTimeout(() => ui.app.startLocal('ffa'), 260); } }, { dismiss: false }); };
    setTimeout(step, 600);
  };
}
// «PRICOP.studio» splash before the menu (≈1.8 s, tap to skip)
export function studioSplash(ui, done) { // r31: store-game launch: studio logo → PRICOPBUM title → loading bar with tips → menu (tap skips a stage)
  const TIPS = ['Совет: стреляй из кустов — тебя не видно, пока не выстрелишь', 'Совет: аптечки и патроны лежат на полу — подбирай их', 'Совет: мифические детали остаются навсегда', 'Совет: заходи с фланга — бока и корма слабее', 'Совет: «Невидимка» прячет танк на 10 секунд', 'Совет: в «Игре с друзьями» позови друга по коду из 5 букв'];
  const el = h('div', { class: 'studio' }); ui.root.appendChild(el); let st = -1, fin = false, tm = 0;
  const end = () => { if (fin) return; fin = true; clearTimeout(tm); el.classList.add('out'); setTimeout(() => el.remove(), 450); done(); };
  const stage = () => { st++; clearTimeout(tm); while (el.firstChild) el.removeChild(el.firstChild);
    if (st === 0) { el.appendChild(h('div', { class: 'stlogo' }, h('i', null, 'P'), h('div', null, h('b', null, 'PRICOP'), h('span', null, '.studio')))); el.appendChild(h('small', null, 'представляет')); tm = setTimeout(stage, 1500); }
    else if (st === 1) { el.appendChild(h('div', { class: 'sttitle' }, 'PRICOPBUM')); el.appendChild(h('small', null, 'Танковые бои онлайн')); try { ui.app.audio.play('boom', 0.6); } catch (e) {} tm = setTimeout(stage, 1400); }
    else if (st === 2) { const bar = h('i'), pct = h('span', null, '0%'); el.appendChild(h('div', { class: 'sttitle sm' }, 'PRICOPBUM')); el.appendChild(h('div', { class: 'stbar' }, bar)); el.appendChild(pct); el.appendChild(h('small', { class: 'sttip' }, TIPS[Math.floor(Math.random() * TIPS.length)]));
      const t0 = performance.now(), fr = () => { if (fin || st !== 2) return; const k = Math.min(1, (performance.now() - t0) / 1300); bar.style.width = (k * 100).toFixed(0) + '%'; pct.textContent = Math.round(k * 100) + '%'; if (k < 1) requestAnimationFrame(fr); else tm = setTimeout(end, 150); }; requestAnimationFrame(fr); }
    else end(); };
  el.addEventListener('click', () => { if (st >= 2) end(); else stage(); }); stage();
}
