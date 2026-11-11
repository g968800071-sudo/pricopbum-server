import { flagEmoji, ccFromLocale, CCS, drawFlag } from '../sim/flags.js';
import { rankOf, rankInfo, tankLv } from './meta.js';
import { SHELLS, EQUIP, EQUIP_SLOTS, SHELL_CAP, DEFAULT_LOADOUT, normLoadout } from '../sim/loadout.js';
import { LANGS, langName, setLang } from './i18n.js';
import { h, fill, br , rel } from './dom.js';
import { DIFFS, SQUADS, FFA_TARGETS, ARENA_FORMATS } from '../sim/defs.js';
import { MAPS } from '../sim/maps.js';
import { mapPicker } from './editor.js';
import { VNAME } from '../net/client.js';
const ONLINE_V = [['br', 'Королевская битва · 150', 'y big'], ['brg', 'Гигантская BR · 150 · 60 мин', 'y'], ['cbr', 'Конструктор BR (своя сборка)', 'y'], ['moba', 'Оборона баз · 5 игроков в команде', 'y'], ['ffa', 'Каждый за себя'], ['team', 'Команды 10×10', 'b'], ['team20', 'Битва 20×20'], ['arena', 'Арена 3×3'], ['duel', 'Дуэль 1×1'], ['koth', 'Царь горы'], ['sniper', 'Снайперы'], ['ctf', 'Захват флага'], ['trench', 'Траншеи 15×15 · деревня', 'y'], ['hunt', 'Охота 1×5 · BUGA.BUM', 'y'], ['race', 'Танковые гонки']];
const MAPPED = ['team', 'team20', 'arena', 'duel', 'koth', 'sniper', 'ctf', 'survival', 'zombie', 'boss', 'coop'];
const mapLabel = (d) => d.mapSel === 'custom' && d.customMap ? 'Своя' : d.mapSel == null || d.mapSel === -1 || !MAPS[d.mapSel] ? 'Случайная' : MAPS[d.mapSel].name;
// DOM menus: main menu, garage, shop, missions, achievements, online/bluetooth, settings, results, modals.
import { icon } from './icons.js';
import { WEAPONS, SHOP_WEAPONS, WEAPON_LIST, UPGRADES, SKINS, SKIN_LIST, WEAPON_PRICE } from '../sim/defs.js';
import { ACHIEVEMENTS, DAILY, xpNeed } from './meta.js';
import { Renderer, roundRect } from './render.js';
import { PRODUCTS } from './monetization.js';
import { installTankScreens } from './tanks.js';
import { installSeason, bpTier } from './season.js';
import { installTour } from './tour.js';
import { installEconomy } from './economy.js';
import { installPrebattle } from './prebattle.js';
import { installBoxes } from './boxes.js';
import { installTankMods } from './tankmods.js';
import { installFriends } from './friends.js';

const fmtN = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const MODES = [
  { id: 'moba', art: 'moba', big: true, sub: 'Как в Доте', title: 'Оборона баз', tag: 'НОВОЕ · 30×30', hot: true, desc: 'Командная битва в духе MOBA: 3 линии и лес, по 9 башен и штаб у каждой команды. Сноси башни по очереди, получай золото, улучшайся в магазине базы и уничтожь вражеский штаб. Играйте с ботами, с друзьями по коду комнаты или онлайн.' },
  { id: 'cbr', art: 'br', title: 'Конструктор BR', tag: 'СВОЙ ТАНК · 150', hot: true, desc: 'Собери свой танк из корпуса, башни, орудия, гусениц, двигателя и брони в рамках бюджета — и выживи в королевской битве против ботов или игроков.' },
  { id: 'br', title: 'Королевская битва', tag: '150 ТАНКОВ', hot: true, desc: '150 танков на огромной карте. Собирай оружие из ящиков, прячься в кустах и останься последним, пока зона сужается.' },
  { id: 'team', title: 'Командный бой 10×10', tag: 'ДО 100 УНИЧТОЖЕНИЙ', desc: 'Синие против красных. Бесконечные возрождения — первая команда, набравшая 100 уничтожений, побеждает.' },
  { id: 'team20', art: 'team', title: 'Битва 20×20', tag: '40 ТАНКОВ', desc: 'Большое сражение двух армий по двадцать танков. Держи строй, прикрывай союзников, до 150 уничтожений.' },
  { id: 'ffa', art: 'br', title: 'Каждый за себя', tag: 'FFA · 30 ТАНКОВ', desc: 'Огромная карта, без союзников и без зоны. Возрождение через 1,5 секунды рядом с боем — первый, кто наберёт 20/50/100 уничтожений, побеждает.' },
  { id: 'arena', art: 'team', title: 'Арена 3×3', tag: 'БЫСТРЫЙ БОЙ', desc: 'Три на три в плотной схватке. Короткие матчи до 20 уничтожений — идеально на пару минут.' },
  { id: 'duel', art: 'classic', title: 'Дуэль 1×1', tag: 'ОДИН НА ОДИН', desc: 'Ты против одного соперника. Кто первым одержит 7 побед — тот и сильнее.' },
  { id: 'koth', art: 'team', title: 'Царь горы', tag: '5×5 · ТОЧКА', desc: 'Удерживай круг в центре карты. Очки идут, пока на точке только твоя команда. До 90 очков.' },
  { id: 'trench', art: 'team', title: 'Траншеи', tag: '15 × 15 · ДО 15 МИН', desc: 'Новая большая карта: деревня, леса, грязь и линии траншей. Танки проезжают сквозь дома, заборы и деревья — они рушатся. Грязь замедляет и оставляет колею, в траншее — укрытие (-35% урона издалека), но можно застрять. Побеждает команда с бо́льшим числом убийств. Онлайн: до 24 танков, остальные места — боты.' },
  { id: 'hunt', art: 'team', title: 'Охота · BUGA.BUM', tag: '1 ЦЕЛЬ × 5 ОХОТНИКОВ · 10 МИН', desc: 'Новая солнечная карта BUGA.BUM. Цель: 5 жизней, бесконечные патроны, 12 видов ловушек, видит охотников на мини-карте и каждую жизнь — новый сильный танк. Охотники: по 3 жизни, обычные/легендарные танки. Роль меняется каждый раунд.' },
  { id: 'ctf', art: 'team', title: 'Захват флага', tag: '5×5 · ДО 3 ФЛАГОВ', desc: 'Проберись к базе врага, укради флаг и привези к своему. Убей вора — флаг упадёт. Первыми до трёх захватов.' },
  { id: 'race', art: 'br', title: 'Танковые гонки', tag: '3 КРУГА · 8 ТАНКОВ', desc: 'Кольцевая трасса с контрольными точками, ящиками и льдом. Стрелять можно — сбивай соперников и приходи первым.' },
  { id: 'survival', art: 'classic', title: 'Выживание', tag: 'ВОЛНЫ', desc: 'Волны врагов становятся всё сильнее. Три жизни — продержись как можно дольше.' },
  { id: 'coop', art: 'team', title: 'Кооператив 2 игрока', tag: 'НА ОДНОМ ТЕЛЕФОНЕ', desc: 'Двое за одним телефоном: нижняя половина экрана — игрок 1, верхняя — игрок 2 (сидит напротив). Выживайте вместе против волн.' },
  { id: 'zombie', art: 'br', title: 'Зомби-танки', tag: 'ОРДА', desc: 'Орды быстрых танков-зомби таранят всё на пути. Не подпускай их близко.' },
  { id: 'boss', art: 'classic', title: 'Босс «Мамонт»', tag: 'РЕЙД 4 ИГРОКА', desc: 'Ты и три союзника против огромного бронированного босса и его свиты. 5 минут на победу.' },
  { id: 'sniper', art: 'team', title: 'Снайперы', tag: 'ТОЛЬКО РЕЛЬСОТРОНЫ', desc: 'У всех рельсотроны: медленно, но смертельно. Укрытия решают всё. До 30 уничтожений.' },
  { id: 'classic', title: 'Классика', tag: 'ЗАЩИТА БАЗЫ', desc: 'Легендарный формат: 20 вражеских танков, кирпичные стены и база с орлом. Шесть уровней и бесконечный цикл.' },
];

export class UI {
  constructor(app, root) {
    this.app = app; this.root = root; this.el = h('div', { class: 'pcb-ui' }); root.appendChild(this.el);
    this.toastsEl = h('div', { class: 'toasts' }); root.appendChild(this.toastsEl);
    this.fadeEl = h('div', { class: 'fade' }); root.appendChild(this.fadeEl);
    this.screen = null; this.mode = app.meta.d.lastMode || 'br'; this.previewRaf = 0;
    this.el.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; this.app.audio.play('click'); this.act(b.dataset.a, b.dataset.v, b); });
  }
  get m() { return this.app.meta; }
  get h() { return h; }
  // ---------- infrastructure ----------
  show(name, kids, cls = '') {
    cancelAnimationFrame(this.previewRaf);
    try { if (this.app && this.app.wrap) this.app.wrap.classList.toggle('screen-open', name !== 'menu'); } catch (e) {}
    const olds = [...this.el.querySelectorAll('.scr:not(.gone)')];
    const s = h('div', { class: 'scr ' + cls, data: { name } }, kids);
    const same = olds.length === 1 && this.screen === name && olds[0].classList.contains('on');
    if (same) { // re-render of the same screen: swap instantly, keep scroll and typed text
      const o = olds[0], inp = o.querySelector('input'), ni = inp && inp.id && s.querySelector('#' + inp.id); if (ni) ni.value = inp.value;
      s.classList.add('on'); this.el.replaceChild(s, o); s.scrollTop = o.scrollTop; this.screen = name; return s;
    }
    for (const old of olds) { old.classList.remove('on'); old.classList.add('gone'); setTimeout(() => old.remove(), 260); }
    this.el.appendChild(s); requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('on'))); this.screen = name; return s;
  }
  clear() { cancelAnimationFrame(this.previewRaf); try { if (this.app && this.app.wrap) this.app.wrap.classList.remove('screen-open'); } catch (e) {} for (const s of this.el.querySelectorAll('.scr')) { s.classList.remove('on'); setTimeout(() => s.remove(), 260); } this.screen = null; }
  fade(fn) { this.fadeEl.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => this.fadeEl.classList.remove('on'), 30); }, 260); }
  toast(text, ic = 'star') { const t = h('div', { class: 'toast' }, icon(ic, 18), h('span', null, text)); this.toastsEl.appendChild(t); setTimeout(() => t.remove(), 3100); }
  modal(kids, onAct, opts = {}) {
    const ov = h('div', { class: 'ov' }, h('div', { class: 'modal' }, kids)); this.root.appendChild(ov); const banner = document.getElementById('pb-compat'); if (banner) ov.style.top = Math.ceil(banner.getBoundingClientRect().bottom + 4) + 'px';
    requestAnimationFrame(() => ov.classList.add('on'));
    const close = () => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 220); };
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { this.app.audio.play('click'); const r = onAct ? onAct(b.dataset.m, b, close) : undefined; if (r !== false) close(); } else if (e.target === ov && opts.dismiss !== false) close(); });
    ov.close = close; return ov;
  }
  back() { return h('button', { class: 'iconbtn', data: { a: 'back' } }, icon('back')); }
  curs(btn) { const d = this.m.d, t = btn ? 'button' : 'span', pr = btn ? { class: 'cur', data: { a: 'shop' } } : { class: 'cur' };
    return [h(t, pr, icon('coin', 18), h('span', { data: { k: 'coins' } }, fmtN(d.coins))), h(t, btn ? { class: 'cur', data: { a: 'shop' } } : { class: 'cur' }, icon('gem', 18), h('span', { data: { k: 'gems' } }, fmtN(d.gems)), btn ? h('span', { class: 'plus' }, '+') : null)]; }
  hdr(title, ...extra) { return h('div', { class: 'hdr' }, this.back(), h('h2', null, title), extra); }
  topbar(back) {
    const d = this.m.d, need = xpNeed(d.level);
    return h('div', { class: 'topbar' }, back ? this.back() : null,
      h('div', { class: 'pchip' }, h('div', { class: 'lvl' }, d.level), h('div', null, h('div', { class: 'pname' }, d.name), h('div', { class: 'note', style: 'font-size:11px;color:#ffd23d' }, '★ ' + rankOf(d) + ' · ' + rankInfo(d).pct + '% · танк ур. ' + tankLv((d.tankXp || {})[String(d.model ?? 0)])), h('div', { class: 'xpbar' }, h('i', { style: { width: Math.round(d.xp / need * 100) + '%' } })))),
      h('div', { class: 'grow' }), this.curs(true), this.screen === 'menu' || !back ? h('button', { class: 'gearbtn', data: { a: 'settings' }, title: 'Настройки' }, icon('gear', 22)) : null);
  }
  refreshCurrency() { for (const e of this.root.querySelectorAll('[data-k=coins]')) e.textContent = fmtN(this.m.d.coins); for (const e of this.root.querySelectorAll('[data-k=gems]')) e.textContent = fmtN(this.m.d.gems); }

  // ---------- main menu ----------
  menu() { if (this.app.tour && this.app.tour.pend) { this.app.tour.pend = 0; return this.tourAdvance(!!this.app.tourWin); }
    const d = this.m.d, unclaimed = d.missions.list.filter(x => x.p >= x.goal && !x.claimed).length + (this.m.dailyStatus().available ? 1 : 0);
    const logo = h('div', { class: 'logo' }, h('div', { class: 'word' }, 'PRICOPBUM'.split('').map((c, i) => h('span', { vars: { '--i': String(i) } }, c))), h('div', { class: 'shine' }), h('div', { class: 'bar' }), h('div', { class: 'sub' }, 'ТАНКОВЫЕ СРАЖЕНИЯ'));
    const modes = h('div', { class: 'modes' }, MODES.map(m => h('button', { class: 'mode ' + (m.big ? 'big ' : '') + (m.id === this.mode ? 'sel' : ''), data: { a: 'mode', v: m.id } }, h('canvas', { class: 'art', data: { art: m.art || m.id } }), h('span', { class: 'tag ' + (m.hot ? 'hot' : '') }, m.tag), m.sub ? h('span', { class: 'msub' }, m.sub) : null, h('h3', null, m.title), h('p', null, m.desc))));
    const tiles = [['garage', 'garage', 'Гараж'], ['shop', 'shop', 'Магазин'], ['arsenal', 'shield', 'Арсенал'], ['boxes', 'gift', 'Ящики'], ['catalog', 'garage', 'Каталог'], ['myth', 'star', 'Мифический магазин'], ['missions', 'missions', 'Задания', unclaimed], ['ach', 'trophy', 'Достижения'], ['online', 'globe', 'Онлайн'], ['tour', 'trophy', 'Онлайн-турнир'], ['settings', 'gear', 'Настройки'], ['season', 'star', 'Пропуск · ур. ' + bpTier(d)]];
    // r15: hero tank with 3D-like parallax + battle-pass style rewards strip
    const hero = h('canvas', { class: 'hero' });
    const lv = d.level, path = h('div', { class: 'rpath', data: { a: 'season' } }, h('div', { class: 'rph' }, 'Путь наград'), h('div', { class: 'rps' }, [0, 1, 2, 3, 4, 5].map(k => { const L = lv + k, gem = L % 5 === 0; return h('div', { class: 'rpi' + (k === 0 ? ' cur' : '') }, h('small', null, 'Ур. ' + L), icon(gem ? 'gem' : L % 3 === 0 ? 'gift' : 'coin', 18), h('b', null, gem ? '+' + (5 + Math.floor(L / 5)) : '+' + (100 + L * 25)), k === 0 ? h('i', { style: { width: Math.round(d.xp / xpNeed(lv) * 100) + '%' } }) : null); })));
    const s = this.show('menu', [h('div', { class: 'menu-bg' }), hero, this.topbar(false), logo, path, modes,
      this.optsBar(),
      h('button', { class: 'play', data: { a: 'play' } }, icon('play', 26), 'В БОЙ'),
      h('button', { class: 'play friends', data: { a: 'friends' } }, icon('globe', 24), 'ИГРА С ДРУЗЬЯМИ'),
      h('div', { class: 'grid' }, tiles.map(t => h('button', { class: 'tile', data: { a: t[0] } }, icon(t[1], 26), h('span', null, t[2]), t[3] ? h('span', { class: 'badge' }, t[3]) : null)))]);
    for (const cv of s.querySelectorAll('canvas[data-art]')) drawModeArt(cv, cv.dataset.art);
    if (window.ResizeObserver) { const ro = new ResizeObserver(es => { for (const e of es) { const c = e.target, k = c.clientWidth + 'x' + c.clientHeight; if (c.clientWidth > 40 && c.clientHeight > 40 && c._artK !== k) { c._artK = k; drawModeArt(c, c.dataset.art); } } }); for (const cv of s.querySelectorAll('canvas[data-art]')) ro.observe(cv); } // r28: redraw previews when a tile's size settles (was drawn squashed)
    this.heroLoop(hero);
    const sel = s.querySelector('.mode.sel'); if (sel) setTimeout(() => sel.scrollIntoView({ inline: 'center', block: 'nearest' }), 30);
    this.app.audio.playMusic('menu');
    if (this.pendingRoom && !this._prShown) { this._prShown = true; setTimeout(() => this.friends(), 200); return; }
    if (!d.onboarded) this.onboarding(); else if (this.m.dailyStatus().available && !this._dailyShown) { this._dailyShown = true; setTimeout(() => this.dailyModal(), 500); }
  }
  heroLoop(cv) {
    const R = new Renderer(cv), d = this.m.d; let px = 0, py = 0, tpx = 0, tpy = 0;
    const mv = (e) => { const q = rel(cv, e); tpx = (q.x / (q.w || 1) - 0.5); tpy = (q.y / (q.h || 1) - 0.5); };
    try { window.addEventListener('pointermove', mv); } catch (e) {}
    const tank = { x: 0, y: 0, a: 0, ta: 0, skin: d.skin || 'olive', team: 0, weapon: d.weapon || 'cannon', alive: true, hp: 100, maxHp: 100, tread: 0, shield: 0 };
    const t0 = performance.now(); let last = 0;
    const loop = (now) => {
      if (!cv.isConnected) { try { window.removeEventListener('pointermove', mv); } catch (e) {} return; }
      requestAnimationFrame(loop); if (now - last < 32) return; last = now; // ~30 fps is plenty for the menu backdrop
      const w = cv.clientWidth || 300, hh = cv.clientHeight || 200, dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
      const g = cv.getContext('2d'); if (!g) return; const T = (now - t0) / 1000; px += (tpx - px) * 0.08; py += (tpy - py) * 0.08;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
      // parallax glow rings
      for (let k = 3; k >= 1; k--) { g.fillStyle = 'rgba(255,170,60,' + (0.05 * k) + ')'; g.beginPath(); g.ellipse(w / 2 - px * 14 * k, hh * 0.62 - py * 8 * k, 60 + k * 34, 18 + k * 10, 0, 0, Math.PI * 2); g.fill(); }
      const sc = Math.min(w, hh) / 34; tank.a = T * 0.6; tank.ta = T * 0.6 + Math.sin(T * 0.9) * 0.8; tank.tread = T * 30;
      g.translate(w / 2 + px * 18, hh * 0.55 + py * 10); g.scale(sc, sc * (0.62 + py * 0.08)); // squashed Y = 3D-like tilt
      try { R.drawTank(g, tank, 'br', true, T); } catch (e) {}
    };
    requestAnimationFrame(loop);
  }
  optsBar() {
    const d = this.m.d, df = DIFFS[d.diff ?? 1], sq = d.squad || 1, sqName = { 1: 'Соло', 2: 'Дуо', 3: 'Трио', 4: 'Отряд 4', 5: 'Отряд 5', 20: 'Отряды по 20' };
    return h('div', { class: 'optsbar' },
      h('button', { class: 'opt d' + df.id, data: { a: 'diff' } }, h('small', null, 'Сложность'), df.name),
      
      this.mode === 'br' ? h('button', { class: 'opt', data: { a: 'brsize' } }, h('small', null, 'Карта'), ['Стандарт · 150', 'Гигантская · 150'][this.m.d.brSize ? 1 : 0]) : null,
      this.mode === 'br' ? h('button', { class: 'opt', data: { a: 'squad' } }, h('small', null, 'Команда'), sqName[sq]) : null,
      this.mode === 'ffa' ? h('button', { class: 'opt', data: { a: 'ffaT' } }, h('small', null, 'Цель'), String(d.ffaT || 50) + ' уничт.') : null,
      this.mode === 'arena' ? h('button', { class: 'opt', data: { a: 'arenaF' } }, h('small', null, 'Формат'), ({ 1: '1×1', 2: '2×2', 3: '3×3', ffa6: 'FFA до 6' })[d.arenaF || 3]) : null,
      this.mode !== 'classic' ? h('button', { class: 'opt', data: { a: 'maps' } }, h('small', null, 'Карта'), mapLabel(d)) : null);
  }
  refreshOpts() { const o = this.el.querySelector('.optsbar'); if (o) o.replaceWith(this.optsBar()); }
  dailyModal() {
    const st = this.m.dailyStatus(); if (!st.available) return;
    const strip = DAILY.map((r, i) => h('div', { class: i < st.day ? 'done' : i === st.day ? 'cur' : '' }, 'День ' + (i + 1), icon(r.gems && !r.coins ? 'gem' : 'coin', 18), h('span', null, r.coins || r.gems)));
    const canAd = this.app.Ads.canRewarded();
    this.modal([h('div', { style: 'color:#ffd23d' }, icon('gift', 44)), h('h3', null, 'Ежедневная награда'), h('p', null, 'Заходи каждый день — награды растут. Серия: ' + (st.day + 1) + ' из 7.'), h('div', { class: 'daily' }, strip),
      h('div', { class: 'btns' }, h('button', { class: 'btn y big', data: { m: 'claim' } }, 'Забрать'), canAd ? h('button', { class: 'btn b big', data: { m: 'x2' } }, icon('ad', 20), 'Смотреть рекламу: x2 награда') : null)], (a) => {
      if (a === 'claim') { const r = this.m.claimDaily(1); this.rewardToast(r); }
      if (a === 'x2') { this.app.Ads.showRewarded('daily_x2').then(ok => { const r = this.m.claimDaily(ok ? 2 : 1); this.rewardToast(r); }); }
      if (this.screen === 'menu') this.menu();
    }, { dismiss: false });
  }
  rewardToast(r) { if (!r) return; this.app.audio.play('coin'); this.toast('Получено: ' + (r.coins ? '+' + r.coins * (r.mult || 1) + ' монет ' : '') + (r.gems ? '+' + r.gems * (r.mult || 1) + ' кристаллов' : ''), 'gift'); this.refreshCurrency(); }
  confirmBtns(...b) { return h('div', { class: 'btns' }, b.map(([cls, m, label]) => h('button', { class: 'btn big ' + cls, data: { m } }, label))); }
  act(a, v, b) {
    const app = this.app;
    switch (a) {
      case 'shl': { const d = this.m.d, L = normLoadout(d.loadout || DEFAULT_LOADOUT), [id, dv] = v.split(':'), tot = Object.values(L.shells).reduce((a, b) => a + b, 0); const nv = Math.max(0, (L.shells[id] || 0) + Math.min(+dv, SHELL_CAP - tot)); L.shells[id] = nv; d.loadout = normLoadout(L); this.m.save(); this.app.audio.play('click'); this.garage('shells'); break; }
      case 'eqp': { const d = this.m.d, L = normLoadout(d.loadout || DEFAULT_LOADOUT); L.equip = L.equip.includes(v) ? L.equip.filter(e => e !== v) : [...L.equip, v]; d.loadout = normLoadout(L); this.m.save(); this.app.audio.play('click'); this.garage('equip'); break; }
      case 'diff': { const d = this.m.d; d.diff = ((d.diff ?? 1) + 1) % DIFFS.length; this.m.save(); this.refreshOpts(); this.toast('Сложность: ' + DIFFS[d.diff].name + ' · награды ×' + DIFFS[d.diff].rew, 'star'); break; }
      case 'arenaF': { const d = this.m.d, i = ARENA_FORMATS.indexOf(d.arenaF || 3); d.arenaF = ARENA_FORMATS[(i + 1) % ARENA_FORMATS.length]; this.m.save(); this.refreshOpts(); break; }
      case 'maps': mapPicker(this, () => this.refreshOpts()); break;
      case 'ffaT': { const d = this.m.d, i = FFA_TARGETS.indexOf(d.ffaT || 50); d.ffaT = FFA_TARGETS[(i + 1) % FFA_TARGETS.length]; this.m.save(); this.refreshOpts(); break; }
      case 'brsize': { const d = this.m.d; d.brSize = d.brSize ? 0 : 1; this.m.save(); this.refreshOpts(); this.toast(d.brSize ? 'Гигантская карта 600×600 · 150 танков на сервере этой сборки. Старый публичный сервер этого режима не имеет.' : 'Стандартная карта · 150 танков на сервере этой сборки', 'star'); break; }
      case 'squad': { const d = this.m.d, i = SQUADS.indexOf(d.squad || 1); d.squad = SQUADS[(i + 1) % SQUADS.length]; this.m.save(); this.refreshOpts(); break; }
      case 'mode': this.mode = v; this.m.d.lastMode = v; this.m.save(); for (const e of this.el.querySelectorAll('.mode')) e.classList.toggle('sel', e.dataset.v === v); this.refreshOpts(); b.scrollIntoView({ inline: 'center', block: 'nearest' }); break;
      case 'play': if (this.mode === 'cbr') this.cbrSetup(); else this.tankSelect(() => app.startLocal(this.mode === 'br' && this.m.d.brSize ? 'brg' : this.mode)); break;
      case 'tanks': this.tankSelect(null); break;
      case 'back': this.menu(); break;
      case 'garage': this.garage('weapons'); break;
      case 'season': this.season(); break;
      case 'tour': this.tourMenu(); break;
      case 'arsenal': this.arsenal(); break;
      case 'boxes': this.boxes(); break;
      case 'catalog': this.catalogScr(); break;
      case 'myth': this.mythShop(); break;
      case 'gtab': this.garage(v); break;
      case 'shop': this.shop(); break;
      case 'missions': this.missions(); break;
      case 'ach': this.achievements(); break;
      case 'online': this.online(); break;
      case 'friends': this.friends(); break;
      case 'settings': this.settings(); break;
      case 'news': this.whatsNew(); break;
      case 'buyw': if (this.m.buyWeapon(v)) { app.audio.play('weapon'); this.toast('Открыто: ' + WEAPONS[v].name, 'check'); this.m.checkAch().forEach(x => this.achToast(x)); } else this.noMoney(); this.garage('weapons'); break;
      case 'eqw': this.m.d.weapon = v; this.m.save(); app.audio.play('pick'); this.garage('weapons'); break;
      case 'upg': if (this.m.upgrade(v)) { app.audio.play('levelup'); this.toast(UPGRADES[v].name + ': уровень ' + this.m.d.up[v], 'star'); this.m.checkAch().forEach(x => this.achToast(x)); } else this.noMoney(); this.garage('up'); break;
      case 'buys': { const s = SKINS[v]; if (s.cur === 'iap') { app.IAP.purchase(s.iap).then(ok => { if (ok) { this.m.d.skin = v; this.m.save(); this.toast('Раскраска получена!', 'check'); } this.garage('skins'); }); break; } if (this.m.buySkin(v)) { app.audio.play('weapon'); this.m.d.skin = v; this.m.save(); this.m.checkAch().forEach(x => this.achToast(x)); } else this.noMoney(s.cur); this.garage('skins'); break; }
      case 'eqs': this.m.d.skin = v; this.m.save(); app.audio.play('pick'); this.garage('skins'); break;
      case 'iap': app.IAP.purchase(v).then(ok => { if (ok) { app.audio.play('levelup'); this.toast('Покупка выполнена', 'check'); } this.shop(); }); break;
      case 'adcoins': app.Ads.showRewarded('shop_coins').then(ok => { if (ok) { this.m.addCoins(15, false); app.audio.play('coin'); this.toast('+15 монет', 'coin'); } this.shop(); }); break;
      case 'exch': { const [g, c] = v.split(':').map(Number); if (this.m.spend('gems', g)) { this.m.addCoins(c, false); app.audio.play('coin'); this.toast('+' + c + ' монет', 'coin'); } else this.noMoney('gems'); this.shop(); break; }
      case 'restore': app.IAP.restore().then(() => this.toast('Покупки восстановлены', 'check')); break;
      case 'claimm': { const r = this.m.claimMission(+v); if (r) { app.audio.play('coin'); this.toast('+' + r + ' монет', 'coin'); } this.missions(); break; }
      case 'daily': this.dailyModal(); break;
      case 'set': { const s = this.m.d.settings; s[v] = !s[v]; this.m.save(); app.applySettings(); this.settings(); break; }
      case 'aimlv': { const v = this.m.d.settings.aimAssist, c = v === true ? 2 : v === false ? 0 : (v | 0); this.m.d.settings.aimAssist = (c + 1) % 4; this.m.save(); this.settings(); break; }
      case 'chatm': { const st = this.m.d.settings; st.chat = ((st.chat ?? 1) + 1) % 3; this.m.save(); if (this.app.hud) this.app.hud.chatMode = st.chat; this.settings(); break; }
      case 'lang': this.langPicker(); break;
      case 'orient': { this.app.cycleOrient(); this.settings(); break; }
      case 'orientm': { const n = this.app.cycleOrient(); this.refreshOpts(); this.toast('Ориентация: ' + n); break; }
      case 'camera': this.m.d.settings.camera = [1, 3, 0, 2][this.m.d.settings.camera ?? 0] ?? 1; this.m.save(); this.settings(); break;
      case 'post': this.m.d.settings.post = this.m.d.settings.post === false; this.m.save(); this.settings(); break;
      case 'weather': this.m.d.settings.weather = ((this.m.d.settings.weather ?? 0) + 1) % 8; this.m.save(); this.settings(); break;
      case 'joy': this.m.d.settings.joy = ((this.m.d.settings.joy ?? 1) + 1) % 4; this.m.save(); if (app.computeLayout) app.computeLayout(); this.settings(); break;
      case 'quality': this.m.d.settings.quality = ({ 0: 1, 1: 2, 2: 4, 4: 3, 3: 0 })[this.m.d.settings.quality ?? 3]; this.m.save(); app.applySettings(); this.settings(); break;
      case 'flag': this.flagPicker(); break;
      case 'rename': { const i = this.el.querySelector('#pcb-name'); const n = (i.value || '').trim().slice(0, 14); if (n) { this.m.d.name = n; this.m.save(); this.toast('Имя сохранено', 'check'); } break; }
      case 'privacy': this.privacy(); break;
      case 'reset': this.modal([h('h3', null, 'Сбросить прогресс?'), h('p', null, 'Все монеты, улучшения и достижения будут удалены. Покупки можно восстановить.'), this.confirmBtns(['r', 'yes', 'Сбросить'], ['', 'no', 'Отмена'])], (x) => { if (x === 'yes') { this.m.reset(); this.toast('Прогресс сброшен', 'refresh'); this.menu(); } }); break;
      case 'connect': { const i = this.el.querySelector('#pcb-srv'); app.net.connect((i.value || '').trim()); break; }
      case 'disconnect': app.net.disconnect(); this.online(); break;
      case 'qm': app.net.quickMatch(v); break;
      case 'roomVar': { const i = ONLINE_V.findIndex(x => x[0] === (this.roomVar || 'team')); this.roomVar = ONLINE_V[(i + 1) % ONLINE_V.length][0]; this.online(); break; }
      case 'roomCreate': app.net.createRoom(this.roomVar || 'team'); break;
      case 'roomJoin': { const el = this.el.querySelector('#pcb-code'); const code = el ? el.value : ''; if (!/^[A-Za-z0-9]{5}$/.test(code.trim())) { this.toast('Код — 5 символов', 'info'); break; } app.net.joinRoom(code); break; }
      case 'bthost': app.bt.host(); break;
      case 'btjoin': app.bt.join(); break;
      case 'btpick': app.bt.pick(v); break;
      case 'btstart': app.bt.startMatch(v); break;
      case 'btstop': app.bt.stop(); this.online(); break;
      case 'tutorial': this.tutorial(); break;
    }
  }
  noMoney(cur = 'coins') { this.app.audio.play('lose'); this.modal([h('div', null, icon(cur === 'gems' ? 'gem' : 'coin', 44)), h('h3', null, 'Не хватает ' + (cur === 'gems' ? 'кристаллов' : 'монет')), h('p', null, 'Играй бои, выполняй задания или загляни в магазин.'), this.confirmBtns(['y', 'shop', 'В магазин'], ['', 'ok', 'Понятно'])], (x) => { if (x === 'shop') this.shop(); }); }
  achToast(a) { this.app.audio.play('levelup'); this.toast('Достижение: ' + a.name + ' (+' + a.gems + ' кристаллов)', 'trophy'); }
  okBadge(txt) { return h('span', { class: 'btn g', style: 'pointer-events:none' }, txt || icon('check', 16)); }
  btn(cls, a, v, ...kids) { return h('button', { class: 'btn ' + cls, data: { a, v } }, kids); }
  card(cls, thumb, title, desc, action) { return h('div', { class: 'card ' + (cls || '') }, thumb, h('div', { class: 'grow' }, h('div', { class: 'ttl' }, title), desc != null ? h('div', { class: 'ds' }, desc) : null), action); }
  note(t, style) { return h('div', { class: 'note', style }, t); }

  // ---------- garage ----------
  garage(tab = this.lastGTab || 'weapons') { this.lastGTab = tab;
    const d = this.m.d, lv = d.up;
    const w = WEAPONS[d.weapon];
    const statK = { dmg: w.dmg * (1 + 0.07 * lv.dmg) / (w.reload * Math.pow(0.94, lv.reload)) / 160, armor: (100 * (1 + 0.1 * lv.armor)) / 150, speed: (1 + 0.05 * lv.engine) / 1.25, range: w.speed * w.life / 420 };
    const stats = [['Огневая мощь', statK.dmg], ['Броня', statK.armor], ['Скорость', statK.speed], ['Дальность', statK.range]].map(s => h('div', { class: 'stat' }, h('b', null, s[0]), h('div', { class: 'sb' }, h('i', { style: { width: Math.min(100, Math.round(s[1] * 100)) + '%' } }))));
    let body;
    if (tab === 'weapons') body = SHOP_WEAPONS.map(id => { const W = WEAPONS[id], own = d.weapons.includes(id), eq = d.weapon === id;
      return this.card(eq ? 'eq' : '', h('div', { style: 'width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,.3);display:grid;place-items:center' }, h('i', { style: { width: '22px', height: '6px', borderRadius: '3px', background: W.color, boxShadow: '0 0 10px ' + W.color } })), W.name, weaponDesc(id),
        eq ? this.okBadge() : own ? this.btn('', 'eqw', id, 'Выбрать') : d.mb && d.mb.weapon === id ? this.okBadge('На 1 бой') : this.btn('y', 'buyw', id, icon('coin', 16), '10 · на 1 бой')); });
    else if (tab === 'up') body = [Object.keys(UPGRADES).map(k => { const U = UPGRADES[k], l = Math.min(U.max, lv[k] + ((d.mb && d.mb.up[k]) || 0)), c = this.m.upgradeCost(k);
      return h('div', { class: 'card' }, h('div', { class: 'grow' }, h('div', { class: 'ttl' }, U.name + ' ', h('span', { class: 'note' }, '+' + Math.round(U.per * 100) + '% за уровень')), h('div', { class: 'pips' }, Array.from({ length: U.max }, (_, i) => h('i', { class: i < l ? 'on' : '' })))),
        c == null ? this.okBadge('МАКС') : this.btn('y', 'upg', k, icon('coin', 16), fmtN(c) + ' · на 1 бой')); }),
      h('p', { class: 'note', style: 'margin:6px 4px' }, 'Уровни, купленные за монеты, действуют только в одном следующем бою (на 1 бой), затем исчезают. Предел прокачки одинаковый для всех — честная игра.')];
    else if (tab === 'shells' || tab === 'equip') { const L = normLoadout(d.loadout || DEFAULT_LOADOUT); const tot = Object.values(L.shells).reduce((a, b) => a + b, 0);
      body = tab === 'shells' ? [h('p', { class: 'note', style: 'margin:6px 4px' }, 'Боекомплект: ' + tot + ' / ' + SHELL_CAP + ' спецснарядов. Бронебойные — бесконечно. В бою: кнопка снаряда (N) переключает, ▾ — выбор.'),
        ...SHELLS.filter(S => !S.crate).map(S => { const n = S.id === 'ap' ? '∞' : (L.shells[S.id] || 0); return this.card('', h('div', { style: { width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0,0,0,.3)', display: 'grid', placeItems: 'center', color: S.col, font: '900 13px system-ui', border: '2px solid ' + S.col } }, S.short), S.name + ' · ' + n, S.desc,
          S.id === 'ap' ? this.okBadge('∞') : h('div', { style: 'display:flex;gap:4px' }, this.btn('', 'shl', S.id + ':-2', '−'), this.btn('y', 'shl', S.id + ':2', '+'))); })]
      : [h('p', { class: 'note', style: 'margin:6px 4px' }, 'Слоты снаряжения: ' + L.equip.length + ' / ' + EQUIP_SLOTS + (L.equip.length ? ' — ' + L.equip.map(e => EQUIP.find(q => q.id === e).name).join(', ') : '')),
        ...EQUIP.map(E => { const on = L.equip.includes(E.id); return this.card(on ? 'eq' : '', h('div', { style: 'width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,.3);display:grid;place-items:center' }, icon('star', 20)), E.name, E.desc, on ? this.btn('', 'eqp', E.id, 'Снять') : L.equip.length >= EQUIP_SLOTS ? this.okBadge('Слоты заняты') : this.btn('y', 'eqp', E.id, 'Установить')); })]; }
    else body = SKIN_LIST.map(id => { const S = SKINS[id], own = d.skins.includes(id), eq = d.skin === id;
      const price = S.cur === 'iap' ? this.btn('b', 'buys', id, (PRODUCTS.find(p => p.id === S.iap) || {}).price, h('span', { class: 'demo-tag' }, 'ДЕМО')) : this.btn('y', 'buys', id, icon(S.cur === 'gems' ? 'gem' : 'coin', 16), S.price);
      return this.card(eq ? 'eq' : '', h('div', { style: { width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(145deg,' + S.light + ',' + S.body + ' 50%,' + S.dark + ')', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.25)' } }), S.name, 'Только внешний вид',
        eq ? this.okBadge() : own ? this.btn('', 'eqs', id, 'Выбрать') : price); });
    const tabBtn = (v, t) => h('button', { class: tab === v ? 'on' : '', data: { a: 'gtab', v } }, t);
    const kids = [h('div', { class: 'menu-bg' }), this.hdr('Гараж', this.curs(false)),
      h('div', { class: 'prev' }, h('canvas', { id: 'pcb-prev' })), h('div', { class: 'panel', style: 'margin-top:8px;padding:8px 12px' }, stats),
      h('div', { class: 'tabs' }, tabBtn('weapons', 'Оружие'), tabBtn('up', 'Улучшения'), tabBtn('skins', 'Раскраски'), tabBtn('shells', 'Снаряды'), tabBtn('equip', 'Снаряжение'), h('button', { data: { a: 'tanks' } }, 'Танки (' + 108 + ')')), h('div', { class: 'scroll' }, body)];
    const keep = this.screen === 'garage'; const s = keep ? this.el.querySelector('.scr') : this.show('garage', kids);
    if (keep) fill(s, kids);
    this.startPreview(s.querySelector('#pcb-prev'));
  }
  startPreview(cv) {
    cancelAnimationFrame(this.previewRaf); if (!cv) return;
    const r = new Renderer(cv); const d = this.m.d; const t0 = performance.now();
    const loop = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext('2d'), time = (performance.now() - t0) / 1000; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(dpr * 4.2, 0, 0, dpr * 4.2, cv.width / 2, cv.height / 2 + 6 * dpr);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 6, 16, 5, 0, 0, Math.PI * 2); g.fill();
      const tank = { x: 0, y: 0, a: -0.5 + Math.sin(time * 0.6) * 0.25, ta: -0.5 + Math.sin(time * 0.9) * 0.9, skin: d.skin, weapon: d.weapon, team: 0, tread: time * 12, recoil: Math.max(0, 1 - ((time % 2.2) * 4)), hitT: 0, inv: 0, shield: 0, speedT: 0, powerT: 0, id: 1 };
      r.drawTank(g, tank, 'br', true, time);
      this.previewRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  // ---------- shop ----------
  shop() {
    const d = this.m.d, IAP = this.app.IAP, demo = IAP.demo;
    const ios = !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios');
    const thumb = (ic, sz, color) => h('div', { style: 'width:48px;display:grid;place-items:center' + (color ? ';color:' + color : '') }, icon(ic, sz));
    const payBtn = (p, cls) => { const b = this.btn(cls, 'iap', p.id, IAP.busy === p.id ? '…' : IAP.priceOf(p)); if (IAP.busy === p.id) b.disabled = true; return b; };
    const gemPacks = PRODUCTS.filter(p => p.id.startsWith('gems_')).map(p => this.card('', thumb('gem', 36), [p.title, p.badge ? [' ', h('span', { class: 'demo-tag', style: 'background:#2fbf5a' }, p.badge)] : null], 'Кристаллы — для раскрасок и обмена на монеты', payBtn(p, 'b')));
    const coinPacks = PRODUCTS.filter(p => p.id.startsWith('coins_')).map(p => this.card('', thumb('coin', 34, '#ffd23d'), [p.title, p.badge ? [' ', h('span', { class: 'demo-tag', style: 'background:#2fbf5a' }, p.badge)] : null], (ios ? 'App Store: ' : 'Google Play: ') + p.id, payBtn(p, 'y')));
    const special = PRODUCTS.filter(p => !p.id.startsWith('gems_') && !p.id.startsWith('coins_')).map(p => { const own = IAP.owned(p.id) || (p.id === 'season_pass' && d.bp && d.bp.prem); return this.card(own ? 'eq' : '', thumb(p.id === 'remove_ads' ? 'shield' : p.id === 'starter_pack' ? 'gift' : 'crown', 32, '#ffd23d'), p.title, p.desc || '', own ? this.okBadge() : payBtn(p, 'b')); });
    const canAd = this.app.Ads.canRewarded(), daily = this.m.dailyStatus().available;
    const adBtn = this.btn('g', 'adcoins', null, 'Смотреть'); adBtn.disabled = !canAd;
    const dBtn = this.btn('y', 'daily', null, 'Забрать'); dBtn.disabled = !daily;
    const sec = (t, top) => this.note(t, 'margin:' + (top || 10) + 'px 4px 6px');
    const close = h('button', { class: 'iconbtn shop-close-btn', data: { a: 'back' }, title: 'Закрыть' }, icon('back'), h('span', { class: 'shop-close' }, 'Закрыть'));
    this.show('shop', [h('div', { class: 'menu-bg' }), h('div', { class: 'hdr' }, close, h('h2', null, 'Магазин'), this.curs(false)), h('div', { class: 'scroll' },
      sec('МОНЕТЫ', 4), coinPacks, ios ? this.note('Монеты из App Store зачисляются на серверный счёт, не на кошелёк устройства.', 'margin:0 4px 8px') : null,
      demo ? h('div', { class: 'panel', style: 'margin-bottom:10px;border-color:rgba(255,59,59,.5)' }, h('span', { class: 'demo-tag' }, 'ДЕМО'), ' ', h('span', { class: 'note' }, 'Веб-версия: покупки и реклама имитируются, деньги не списываются. В Android-версии подключаются Google Play Billing и AdMob.')) : null,
      sec('БЕСПЛАТНО'), this.card('', thumb('ad', 32, '#5cc2ff'), '+15 монет', 'За просмотр рекламы' + (canAd ? '' : ' — лимит на сегодня исчерпан'), adBtn),
      this.card('', thumb('gift', 32, '#ffd23d'), 'Ежедневная награда', daily ? 'Доступна!' : 'Возвращайся завтра', dBtn),
      sec('ОСОБОЕ'), special, sec('КРИСТАЛЛЫ'), gemPacks, sec('ОБМЕН'),
      [[20, 60], [50, 170], [120, 450]].map(([g, c]) => this.card('', thumb('coin', 32), fmtN(c) + ' монет', null, this.btn('y', 'exch', g + ':' + c, icon('gem', 16), g))),
      h('div', { style: 'text-align:center;margin-top:10px' }, this.btn('', 'restore', null, icon('refresh', 16), 'Восстановить покупки')),
      h('p', { class: 'note', style: 'text-align:center;margin-top:10px' }, 'Монеты тратятся в «Арсенале» и гараже. В онлайн-боях действуют «равные условия»: улучшения ограничены 2-м уровнем, запас в бою недоступен.'))]);
  }
  // ---------- missions ----------
  missions() {
    this.m.refreshMissions(); const d = this.m.d, st = this.m.dailyStatus();
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0); const left = Math.max(0, mid - now), hh = Math.floor(left / 3600000), mm = Math.floor(left % 3600000 / 60000);
    const list = d.missions.list.map((m, i) => { const b = this.btn('y', 'claimm', String(i), 'Забрать'); b.disabled = m.p < m.goal;
      return h('div', { class: 'card ' + (m.claimed ? 'eq' : '') }, h('div', { class: 'grow' }, h('div', { class: 'ttl' }, m.text), h('div', { class: 'prog' }, h('i', { style: { width: Math.round(m.p / m.goal * 100) + '%' } })), h('div', { class: 'ds' }, fmtN(m.p) + ' / ' + fmtN(m.goal) + ' · награда ' + m.reward + ' монет')), m.claimed ? this.okBadge() : b); });
    const strip = DAILY.map((r, i) => { const dd = st.available ? st.day : (d.daily.streak - 1) % 7; const cls = i < dd || (!st.available && i === dd) ? 'done' : (i === dd && st.available ? 'cur' : ''); return h('div', { class: cls }, String(i + 1), icon(r.gems && !r.coins ? 'gem' : 'coin', 16), h('span', null, r.coins || r.gems)); });
    this.show('missions', [h('div', { class: 'menu-bg' }), this.hdr('Задания'), h('div', { class: 'scroll' },
      h('div', { class: 'panel' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, 'Ежедневная награда'), st.available ? this.btn('y', 'daily', null, 'Забрать') : h('span', { class: 'note' }, 'завтра')), h('div', { class: 'daily' }, strip)),
      this.note('ЗАДАНИЯ ДНЯ · обновятся через ' + hh + ' ч ' + mm + ' мин', 'margin:12px 4px 6px'), list)]);
  }
  achievements() {
    const d = this.m.d, st = d.stats; const got = ACHIEVEMENTS.filter(a => d.ach[a.id]).length;
    const list = ACHIEVEMENTS.map(a => { const v = Math.min(a.goal, st[a.stat] || 0), ok = !!d.ach[a.id];
      return h('div', { class: 'ach ' + (ok ? 'got' : '') }, h('div', { class: 'medal' }, icon(ok ? 'trophy' : 'lock', 22)), h('div', { class: 'grow' }, h('div', { class: 'ttl', style: 'font-size:14px' }, a.name), h('div', { class: 'ds note' }, a.desc), ok ? null : h('div', { class: 'prog' }, h('i', { style: { width: Math.round(v / a.goal * 100) + '%' } }))), h('span', { class: 'cur' }, icon('gem', 16), a.gems)); });
    const sum = [['Боёв', st.matches], ['Уничтожений', st.kills], ['Побед КБ', st.brWins], ['Побед 10×10', st.teamWins]].map(x => h('div', null, fmtN(x[1]), h('small', null, x[0])));
    this.show('ach', [h('div', { class: 'menu-bg' }), this.hdr('Достижения', h('span', { class: 'note' }, got + ' / ' + ACHIEVEMENTS.length)), h('div', { class: 'stats3', style: 'grid-template-columns:repeat(4,1fr);position:relative;z-index:2' }, sum), h('div', { class: 'scroll' }, list)]);
  }
  // ---------- settings ----------
  settings() {
    const s = this.m.d.settings, row = (label, ctl, style) => h('div', { class: 'setrow', style }, h('span', { class: 'grow' }, label), ctl);
    const vol = (k, label, def) => row(label, h('input', { type: 'range', class: 'vol', min: 0, max: 100, step: 5, value: Math.round((s[k] ?? def) * 100), oninput: (e) => { s[k] = (+e.target.value) / 100; this.m.save(); this.app.applySettings(); } }));
    const tog = (k, label) => row(label, h('button', { class: 'tog ' + (s[k] ? 'on' : ''), data: { a: 'set', v: k } }));
    const B = !!this.setOv; // r19: same settings as an in-battle overlay (⚙ in the HUD)
    const rows = [

      tog('sfx', 'Звуковые эффекты'), tog('music', 'Музыка'), vol('musVol', 'Громкость музыки', 0.8), vol('sfxVol', 'Громкость эффектов', 1), tog('vibro', 'Вибрация'), vol('sens', 'Чувствительность стиков', 0.5), vol('joyA', 'Прозрачность джойстиков', 1), row('Помощь в стрельбе', this.btn('', 'aimlv', null, ['Выкл', 'Слабая', 'Средняя', 'Сильная'][s.aimAssist === true ? 2 : s.aimAssist === false ? 0 : (s.aimAssist | 0)])), tog('leftHanded', 'Левша (поменять стики)'),
      row('Размер джойстиков', this.btn('', 'joy', null, ['Маленький', 'Обычный', 'Большой', 'Очень большой'][s.joy ?? 1])),
      row('Графика', this.btn('', 'quality', null, ['Низкое', 'Среднее', 'Высокое', 'Авто', 'Ультра'][s.quality ?? 3])),
      
      row('Камера', this.btn('', 'camera', null, ['Сверху', '3-е лицо', 'Дрон', '3-е лицо (близко)'][Math.min(3, s.camera ?? 0)])),
      row('Чат', this.btn('', 'chatm', null, ['Обычный', 'Мелкий', 'Выкл'][s.chat ?? 1])),
      row('Что нового (1.0.2)', this.btn('y', 'news', null, 'Открыть')),
      row('Язык', this.btn('', 'lang', null, langName())),
      row('Эффекты WebGL (свечение, цвет)', this.btn('', 'post', null, s.post === false ? 'Выкл' : 'Вкл')),
      row('Погода и время суток', this.btn('', 'weather', null, ['Случайно', 'Без погоды (день)', 'День', 'Закат', 'Ночь', 'Ливень', 'Туман', 'Снегопад'][s.weather ?? 0])),
      h('div', { class: 'setrow', style: 'gap:8px' }, h('input', { id: 'pcb-name', class: 'inp', maxLength: 14, value: this.m.d.name, placeholder: 'Имя игрока' }), this.btn('y', 'rename', null, 'OK')),
      row('Флаг страны', this.btn('', 'flag', null, flagEmoji(this.m.d.cc || ccFromLocale(navigator.language)) + ' ' + (this.m.d.cc || ccFromLocale(navigator.language)))),
      row('Как играть', this.btn('', 'tutorial', null, 'Открыть')), row('Политика конфиденциальности', this.btn('', 'privacy', null, 'Открыть')),
      row('Сбросить прогресс', this.btn('r', 'reset', null, 'Сброс'), 'border:0')];
    if (B) { const keep = rows.filter(r => r && !r.querySelector('#pcb-name,[data-a=tutorial],[data-a=privacy],[data-a=reset]')); const M = this.setOv.querySelector('.modal'), sc = M.querySelector('.scroll'), y = sc ? sc.scrollTop : 0;
      fill(M, h('h3', null, icon('gear', 20), ' Настройки'), h('div', { class: 'scroll setscroll' }, h('div', { class: 'panel' }, keep)), h('button', { class: 'btn y big', data: { m: 'close' } }, 'Продолжить')); const n = M.querySelector('.scroll'); if (n) n.scrollTop = y; return; }
    this.show('settings', [h('div', { class: 'menu-bg' }), this.hdr('Настройки'), h('div', { class: 'scroll' }, h('div', { class: 'panel' }, rows),
      h('p', { class: 'note', style: 'text-align:center;margin-top:12px' }, 'PRICOPBUM · версия ' + this.app.version, br(), 'Игра создана PRICOP.studio · © 2026', br(), 'Шрифт Russo One — SIL Open Font License'))]);
  }
  settingsBattle(onClose) { if (this.setOv) return; const ov = this.modal([], (m) => { if (m === 'close') { this.setOv = null; onClose && onClose(); } }, { dismiss: false }); ov.classList.add('setov'); this.setOv = ov;
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; this.app.audio.play('click'); this.act(b.dataset.a, b.dataset.v, b); }); this.settings(); }
  tutorial() {
    const B = (t) => h('b', null, t);
    this.modal([h('h3', null, 'Как играть'), h('p', { style: 'text-align:left' }, B('Левый палец'), ' — движение: коснись в любом месте левой половины экрана и веди.', br(), B('Правый палец'), ' — огонь: тап — выстрел по ближайшей цели, удержание — автоогонь, свайп — ручное прицеливание.', br(), B('Клавиатура:'), ' WASD/стрелки — движение, мышь — прицел, ЛКМ/пробел — огонь, E — взять, Esc — пауза.', br(), br(),
      B('Кусты'), ' скрывают танк от врагов. ', B('Кирпич'), ' разрушается, ', B('сталь'), ' — только рельсотроном. По ', B('льду'), ' танк скользит, по ', B('воде'), ' можно ехать медленно — 30 с безопасно, потом гибнут броня и корпус.', br(), B('Боевой дрон'), ' — 15 с охраняет танк и стреляет (500 патронов); ', B('Легендарный дрон'), ' ещё и сбрасывает аптечку.', br(), B('3 жизни'), ' в каждом режиме; дополнительную жизнь можно купить за монеты.', br(), B('Модули'), ' — 32 вида с редкостью и уровнем 1–3: щит, активная защита, шипы, отвал, радар и др.', br(), B('Невидимка'), ' — 10 с враги вас не видят; выстрел или урон раскрывает.', br(), B('Звания'), ' растут за победы и уничтожения, за поражения очки снимаются.', br(), B('Онлайн-турнир'), ' — сетка на 16 или 32 игрока, выбывшие могут смотреть бои.', br(), B('Спаренные ракеты'), ' — 2 мощные самонаводящиеся ракеты на корпусе: «Пуск» стреляет, «Ловушка» ставит их на землю — они сами взлетят по врагу. Ловушку и летящие ракеты можно сбить.', br(), B('Детали'), ' (гусеницы, корпус, башня, ствол, экраны) меняют вид танка; у каждой есть редкость и уровень 1–3.', br(), B('Ящики'), ' содержат аптечки, броню, боеприпасы и новое оружие — подъедь и нажми «ВЗЯТЬ».'),
      this.confirmBtns(['y', 'ok', 'Понятно'])]);
  }
  privacy() {
    this.modal([h('h3', null, 'Конфиденциальность'), h('p', { style: 'text-align:left' }, 'PRICOPBUM хранит прогресс только на вашем устройстве. В веб-версии реклама и покупки работают в демо-режиме и не передают данные. В Android-версии используются Google AdMob (реклама) и Google Play Billing (покупки) — они могут обрабатывать рекламный идентификатор устройства согласно политике Google. В онлайн-режиме на сервер передаются только имя игрока и игровые действия. Полная версия политики прилагается к странице приложения в магазине.'), this.confirmBtns(['', 'ok', 'Закрыть'])]);
  }
  // ---------- online / bluetooth ----------
  online() {
    const net = this.app.net, bt = this.app.bt, st = net.status;
    const srv = this.m.d.server || net.defaultUrl();
    const connected = st === 'online';
    const col = (...k) => h('div', { class: 'btns', style: 'display:flex;flex-direction:column;gap:8px' }, k);
    this.show('online', [h('div', { class: 'menu-bg' }), this.hdr('Онлайн'), h('div', { class: 'scroll' },
      h('div', { class: 'panel' }, h('div', { class: 'row', style: 'margin-bottom:8px' }, icon('globe', 22), h('span', { class: 'grow' }, 'Игра по сети'), h('span', { class: 'note', id: 'pcb-netst' }, netLabel(st, net))),
        connected ? [h('div', { class: 'qmgrid' }, ONLINE_V.map(([v, n, cls]) => this.btn(cls || '', 'qm', v, n))),
          h('div', { class: 'panel sub' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, 'Комната с друзьями'), h('button', { class: 'opt', data: { a: 'roomVar' } }, h('small', null, 'Режим'), VNAME[this.roomVar || 'team'])),
            h('div', { class: 'btns' }, this.btn('y', 'roomCreate', null, 'Создать комнату')),
            h('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, h('input', { id: 'pcb-code', class: 'inp grow', placeholder: 'Код комнаты', maxLength: 5, autocapitalize: 'characters' }), this.btn('b', 'roomJoin', null, 'Войти'))),
          col(this.btn('', 'disconnect', null, 'Отключиться')), h('p', { class: 'note', style: 'margin-top:8px' }, 'Свободные места в матче занимают боты. Онлайн-бои дают +20% монет и опыта.')]
          : [h('input', { id: 'pcb-srv', class: 'inp', value: srv, placeholder: 'wss://ваш-сервер:8080' }), h('div', { style: 'margin-top:8px' }, this.btn('y big', 'connect', null, 'Подключиться')), h('p', { class: 'note', style: 'margin-top:8px' }, 'Укажите адрес игрового сервера PRICOPBUM (папка server в проекте). Пока сервер не размещён в интернете, онлайн работает в локальной сети или на компьютере разработчика.')]),
      h('div', { class: 'panel', style: 'margin-top:10px' }, h('div', { class: 'row', style: 'margin-bottom:8px' }, icon('bt', 22), h('span', { class: 'grow' }, 'Игра рядом (Bluetooth)'), h('span', { class: 'note' }, bt.statusText())), bt.panel(h, this)))]);
  }
  roomLobby(m) {
    this.closeRoom(); const net = this.app.net, isOwner = m.owner === m.me, team = ['team', 'team20', 'arena', 'koth', 'sniper', 'ctf'].includes(m.variant);
    const mine = m.members.find(x => x.id === m.me) || {};
    this.roomOv = this.modal([h('h3', null, 'Комната'), h('div', { class: 'roomcode' }, m.code), h('p', { class: 'note' }, 'Отправь этот код друзьям: Онлайн → Комната с друзьями → Войти. Свободные места займут боты.'),
      h('p', null, VNAME[m.variant] + ' · игроков ' + m.members.length + ' из ' + m.cap),
      h('div', { class: 'roomlist' }, m.members.map(x => h('div', { class: 'roomm' + (x.team === 0 ? ' t0' : x.team === 1 ? ' t1' : '') }, x.name + (x.id === m.owner ? ' ★' : '') + (x.id === m.me ? ' (вы)' : '')))),
      team ? h('div', { class: 'optsbar' }, [[0, 'Синие'], [1, 'Красные'], [null, 'Авто']].map(([t, n]) => h('button', { class: 'opt' + (mine.team === t ? ' sel' : ''), data: { m: 'team:' + t } }, h('small', null, 'Команда'), n))) : null,
      h('div', { class: 'btns' }, isOwner ? h('button', { class: 'btn y big', data: { m: 'start' } }, '▶ Начать бой') : h('p', { class: 'note' }, 'Ждём, когда создатель комнаты начнёт бой…'), isOwner ? h('button', { class: 'btn b', data: { m: 'var' } }, 'Сменить режим') : null, h('button', { class: 'btn', data: { m: 'leave' } }, 'Выйти из комнаты'))], (a) => {
      if (a === 'start') { net.roomCmd('roomStart'); return false; }
      if (a === 'var') { const i = ONLINE_V.findIndex(x => x[0] === m.variant); net.roomCmd('roomVariant', { variant: ONLINE_V[(i + 1) % ONLINE_V.length][0] }); return false; }
      if (a.startsWith('team:')) { const t = a.slice(5); net.roomCmd('roomTeam', { team: t === 'null' ? null : +t }); return false; }
      if (a === 'leave') { net.roomCmd('roomLeave'); this.roomOv = null; }
    }, { dismiss: false });
  }
  closeRoom() { if (this.roomOv) { this.roomOv.close(); this.roomOv = null; } }
  setNetStatus() { if (this.screen === 'online') this.online(); else if (this.screen === 'friends') { this.friends(); const n = this.app.net; if (this.pendingRoom && n.status === 'online') n.joinRoom(this.pendingRoom); } }
  // ---------- in-game overlays ----------
  pauseMenu(opts) {
    const s = this.m.d.settings;
    const mb = (cls, m, ...k) => h('button', { class: 'btn ' + cls, data: { m } }, k);
    return this.modal([h('h3', null, 'Пауза'), h('div', { class: 'btns' }, mb('y big', 'resume', 'Продолжить'), opts.restart ? mb('big', 'restart', 'Заново') : null, opts.shop ? mb('big', 'arsenal', icon('coin', 18), 'Арсенал') : null,
      h('div', { class: 'row', style: 'gap:8px' }, mb('grow', 'sfx', icon(s.sfx ? 'sound' : 'mute', 18), 'Звук'), mb('grow', 'music', icon(s.music ? 'sound' : 'mute', 18), 'Музыка')), mb('r big', 'quit', 'Выйти в меню'))], (a, b) => {
      if (a === 'sfx' || a === 'music') { s[a] = !s[a]; this.m.save(); this.app.applySettings(); fill(b, icon(s[a] ? 'sound' : 'mute', 18), a === 'sfx' ? 'Звук' : 'Музыка'); return false; }
      opts.on(a);
    }, { dismiss: false });
  }
  demoAd(kind, seconds, done) {
    const c = h('div', { class: 'count' }, seconds), b = h('button', { class: 'btn big', style: 'max-width:260px', disabled: true }, 'Закрыть');
    const box = h('div', { class: 'adbox' }, h('div', { class: 'demo' }, 'ДЕМО-РЕКЛАМА'), h('div', { class: 'adart' }, 'PRICOPBUM'), h('div', { style: 'font-size:15px' }, kind === 'rewarded' ? 'Реклама с наградой' : 'Межстраничная реклама'), h('div', { class: 'note' }, 'В Android-версии здесь показывается реклама AdMob.', br(), 'Сейчас это имитация — ничего не загружается.'), c, b);
    this.root.appendChild(box); this.app.audio.stopMusic();
    let left = seconds;
    const iv = setInterval(() => { left--; c.textContent = left > 0 ? left : '✓'; if (left <= 0) { clearInterval(iv); b.disabled = false; b.textContent = kind === 'rewarded' ? 'Получить награду' : 'Закрыть'; } }, 1000);
    b.addEventListener('click', () => { box.remove(); this.app.resumeMusic(); done(true); });
  }
  whatsNew() { const L = [
      '🪖 Режим «Траншеи»: 15×15, до 15 минут, побеждает команда с большим числом убийств. На этом сервере комната — 30 человек. Королевская битва допускает 150. Оплата деньгами не подключена.',
      '🏔 Королевская битва: холмы, горы и воронки — склоны замедляют, с высоты видно дальше.',
      '🛡 Все танки (игроки и боты, все режимы и карты) получили +25% прочности/брони.',
      '📦 Ящиков с бронёй стало на 30% больше; они видны издалека — значок на мини-карте и световой столб.',
      '🔥 Новый «Ящик с огнём»: 8 коктейлей Молотова — бросок по дуге, горящая зона наносит урон со временем.',
      '⚡ «Ящик с молниями»: 28 снарядов-молний — белые (обычные), синие (легендарные, +10%), красные (мифические, +20%).',
      '🏷 Ящики показывают, что внутри: свой цвет, значок над ящиком и подпись вблизи.',
      '🔧 150 полевых модов на карте: только обычные, +2…5% к одной характеристике, складываются и действуют только в текущем бою.',
      '⬆ Модернизация танков навсегда: легендарные — за монеты (медленно, монеты за бои/победы/рекламу), мифические — только за реальные деньги. Обычные танки навсегда не улучшаются. Боты копят и улучшаются по тем же правилам.',
      '🌞 Новая солнечная карта BUGA.BUM и режим «Охота» 1×5: цель с 5 жизнями, ловушками и новым танком каждую жизнь против 5 охотников.',
      '🛒 Магазин: все вкладки и товары открывают окно покупки на iPhone и Android, в любой ориентации.',
      '📱 iPhone / Safari / ярлык на экране: исправлен кеш — после обновления закройте и откройте игру один раз.'];
    this.modal([h('h3', null, 'Что нового · 1.0.2'), h('div', { class: 'scroll', style: 'max-height:56vh;text-align:left' }, L.map(x => h('p', { style: 'margin:6px 0' }, x))), this.confirmBtns(['y', 'ok', 'Понятно'])]); this.m.d.newsSeen = 'r37'; this.m.save(); }
  langPicker() { const st = this.m.d.settings; this.modal([h('h3', null, 'Язык'), h('div', { class: 'langs' }, LANGS.map(([c, n]) => h('button', { class: 'btn' + (st.lang === c ? ' y' : ''), data: { m: c } }, n)))], (m) => { if (LANGS.some(l => l[0] === m)) { st.lang = m; setLang(m); this.m.save(); this.settings(); } }); }
  demoPurchase(p, done) {
    this.modal([h('h3', { style: 'margin-top:8px' }, p.title), h('p', null, 'Оплата реальными деньгами не подключена. Предмет не выдан.'), this.confirmBtns(['', 'ok', 'Понятно'])], () => { if (done) done(false); }, { dismiss: false });
  }
}
function netLabel(st, net) { return { offline: 'не подключено', connecting: 'подключение…', online: 'в сети · ' + (net.players || 1) + ' игроков', error: 'ошибка подключения', queue: 'поиск матча…' }[st] || st; }
function weaponDesc(id) {
  return { shotgun: 'Веер из 6 дробин — страшен вблизи, бесполезен вдали.', flame: 'Струя огня на короткой дистанции. Жжёт кусты, почти не ломает стены.', laser: 'Мгновенный луч: высокая скорострельность, точность снайпера.', emp: 'ЭМИ-заряд замедляет врага и сбивает перезарядку на 1,6 с.', ricochet: 'Снаряд дважды отскакивает от стен — бей из-за угла.', cannon: 'Надёжная пушка. Сбалансированный урон и скорострельность.', twin: 'Два ствола — два снаряда за выстрел.', mg: 'Шквальный огонь короткими очередями. Слабо пробивает стены.', rocket: 'Самонаводящиеся ракеты с уроном по площади.', rail: 'Пробивает танки насквозь и разрушает сталь. Долгая перезарядка.' }[id];
}
export function drawModeArt(cv, mode) {
  const w = cv.clientWidth || 300, h = cv.clientHeight || 170, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); if (mode === 'moba') return drawMobaArt(g, w, h); const r = new Renderer(cv);
  const bg = g.createLinearGradient(0, 0, w, h);
  if (mode === 'br') { bg.addColorStop(0, '#2e3a22'); bg.addColorStop(1, '#1a2414'); } else if (mode === 'team') { bg.addColorStop(0, '#1d3a6b'); bg.addColorStop(0.5, '#3a2a2a'); bg.addColorStop(1, '#6b1d1d'); } else { bg.addColorStop(0, '#16181d'); bg.addColorStop(1, '#0c0d10'); }
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const tank = (x, y, a, skin, team, wpn, s = 2.2) => { g.save(); g.translate(x, y); g.scale(s, s); r.drawTank(g, { x: 0, y: 0, a, ta: a, skin, team, weapon: wpn, tread: 0, recoil: 0, hitT: 0, inv: 0, shield: 0, speedT: 0, powerT: 0, id: 1 }, mode, false, 0); g.restore(); };
  if (mode === 'br') {
    g.fillStyle = 'rgba(120,30,170,0.35)'; g.beginPath(); g.rect(0, 0, w, h); g.arc(w * 0.68, h * 0.42, h * 0.62, 0, Math.PI * 2, true); g.fill('evenodd');
    g.strokeStyle = '#e6a3ff'; g.lineWidth = 2; g.beginPath(); g.arc(w * 0.68, h * 0.42, h * 0.62, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc((i * 73) % w, (i * 41) % h, 2, 0, 7); g.fill(); }
    tank(w * 0.72, h * 0.38, 2.6, 'crimson', 0, 'rocket', 2.4); tank(w * 0.88, h * 0.62, 3.6, 'night', 0, 'mg', 2); tank(w * 0.55, h * 0.24, 0.6, 'desert', 0, 'rail', 1.8);
    g.fillStyle = 'rgba(47,107,42,0.9)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w * 0.92 + Math.cos(i) * 10, h * 0.18 + Math.sin(i * 2) * 8, 9, 0, 7); g.fill(); }
  } else if (mode === 'team') {
    tank(w * 0.58, h * 0.32, 0, 'team', 0, 'cannon', 2.2); tank(w * 0.52, h * 0.62, 0.2, 'team', 0, 'twin', 2); tank(w * 0.86, h * 0.36, Math.PI, 'team', 1, 'cannon', 2.2); tank(w * 0.92, h * 0.66, Math.PI - 0.3, 'team', 1, 'rocket', 2);
    g.strokeStyle = 'rgba(255,230,120,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.64, h * 0.32); g.lineTo(w * 0.76, h * 0.34); g.stroke();
  } else {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) { if ((x + y) % 2) continue; const bx = w * 0.45 + x * 26, by = 18 + y * 34; g.fillStyle = '#5a2414'; g.fillRect(bx, by, 24, 24); g.fillStyle = '#b4532f'; for (let k = 0; k < 4; k++) g.fillRect(bx + (k % 2) * 4 + 1, by + k * 6 + 1, 22 - (k % 2) * 4, 4); }
    g.fillStyle = '#f2c14e'; g.save(); g.translate(w * 0.8, h * 0.74); g.scale(1.6, 1.6); g.beginPath(); g.moveTo(0, -11); g.lineTo(3, -5); g.lineTo(12, -8); g.lineTo(8, 0); g.lineTo(12, 3); g.lineTo(4, 3); g.lineTo(2, 10); g.lineTo(-2, 10); g.lineTo(-4, 3); g.lineTo(-12, 3); g.lineTo(-8, 0); g.lineTo(-12, -8); g.lineTo(-3, -5); g.closePath(); g.fill(); g.restore();
    tank(w * 0.6, h * 0.74, -Math.PI / 2, 'olive', 0, 'cannon', 2.2); tank(w * 0.92, h * 0.25, Math.PI / 2, 'enemy_a', 1, 'cannon', 2);
  }
  const fade = g.createLinearGradient(0, h * 0.35, 0, h); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,0.85)'); g.fillStyle = fade; g.fillRect(0, 0, w, h);
}
installTankScreens(UI);
installSeason(UI); installTour(UI);
installFriends(UI);
installEconomy(UI); installPrebattle(UI);
installBoxes(UI); installTankMods(UI.prototype || UI);

// r28: country flag picker (profile). Canvas flags (render everywhere, incl. Windows), localised country names via Intl when available.
UI.prototype.flagPicker = function () { const d = this.m.d, cur = d.cc || ccFromLocale(navigator.language); let dn = null; try { dn = new Intl.DisplayNames([d.lang || navigator.language || 'en'], { type: 'region' }); } catch (e) { dn = null; }
  const nameOf = (cc) => { try { return (dn && dn.of(cc)) || cc; } catch (e) { return cc; } };
  const list = h('div', { class: 'flaggrid' }), q = h('input', { class: 'inp', placeholder: '🔍' });
  const fill = () => { while (list.firstChild) list.firstChild.remove(); const f = (q.value || '').trim().toLowerCase(); for (const cc of CCS.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b)))) { const nm = nameOf(cc); if (f && !nm.toLowerCase().includes(f) && !cc.toLowerCase().includes(f)) continue; const cv = h('canvas', { width: 36, height: 24 }); drawFlag(cv.getContext('2d'), cc, 1, 1, 34, 22);
    list.appendChild(h('button', { class: 'flagb' + (cc === cur ? ' on' : ''), onclick: () => { d.cc = cc; this.m.save(); ov.close(); this.toast(flagEmoji(cc) + ' ' + nm, 'check'); const sb = this.setOv && this.setOv.querySelector('[data-a=flag]'); if (sb) sb.textContent = flagEmoji(cc) + ' ' + cc; } }, cv, h('span', null, nm))); } };
  let ov = null; q.oninput = fill; fill(); ov = this.modal([h('h3', null, 'Флаг страны'), q, list, this.confirmBtns(['', 'ok', 'Закрыть'])]); };

// r28: own preview for «Оборона баз»: Dota-style diagonal map — 3 lanes, river, jungle, towers, ancients, creep waves.
function drawMobaArt(g, w, h) {
  const bg = g.createLinearGradient(0, h, w, 0); bg.addColorStop(0, '#1d3a22'); bg.addColorStop(0.5, '#3b4d2a'); bg.addColorStop(1, '#4a2220'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const S = Math.min(w, h) * 0.78, ox = w - S - h * 0.06, oy = h - S - h * 0.03, P = (u, v) => [ox + u * S, oy + (1 - v) * S];
  g.fillStyle = 'rgba(20,60,25,.55)'; for (let i = 0; i < 40; i++) { const u = (i * 0.618) % 1, v = (i * 0.371 + 0.2) % 1; const [x, y] = P(u, v); g.beginPath(); g.arc(x, y, S * 0.035, 0, 6.3); g.fill(); }
  g.strokeStyle = 'rgba(70,150,220,.8)'; g.lineWidth = S * 0.05; g.beginPath(); g.moveTo(...P(0, 0.95)); g.quadraticCurveTo(...P(0.5, 0.5), ...P(0.95, 0)); g.stroke();
  const lanes = [[[0.1, 0.1], [0.1, 0.9], [0.9, 0.9]], [[0.1, 0.1], [0.9, 0.9]], [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9]]];
  g.strokeStyle = '#c9b27a'; g.lineWidth = S * 0.04; g.lineCap = 'round'; g.lineJoin = 'round'; for (const L of lanes) { g.beginPath(); g.moveTo(...P(...L[0])); for (const q of L.slice(1)) g.lineTo(...P(...q)); g.stroke(); }
  const tower = (u, v, c) => { const [x, y] = P(u, v), r = S * 0.028; g.fillStyle = '#222'; g.fillRect(x - r - 1, y - r - 1, 2 * r + 2, 2 * r + 2); g.fillStyle = c; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
  for (const t of [0.3, 0.5, 0.7]) { tower(0.1, t * 0.8 + 0.1 - 0.2 * (t - 0.3), '#3d9bff'); tower(t * 0.8 + 0.1 - 0.2 * (t - 0.3) - 0.1 + 0.1, 0.1, '#3d9bff'); tower(0.1 + t * 0.55, 0.1 + t * 0.55, '#3d9bff'); tower(0.9, 1 - (t * 0.6 + 0.1), '#ff5a4d'); tower(1 - (t * 0.6 + 0.1), 0.9, '#ff5a4d'); tower(0.9 - t * 0.55, 0.9 - t * 0.55, '#ff5a4d'); }
  const base = (u, v, c) => { const [x, y] = P(u, v), r = S * 0.07; g.fillStyle = c; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); };
  base(0.07, 0.07, '#2a7be0'); base(0.93, 0.93, '#e0402a');
  const creeps = (u, v, du, dv, c) => { g.fillStyle = c; for (let k = 0; k < 4; k++) { const [x, y] = P(u + du * k * 0.03, v + dv * k * 0.03); g.beginPath(); g.arc(x, y, S * 0.012, 0, 6.3); g.fill(); } };
  creeps(0.42, 0.42, 1, 1, '#9fd0ff'); creeps(0.58, 0.58, -1, -1, '#ffb0a0'); creeps(0.1, 0.62, 0, 1, '#9fd0ff'); creeps(0.62, 0.1, 1, 0, '#9fd0ff'); creeps(0.9, 0.4, 0, -1, '#ffb0a0'); creeps(0.4, 0.9, -1, 0, '#ffb0a0');
  const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0.45, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
