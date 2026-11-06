// «Игра с друзьями»: private room with a short code. The host picks any mode / map (incl. editor maps) and the rules;
// friends join by code or share link, pick teams, mark ready and use quick-chat. The match itself stays server-authoritative.
import { h } from './dom.js';
import { icon } from './icons.js';
import { DIFFS } from '../sim/defs.js';
import { MAPS } from '../sim/maps.js';
import { VNAME } from '../net/client.js';

export const ROOM_V = ['br', 'brg', 'cbr', 'cbr2', 'cbr3', 'cbr4', 'cbr5', 'moba', 'ffa', 'team', 'team20', 'arena', 'duel', 'koth', 'sniper', 'ctf', 'hunt', 'trench', 'race', 'survival', 'zombie', 'boss', 'coop'];
const TEAMISH = ['team', 'team20', 'arena', 'duel', 'koth', 'sniper', 'ctf', 'moba'];
const MAPPABLE = ['team', 'team20', 'arena', 'duel', 'koth', 'sniper', 'ctf', 'survival', 'zombie', 'boss', 'coop'];
const QUICK = ['Привет!', 'Готов!', 'Подождите', 'Начинаем?', 'Я за синих', 'Я за красных', 'Удачи!', 'GG'];
const SIZES = [0, 1, 2, 3, 4, 5, 10, 15, 20, 30], TIMES = [0, 180, 300, 600, 900, 1200, 1800, 3600], TARGETS = [0, 5, 10, 20, 30, 50, 100];
const CAMS = [-1, 0, 1, 2], CAMN = { '-1': 'Любая', 0: 'Сверху', 1: '3-е лицо', 2: 'Дрон' };
const vName = (v) => VNAME[v] || v;
const nxt = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];

export function installFriends(UI) {
  const P = UI.prototype;
  P.friends = function () {
    const net = this.app.net, st = net.status, on = st === 'online' || st === 'queue', d = this.m.d;
    const srv = this.pendingSrv || d.server || net.defaultUrl();
    const kids = [h('div', { class: 'menu-bg' }), this.hdr('Игра с друзьями'), h('div', { class: 'scroll' },
      h('div', { class: 'panel' }, h('div', { class: 'row', style: 'margin-bottom:8px' }, icon('globe', 22), h('span', { class: 'grow' }, 'Приватная комната'), h('span', { class: 'note' }, on ? 'Подключено' : st === 'connecting' ? 'Подключение…' : 'Нет связи')),
        h('p', { class: 'note' }, 'Создай комнату, выбери любой режим и карту (включая свою из редактора), настрой правила и отправь код друзьям.'),
        on ? [h('button', { class: 'btn y big', style: 'width:100%;margin-top:8px', onclick: () => { this.app.audio.play('click'); net.createRoom('team'); } }, icon('play', 20), 'Создать комнату'),
          h('div', { class: 'row', style: 'gap:6px;margin-top:10px' }, h('input', { id: 'pcb-fcode', class: 'inp grow', placeholder: 'Код комнаты', maxLength: 5, autocapitalize: 'characters', value: this.pendingRoom || '' }),
            h('button', { class: 'btn b', onclick: () => { const el = this.el.querySelector('#pcb-fcode'), c = (el ? el.value : '').trim(); if (!/^[A-Za-z0-9]{5}$/.test(c)) return this.toast('Код — 5 символов', 'info'); net.joinRoom(c); } }, 'Войти'))]
          : [h('input', { id: 'pcb-fsrv', class: 'inp', value: srv, placeholder: 'wss://ваш-сервер:8080' }),
            h('button', { class: 'btn y big', style: 'width:100%;margin-top:8px', onclick: () => { const el = this.el.querySelector('#pcb-fsrv'); net.connect(el ? el.value.trim() : srv); } }, 'Подключиться'),
            h('p', { class: 'note', style: 'margin-top:8px' }, 'Нужен игровой сервер PRICOPBUM (папка server). Все друзья подключаются к одному серверу.')]))];
    this.show('friends', kids);
  };
  P.roomLobby = function (m) {
    this.room = m; if (this.roomOv) { this.roomOv.close(); this.roomOv = null; }
    this.pendingRoom = null;
    const net = this.app.net, host = m.owner === m.me, c = m.cfg || {}, v = c.variant || m.variant, mine = m.members.find(x => x.id === m.me) || {}, d = this.m.d;
    const send = (patch) => net.roomCmd('roomCfg', { cfg: patch });
    const opt = (label, val, fn) => h('button', { class: 'opt', disabled: !host, onclick: host ? () => { this.app.audio.play('click'); fn(); } : null }, h('small', null, label), val);
    const mapName = c.map === 'custom' ? 'Своя карта' : c.map >= 0 && MAPS[c.map] ? MAPS[c.map].name : 'Случайная';
    const mapCycle = () => { const opts = [-1, ...MAPS.map((_, i) => i)]; if (d.customMap) opts.push('custom'); const n = nxt(opts, c.map ?? -1); send(n === 'custom' ? { map: 'custom', custom: d.customMap } : { map: n }); };
    const shareUrl = () => { try { const u = new URL(location.href); u.hash = ''; u.search = ''; u.searchParams.set('room', m.code); if (d.server) u.searchParams.set('srv', d.server); return /^https?:/.test(u.protocol) ? u.toString() : ''; } catch (e) { return ''; } };
    const share = async () => { const url = shareUrl(), text = 'Заходи в мою комнату PRICOPBUM! Код: ' + m.code;
      try { if (navigator.share) { await navigator.share({ title: 'PRICOPBUM', text, url: url || undefined }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      copy(url ? text + ' ' + url : text); };
    const copy = async (t) => { try { await navigator.clipboard.writeText(t); this.toast('Скопировано', 'check'); } catch (e) { this.toast('Код комнаты: ' + m.code, 'info'); } };
    const team = TEAMISH.includes(v), nReady = m.members.filter(x => x.ready).length;
    const list = h('div', { class: 'roomlist' }, m.members.map(x => h('div', { class: 'roomm' + (x.team === 0 ? ' t0' : x.team === 1 ? ' t1' : ''), style: 'display:flex;align-items:center;gap:6px' },
      h('span', { class: 'grow' }, x.name + (x.id === m.owner ? ' ★' : '') + (x.id === m.me ? ' (вы)' : '')),
      h('span', { class: 'note', style: { color: x.ready ? '#7dff9a' : '#ffb35c' } }, x.ready ? 'Готов' : 'Не готов'),
      host && x.id !== m.me ? h('button', { class: 'btn r', style: 'padding:2px 8px;min-height:0', onclick: () => net.roomCmd('roomKick', { id: x.id }) }, '✕') : null)));
    const chat = h('div', { class: 'note fchat', style: 'min-height:40px;text-align:left' }, (this.roomChatLog || []).slice(-5).map(e => h('div', null, h('b', null, e.name + ': '), e.text)));
    const settings = h('div', { class: 'fset' },
      opt('Режим', vName(v), () => send({ variant: nxt(ROOM_V, v) })),
      MAPPABLE.includes(v) ? opt('Карта', mapName, mapCycle) : null,
      opt(team ? 'Размер команды' : 'Отряд', c.size ? String(c.size) : 'Авто', () => send({ size: nxt(SIZES, c.size || 0) })),
      opt('Боты', c.bots === false ? 'Выкл' : 'Вкл', () => send({ bots: c.bots === false })),
      opt('Сложность ботов', DIFFS[c.diff ?? 1].name, () => send({ diff: ((c.diff ?? 1) + 1) % DIFFS.length })),
      opt('Время', c.time ? Math.round(c.time / 60) + ' мин' : 'По умолч.', () => send({ time: nxt(TIMES, c.time || 0) })),
      opt('Цель убийств', c.target ? String(c.target) : 'По умолч.', () => send({ target: nxt(TARGETS, c.target || 0) })),
      opt('Равные условия', c.equal === false ? 'Выкл' : 'Вкл', () => send({ equal: c.equal === false })),
      opt('Камера', CAMN[c.cam ?? -1], () => send({ cam: nxt(CAMS, c.cam ?? -1) })));
    const kids = [h('div', { class: 'menu-bg' }), h('div', { class: 'hdr' }, h('button', { class: 'iconbtn', onclick: () => { net.roomCmd('roomLeave'); } }, icon('back')), h('h2', null, 'Комната')), h('div', { class: 'scroll' },
      h('div', { class: 'panel' }, h('div', { class: 'roomcode' }, m.code),
        h('div', { class: 'row', style: 'gap:6px' }, h('button', { class: 'btn y grow', onclick: share }, 'Поделиться'), h('button', { class: 'btn grow', onclick: () => copy(m.code) }, 'Копировать код')),
        h('p', null, vName(v) + ' · игроков ' + m.members.length + ' из ' + m.cap + ' · готовы ' + nReady + '/' + m.members.length),
        c.bots === false ? null : h('p', { class: 'note' }, 'Свободные места займут боты.'), list,
        team ? h('div', { class: 'optsbar' }, [[0, 'Синие'], [1, 'Красные'], [null, 'Авто']].map(([t, n]) => h('button', { class: 'opt' + (mine.team === t ? ' sel' : ''), onclick: () => net.roomCmd('roomTeam', { team: t }) }, h('small', null, 'Команда'), n))) : null),
      h('div', { class: 'panel', style: 'margin-top:8px' }, h('b', null, host ? 'Настройки комнаты' : 'Настройки (меняет создатель)'), settings),
      h('div', { class: 'panel', style: 'margin-top:8px' }, h('b', null, 'Быстрый чат'), chat, h('div', { class: 'chips' }, QUICK.map((q, i) => h('button', { class: 'chip', onclick: () => net.roomCmd('roomChat', { q: i }) }, q)))),
      h('div', { class: 'btns', style: 'margin-top:10px' },
        host ? h('button', { class: 'btn y big', onclick: () => net.roomCmd('roomStart', { force: nReady === m.members.length ? false : !!this._forceArm }) || (this._forceArm = true) }, nReady === m.members.length ? '▶ Начать бой' : this._forceArm ? '▶ Начать без готовности' : '▶ Начать бой')
          : h('button', { class: 'btn big ' + (mine.ready ? '' : 'y'), onclick: () => net.roomCmd('roomReady', { ready: !mine.ready }) }, mine.ready ? 'Не готов' : '✔ Готов'),
        h('button', { class: 'btn', onclick: () => net.roomCmd('roomLeave') }, 'Выйти из комнаты')))];
    this.show('flobby', kids);
  };
  P.roomChatMsg = function (m) { const t = QUICK[m.q]; if (!t) return; (this.roomChatLog = this.roomChatLog || []).push({ name: m.name, text: t }); if (this.roomChatLog.length > 20) this.roomChatLog.shift(); if (this.screen === 'flobby' && this.room) this.roomLobby(this.room); };
  P.closeRoom = function () { if (this.roomOv) { this.roomOv.close(); this.roomOv = null; } const was = this.screen === 'flobby'; this.room = null; this.roomChatLog = []; this._forceArm = false; if (was) this.friends(); };
}
