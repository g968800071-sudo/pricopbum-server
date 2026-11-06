// r20 economy: everything bought with coins is a ONE-MATCH loadout («на 1 бой», consumable). Persistent: tank models, skins/cosmetics.
// Pricing rule: the 4,99 недоступно pack (3 000 coins) buys the best full loadout for ~15 matches → best loadout ≈ 200 coins.
import { GMODS } from '../sim/gmods.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { LOOTX, ROCKETS, MODS2, ammoInfo, fxText } from '../sim/loot.js';
import { MGS, TURRETS, RAR, RAR_COL, mgInfo, turInfo } from '../sim/arms.js';
export const P_MOD = 12, P_TUR = [4, 8, 14, 22, 34], P_MG = [3, 6, 10, 18, 28], P_RKT = 6, P_HRKT = 14, P_KIT = 20, P_WPN = 10, P_UPG = 5;
export const P_LIFE = 15; // r26: extra life, coins, this match only
export const P_GEAR = { armor2: 10, armor3: 18, sentry: 16, blocks: 12, med: 4, smoke: 3, mine: 4, drone: 8, ldrone: 20, twinr: 14, invis: 18 };
export const MPERK_PK = [['ldrone', 'ldrone'], ['twinr'], ['med', 'med', 'med', 'smoke', 'smoke']];
export const mythOn = (d) => (d.myth || []).filter(k => !(d.mythOff || []).includes(k)); // r25: owned mythics auto-install; user can toggle each off
export const mythPk = (d) => mythOn(d).filter(k => k.startsWith('mperk:')).flatMap(k => MPERK_PK[+k.slice(6)] || []);
export const mythLids = (d) => mythOn(d).map(k => { const [c, i] = k.split(':'); return LOOTX.findIndex(x => x.cat === c && x.i === +i); }).filter(l => l >= 0);
const lidOf = (cat, i) => LOOTX.findIndex(x => x.cat === cat && x.i === i);
export function emptyMB() { return { lx: [], pk: [], kit: 0, up: {}, weapon: null, spent: 0 }; }
export function installPrebattle(UI) {
  const P = UI.prototype;
  P.mb = function () { const d = this.m.d; return d.mb || (d.mb = emptyMB()); };
  P.prebattle = function (mode, onGo, tab = 'best') { const d = this.m.d, mb = this.mb();
    const has = (cat, i) => mb.lx.some(l => LOOTX[l] && LOOTX[l].cat === cat && (i == null || LOOTX[l].i === i)), cnt = (cat) => mb.lx.filter(l => LOOTX[l] && LOOTX[l].cat === cat).length;
    const buy = (price, fn) => { if (d.coins < price) { this.toast('Не хватает монет', 'coin'); return; } this.m.spend('coins', price); mb.spent += price; fn(); this.m.save(); this.app.audio.play('coin'); this.prebattle(mode, onGo, tab); };
    const mythOwn = (c, i) => (d.myth || []).includes(c + ':' + i), mythBuy = (c, i) => () => { const id = 'myth_' + c + '_' + i; if (window.IAP && window.IAP.purchase) window.IAP.purchase(id).then(ok => { if (ok) { this.toast('Навсегда ✓', 'crown'); this.prebattle(mode, onGo, tab); } }); };
    const mrowF = (row) => (c, X, info) => row(X.name + ' · навсегда', info + ' · Только за реальные деньги · навсегда', RAR_COL[4], c === 'tur' ? '24,99 недоступно' : '19,99 недоступно', mythOwn(c, X.i) ? 'Навсегда' : 0, mythBuy(c, X.i));
    const row = (name, info, col, price, owned, act) => h('div', { class: 'arsr pbr' }, h('div', { class: 'grow' }, h('b', { style: col ? { color: col } : null }, name), h('small', null, info)),
      owned ? h('span', { class: 'demo-tag', style: 'background:#2e9e5b' }, '✓ ' + (owned === true ? 'Установлено' : owned)) : h('button', { class: 'btn y', onclick: act }, typeof price === 'number' ? icon('coin', 14) : null, typeof price === 'number' ? String(price) + ' · на 1 бой' : '💎 ' + price + ' · навсегда'));
    const addLx = (cat, i) => () => buy(cat === 'tur' ? P_TUR[TURRETS[i].r] : cat === 'mgt' ? P_MG[MGS[i].r] : cat === 'mod' ? P_MOD : cat === 'rocket' ? (ROCKETS[i].hm || i === 0 ? P_HRKT : P_RKT) : P_GEAR[cat], () => {
      if (cat === 'tur') mb.lx = mb.lx.filter(l => LOOTX[l].cat !== 'tur'); mb.lx.push(lidOf(cat, i)); });
    const mrow = mrowF(row); let rows = [];
    if (tab === 'best') { const best = [['tur', 47], ['mgt', 47], ['mod', 0], ['mod', 1], ['mod', 2], ['mod', 3], ['rocket', 0], ['rocket', 40], ['sentry', 0], ['blocks', 0]], need = best.filter(([c, i]) => !has(c, i));
      const pr = need.reduce((s, [c, i]) => s + (c === 'tur' ? P_TUR[3] : c === 'mgt' ? P_MG[3] : c === 'mod' ? P_MOD : c === 'rocket' ? P_HRKT : P_GEAR[c]), 0) + (mb.kit ? 0 : P_KIT) + (mb.pk.includes('armor3') ? 0 : P_GEAR.armor3);
      rows = [h('div', { class: 'panel', style: 'padding:8px 12px' }, h('b', null, 'Лучшая комплектация · на 1 бой'), h('small', { class: 'note' }, 'Легендарная башня и пулемёт, 4 мода, броня III, ракеты, турель, бетонные блоки, полная модернизация'),
        need.length || !mb.kit || !mb.pk.includes('armor3') ? h('button', { class: 'btn y', style: 'margin-top:6px', onclick: () => buy(pr, () => { for (const [c, i] of need) { if (c === 'tur') mb.lx = mb.lx.filter(l => LOOTX[l].cat !== 'tur'); mb.lx.push(lidOf(c, i)); } mb.kit = 1; if (!mb.pk.includes('armor3')) mb.pk.push('armor3'); }) }, icon('coin', 16), 'Купить всё · ' + pr) : h('span', { class: 'demo-tag', style: 'background:#2e9e5b' }, '✓ Всё установлено')),
        row('Полная модернизация', '+1 уровень ко всем улучшениям', '#ffd23d', P_KIT, mb.kit ? true : 0, () => buy(P_KIT, () => { mb.kit = 1; })),
        ...['armor2', 'armor3', 'med', 'smoke', 'mine', 'drone', 'ldrone', 'twinr', 'invis'].map(k => row({ invis: 'Невидимка', armor2: 'Броня II', armor3: 'Броня III', med: 'Аптечка', smoke: 'Дымовая шашка', mine: 'Мина', drone: 'Боевой дрон', ldrone: 'Легендарный дрон', twinr: 'Спаренные ракеты' }[k], 'Снаряжение', null, P_GEAR[k], k.startsWith('armor') && mb.pk.includes(k) ? true : mb.pk.filter(x => x === k).length ? '×' + mb.pk.filter(x => x === k).length : 0, () => buy(P_GEAR[k], () => mb.pk.push(k)))),
        row('❤ Доп. жизнь (' + (mb.lives || 0) + '/3)', 'У всех 3 жизни · ещё одна жизнь только на этот бой', '#ff6b8a', P_LIFE, (mb.lives || 0) >= 3 ? 'Макс.' : 0, () => buy(P_LIFE, () => { mb.lives = (mb.lives || 0) + 1; })),
        row('Турель', 'Авто-турель · 400 патронов', '#4ff0ff', P_GEAR.sentry, has('sentry') ? true : 0, addLx('sentry', 0)), row('Бетонные блоки', 'Только ракеты разрушают', '#c9c4b8', P_GEAR.blocks, has('blocks') ? true : 0, addLx('blocks', 0))]; }
    else if (tab === 'tur') rows = TURRETS.slice().reverse().map(T => T.r === 4 ? mrow('tur', T, turInfo(T)) : row(T.name, turInfo(T), RAR_COL[T.r], P_TUR[T.r], has('tur', T.i), addLx('tur', T.i)));
    else if (tab === 'mg') rows = MGS.slice().reverse().map(M => M.r === 4 ? mrow('mgt', M, mgInfo(M)) : row(M.name, mgInfo(M), RAR_COL[M.r], P_MG[M.r], has('mgt', M.i) ? true : 0, addLx('mgt', M.i)));
    else if (tab === 'mod') rows = MODS2.map((M, i) => row(M.name, fxText(M.fx), '#6cff9a', P_MOD, has('mod', i) ? true : cnt('mod') >= 4 ? 'Макс. 4' : 0, addLx('mod', i)));
    else if (tab === 'gm') rows = GMODS.flatMap(M => [[1, 1, 10], [1, 3, 22], [4, 2, 35]].map(([tr, lv, pr]) => { const lid = LOOTX.findIndex(x => x.cat === 'gmod' && x.i === M.i && x.tier === tr && x.lv === lv), on = mb.lx.includes(lid), same = mb.lx.some(l => LOOTX[l] && LOOTX[l].cat === 'gmod' && LOOTX[l].i === M.i);
      return row((tr === 4 ? '★ ' : '') + LOOTX[lid].name, LOOTX[lid].info, tr === 4 ? RAR_COL[3] : M.col, pr, on ? true : same ? 'Уже есть' : cnt('gmod') >= 8 ? 'Макс. 8' : 0, () => buy(pr, () => mb.lx.push(lid))); })); // r27 gameplay mods shop
    else if (tab === 'rkt') rows = ROCKETS.map((R, i) => row(R.name, i === 0 ? 'Пачка 10 · Урон 1/15 HP' : ammoInfo(R, true) + (R.hm ? ' · Пачка 10' : ''), R.col, R.hm || i === 0 ? P_HRKT : P_RKT, has('rocket', i) ? true : 0, addLx('rocket', i)));
    else if (tab === 'myth') { const own = d.myth || []; rows = own.length ? own.map(k => { const [c, i] = k.split(':'), L = LOOTX.find(x => x.cat === c && x.i === +i), off = (d.mythOff || []).includes(k);
        return h('div', { class: 'arsr pbr' }, h('div', { class: 'grow' }, h('b', { style: { color: RAR_COL[4] } }, '✦ ' + (L ? L.name : k)), h('small', null, off ? 'Выключено — не ставится в бой' : 'Авто-установка в каждый бой')),
          h('button', { class: 'btn ' + (off ? '' : 'g'), onclick: () => { const o = d.mythOff || (d.mythOff = []); if (off) d.mythOff = o.filter(x => x !== k); else o.push(k); this.m.save(); this.prebattle(mode, onGo, tab); } }, off ? 'ВЫКЛ' : 'ВКЛ')); })
        : [h('p', { class: 'note' }, 'Мифических предметов пока нет. Они навсегда и ставятся автоматически — здесь можно выключить любой.')]; } // r27 mythic auto-install toggles
    const tabs = [['best', 'Лучшее'], ['myth', '✦ Мифические'], ['tur', 'Башни'], ['mg', 'Пулемёты'], ['mod', 'Моды'], ['gm', 'Модули'], ['rkt', 'Ракеты']];
    const kids = [h('div', { class: 'menu-bg' }), this.hdr('Снаряжение на 1 бой', this.curs(false)),
      h('div', { class: 'pbnote' }, '⏱ Всё, что покупается за монеты, действует ТОЛЬКО в одном следующем бою (любой режим) и исчезает после боя. Танки и раскраски — навсегда.'),
      h('div', { class: 'chips' }, tabs.map(([k, n]) => h('button', { class: 'chip' + (k === tab ? ' on' : ''), onclick: () => this.prebattle(mode, onGo, k) }, n))),
      h('div', { class: 'scroll pbscroll' }, rows),
      h('div', { class: 'pbbar' }, h('small', null, 'На этот бой потрачено: 🪙 ' + mb.spent + ' · баланс 🪙 ' + d.coins), h('button', { class: 'play', onclick: () => onGo() }, icon('play', 24), 'В БОЙ'))];
    const sc = this.el.querySelector('.pbscroll'), y = sc ? sc.scrollTop : 0, keep = this.screen === 'prebattle' && tab === this._pbTab; this._pbTab = tab;
    const s = this.show('prebattle', kids); if (keep) { const n = s.querySelector('.pbscroll'); if (n) n.scrollTop = y; } };
}
