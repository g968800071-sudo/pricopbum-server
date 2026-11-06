import { flagEmoji, ccOfName, ccFromLocale } from '../sim/flags.js';
function tourBoard(text) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('pb-tour-board');
  if (!text) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'pb-tour-board';
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:28px;z-index:50;padding:8px 12px;border-radius:12px;background:rgba(8,16,28,.94);color:#d7ecff;border:1px solid #7eb6ff;font:600 13px/1.35 system-ui,sans-serif;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = text;
}
// Hosted knockout uses only connected players. The practice button is a local bot bracket and says so.
import { h } from './dom.js';
import { BOT_NAMES } from '../sim/defs.js';
export const flagOf = (name) => flagEmoji(ccOfName(name));
export function installTour(UI) { const P = UI.prototype;
  P.tourMenu = function () { tourBoard(''); const ui = this, d = this.m.d;
    const online = this.app.net && this.app.net.status === 'online';
    this.show('tour', [h('div', { class: 'menu-bg' }), this.hdr('Турнир'), h('div', { class: 'scroll' }, h('div', { class: 'panel' },
      h('h3', null, 'Серверный турнир'),
      h('p', { class: 'note' }, online ? 'Только подключённые игроки. Пустые места ботами не заполняются. Сначала подключитесь, затем займите место и нажмите «Готов».' : 'Сначала откройте «Онлайн» и подключитесь к серверу. Без сервера здесь только тренировка, и соперники в ней — боты.'),
      h('div', { class: 'btns' }, [4, 8].map(n => h('button', { class: 'btn big y', onclick: () => ui.tourJoin(n) }, 'Занять место · ' + n))),
      h('h3', null, 'Тренировка с ботами'),
      h('p', { class: 'note' }, 'Это не онлайн и не живые игроки. Свободные места занимают боты из списка имён.'),
      h('div', { class: 'btns' }, [4, 8].map(n => h('button', { class: 'btn', onclick: () => ui.tourPractice(n) }, 'Боты · ' + n))),
      d.tourBest ? h('p', { class: 'note' }, 'Лучший результат тренировки: ' + d.tourBest) : null))]); };
  P.tourJoin = function (n) {
    const net = this.app.net;
    if (!net || !net.tr || net.status !== 'online') { this.toast('Сначала подключитесь к серверу', 'info'); return this.tourMenu(); }
    net.tr.send({ t: 'tourJoin', size: n });
    this.tourNet({ t: 'tour', phase: 'lobby', size: n, members: [], practice: false, humansOnly: true });
  };
  P.tourNet = function (msg) {
    if (!msg || msg.phase === 'left') return this.tourMenu();
    const ui = this;
    const members = msg.members || [];
    const rounds = msg.rounds || [];
    const live = msg.live || [];
    const cols = rounds.map((R, ri) => h('div', { class: 'tcol' }, h('small', null, R.length === 1 ? 'Чемпион' : '1/' + (R.length / 2)), R.map(p => h('div', { class: 'tourp' + (p.id === msg.you ? ' me' : '') }, (p.flag || '') + ' ' + p.name))));
    const mine = live.find(m => m.a.id === msg.you || m.b.id === msg.you);
    const other = live.find(m => m !== mine);
    const boardLine = other ? ('Табло счёта другого боя, не камера и не вид из танка: ' + other.a.name + ' ' + (other.killsA | 0) + ' — ' + (other.killsB | 0) + ' ' + other.b.name) : '';
    tourBoard(msg.phase === 'live' ? boardLine : '');
    try { window.__pbTour = { phase: msg.phase, size: msg.size, practice: false, humansOnly: true, members: members.map(p => p.name), board: boardLine }; } catch (e) {}
    const btn = [];
    btn.push(h('p', { class: 'note' }, 'Живые игроки на этом сервере. Ботов в сетке нет.'));
    if (msg.phase === 'lobby') {
      btn.push(h('p', null, 'В лобби ' + members.length + ' / ' + msg.size));
      members.forEach(p => btn.push(h('div', { class: 'tourp' + (p.id === msg.you ? ' me' : '') }, p.name + (p.ready ? ' · готов' : ''))));
      if (!members.find(p => p.id === msg.you && p.ready)) btn.push(h('button', { class: 'btn big y', onclick: () => ui.app.net.tr.send({ t: 'tourReady' }) }, 'Готов'));
      btn.push(h('button', { class: 'btn', onclick: () => ui.app.net.tr.send({ t: 'tourLeave' }) }, 'Выйти'));
    } else if (msg.phase === 'done' && msg.champion) {
      btn.push(h('p', { class: 'big-title' }, msg.champion.id === msg.you ? 'Чемпион — вы' : 'Чемпион: ' + msg.champion.name));
      btn.push(h('button', { class: 'btn big', onclick: () => ui.menu() }, 'В меню'));
    } else {
      if (mine && !mine.winner) btn.push(h('p', null, 'Ваш бой: ' + mine.a.name + ' ' + (mine.killsA | 0) + ' — ' + (mine.killsB | 0) + ' ' + mine.b.name));
      if (boardLine) btn.push(h('p', { class: 'note' }, boardLine));
    }
    this.show('tour', [h('div', { class: 'menu-bg' }), this.hdr(msg.phase === 'done' ? 'Итог турнира' : 'Сетка турнира'), h('div', { class: 'scroll' }, h('div', { class: 'tbracket' }, cols), h('div', { class: 'btns' }, btn))]);
  };
  P.tourPractice = function (n) { tourBoard(''); const ui = this, d = this.m.d;
    const me = { name: d.name || 'Игрок', flag: flagEmoji(d.cc || ccFromLocale(navigator.language)), me: 1, bot: false };
    const pool = BOT_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, n - 1).map(nm => ({ name: nm + ' · бот', flag: flagOf(nm), bot: true, rt: 0.6 + Math.random() * 0.8 }));
    const all = [me, ...pool].sort(() => Math.random() - 0.5);
    this.app.tour = { n, round: [all], practice: true, alive: true, place: 0 };
    this.tourBracket();
  };
  P.tourPair = function (T) { const R = T.round[T.round.length - 1], pairs = []; for (let i = 0; i < R.length; i += 2) pairs.push([R[i], R[i + 1]]); return pairs; };
  P.tourBracket = function () { const ui = this, T = this.app.tour; if (!T || !T.practice) return this.tourMenu();
    const pairs = this.tourPair(T), last = T.round[T.round.length - 1];
    const cols = T.round.map((R, ri) => h('div', { class: 'tcol' }, h('small', null, R.length === 1 ? 'Чемпион' : '1/' + (R.length / 2)), R.map(p => h('div', { class: 'tourp' + (p.me ? ' me' : '') }, (p.flag || '') + ' ' + p.name))));
    const mine = pairs.find(pr => pr.some(p => p.me));
    const btn = [h('p', { class: 'note' }, 'Тренировка. Соперники с пометкой «бот» не являются игроками.')];
    if (last.length === 1) { btn.push(h('p', { class: 'big-title' }, last[0].me ? 'Тренировка: вы первый' : 'Тренировка окончена')); btn.push(h('button', { class: 'btn big', onclick: () => { ui.app.tour = null; ui.menu(); } }, 'В меню')); }
    else if (mine && T.alive) btn.push(h('button', { class: 'btn big y', onclick: () => ui.tourPlay(mine) }, 'Бой с ботом'));
    else btn.push(h('button', { class: 'btn', onclick: () => ui.tourAdvance(null) }, 'Дальше'));
    this.show('tour', [h('div', { class: 'menu-bg' }), this.hdr('Тренировочная сетка'), h('div', { class: 'scroll' }, h('div', { class: 'tbracket' }, cols), h('div', { class: 'btns' }, btn))]); };
  P.tourAdvance = function (myWin) { const T = this.app.tour; if (!T || !T.practice) return; const pairs = this.tourPair(T), nx = [];
    for (const [a, b] of pairs) { let w; if (a.me || b.me) w = myWin ? (a.me ? a : b) : (a.me ? b : a); else w = Math.random() < a.rt / (a.rt + b.rt) ? a : b; nx.push(w); }
    if (T.alive && pairs.some(pr => pr.some(p => p.me)) && !myWin) { T.alive = false; T.place = pairs.length * 2; }
    T.round.push(nx);
    if (nx.length === 1 && T.paid !== 1) { T.paid = 1; const pos = nx[0].me ? 1 : (T.place || 2); this.m.d.tourBest = pos === 1 ? '1 место (боты)' : 'Топ-' + pos + ' (боты)'; this.m.save(); this.toast('Тренировка с ботами не начисляет серверные монеты', 'info'); }
    this.tourBracket(); };
  P.tourPlay = function (pr) { const opp = pr.find(p => !p.me); this.app.tour.pend = 1; this.app.startLocal('duel', { noPre: 1, tour: 1, botNames: [opp.name] }); };
}
