import { genBunker } from '../sim/bunker.js';
import { T_HATCH } from '../sim/defs.js';
// Online client: WebSocket transport, matchmaking UI glue, and a RemoteSession that renders server snapshots with interpolation.
import { decTank, mapFor, PROTO } from './protocol.js';
import { WEAPON_LIST } from '../sim/defs.js';

export const VNAME = { trench: 'Траншеи 15×15', moba: 'Оборона баз 30×30', br: 'Королевская битва (150)', cbr: 'Конструктор BR', cbr2: 'Конструктор BR · дуо', cbr3: 'Конструктор BR · трио', cbr4: 'Конструктор BR · отряд 4', cbr5: 'Конструктор BR · отряд 5', cbr20: 'Конструктор BR · отряды по 20', team: 'Командный бой 10×10', team20: 'Битва 20×20', ffa: 'Каждый за себя', arena: 'Арена 3×3', duel: 'Дуэль 1×1', koth: 'Царь горы', sniper: 'Снайперы', ctf: 'Захват флага 5×5', race: 'Танковые гонки', brg: 'Гигантская BR', survival: 'Выживание', zombie: 'Зомби-волны', boss: 'Босс «Мамонт»', coop: 'Кооператив' };
export class WsTransport {
  constructor(url) { this.url = url; this.handlers = []; this.closeHandlers = []; this.openHandlers = [];
    try { this.ws = new WebSocket(url); } catch (e) { this.ws = { readyState: 3, send() {}, close() {} }; setTimeout(() => { for (const h of this.closeHandlers) h(); }, 0); return; }
    this.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } for (const h of this.handlers) h(m); };
    this.ws.onclose = () => { for (const h of this.closeHandlers) h(); }; this.ws.onerror = () => {}; this.ws.onopen = () => { for (const h of this.openHandlers) h(); };
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  onMessage(h) { this.handlers.push(h); } onClose(h) { this.closeHandlers.push(h); } onOpen(h) { this.openHandlers.push(h); }
  close() { try { this.ws.close(); } catch (_) {} }
}

// A view-world assembled from snapshots. Same shape the renderer and HUD read from a local World.
export class NetView {
  constructor(msg) {
    this.mode = msg.mode; this.map = mapFor(msg); if (msg.hk && msg.hk.length) { for (const [c, r] of msg.hk) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.map.set(c + a, r + b, T_HATCH, true); this.under = genBunker(this.map, msg.seed); } this.tanks = []; this.byId = new Map(); this.bullets = []; this.pickups = []; this.events = [];
    this.target = msg.target; this.timeLimit = msg.timeLimit; this.level = msg.level; this.levelName = msg.levelName; this.state = 'countdown'; this.countdown = 4; this.time = 0; this.result = null;
    this.aliveCount = msg.roster.length; this.score = [0, 0]; this.lives = 0; this.enemyKilled = 0; this.enemyTotal = 20; this.baseAlive = true; this.freezeT = 0;
    for (const r of msg.roster) this.addRoster(r);
    this.ffa = !!msg.ffa; this.special = msg.special || null; this.laps = msg.laps || 0; this.variant = msg.variant; this.diff = { name: 'Онлайн', rew: 1 };
    this.snaps = []; this.serverTime = 0; this.clock = 0;
  }
  addRoster(r) { const t = { id: r[0], name: r[1], skin: r[2], team: r[3], maxHp: r[4], hp: r[4], human: !!r[5], etype: r[6] || null, model: r[7] ?? -1, build: r[8] || null, cc: r[9] || null, x: -999, y: -999, a: 0, ta: 0, vx: 0, vy: 0, alive: true, kills: 0, shield: 0, seen: false, tread: 0, recoil: 0, hitT: 0, lastFire: -9, cd: 0, lv: {} }; this.tanks.push(t); this.byId.set(t.id, t); return t; }
  apply(s, events) {
    this.serverTime = s.tm; this.state = s.st; this.countdown = s.cd;
    if (s.tc) for (let i = 0; i < s.tc.length; i += 2) { const idx = s.tc[i], v = s.tc[i + 1], c = idx % this.map.w, r = (idx / this.map.w) | 0; this.map.set(c, r, v); }
    const seen = new Set();
    for (const a of s.T) { let t = this.byId.get(a[0]); if (!t) t = this.addRoster([a[0], '?', 'olive', 0, a[17], 0, '']); const px = t.x, py = t.y, pa = t.a, pta = t.ta, was = t.seen; decTank(a, t); t.lastFire = s.tm - t.fireAgo; seen.add(t.id);
      // interpolation targets
      t.tx = t.x; t.ty = t.y; t.taa = t.a; t.tta = t.ta; if (was && Math.hypot(px - t.x, py - t.y) < 60) { t.x = px; t.y = py; t.a = pa; t.ta = pta; } t.seen = true; t.snapT = this.clock; }
    for (const t of this.tanks) if (!seen.has(t.id)) { t.seen = false; t.x = -999; }
    this.bullets = s.B.map(b => ({ id: b[0], x: b[1], y: b[2], vx: b[3], vy: b[4], w: WEAPON_LIST[b[5]] || 'cannon', zap: b[6] || 0 }));
    this.pickups = s.P.map(p => ({ id: p[0], x: p[1], y: p[2], type: p[3], wid: p[4] >= 0 ? WEAPON_LIST[p[4]] : null, life: p[5], tier: p[6] || 1, ak: p[7] || 0, items: p[8] ? p[8].map(a => ({ type: a[0], n: a[1], wid: a[2] >= 0 ? WEAPON_LIST[a[2]] : null, tier: a[3], lid: a[4] >= 0 ? a[4] : undefined })) : undefined, lid: p[9] >= 0 ? p[9] : undefined }));
    this.traps = (s.tp || []).map(m => ({ id: m[0], x: m[1], y: m[2], a: m[3], team: m[4], n: m[5] })); this.drones = (s.dr || []).map(m => ({ id: m[0], x: m[1], y: m[2], a: m[3], leg: !!m[4], ph: m[5] })); this.smokes = (s.sm || []).map(m => ({ id: m[0], x: m[1], y: m[2], r: m[3], t: m[4], max: m[5] })); this.sentries = (s.se || []).map(m => ({ id: m[0], x: m[1], y: m[2], team: m[3], hp: m[4], maxHp: 70, ammo: m[5], a: m[6], layer: m[7] })); this.mines = (s.mn || []).map(m => ({ id: m[0], x: m[1], y: m[2], team: m[3], arm: m[4] }));
    if (s.z) { const z = s.z; this.zone = { cx: z[0], cy: z[1], r: z[2], tcx: z[3], tcy: z[4], tr: z[5], state: z[6], timer: z[7] }; }
    if (s.ac !== undefined) this.aliveCount = s.ac; if (s.sc) this.score = s.sc;
    if (s.hl) this.hill = { x: s.hl[0], y: s.hl[1], r: s.hl[2], owner: s.hl[3], contested: !!s.hl[4] }; if (s.wv) { this.wave = s.wv[0]; this.lives = s.wv[1]; }
    this.wrecks = (s.wk || []).map(a => ({ id: a[0], x: a[1], y: a[2], a: a[3], ta: a[4], age: a[5], model: a[6], rp: a[7] || 0, team: a[8], tid: a[9] || 0 }));
    if (s.ly) { const U = new Set(s.ly); for (const t of this.tanks) t.layer = U.has(t.id) ? 1 : 0; }
    if (s.tw) { this.towers = s.tw.map(a => ({ id: a[0], team: a[1], x: a[2], y: a[3], hp: a[4], maxHp: a[5], tier: a[6], hq: !!a[7], vul: !!a[8], alive: a[4] > 0 })); this.gold = s.gd; }
    if (s.fl) { if (!this.flags) this.flags = [0, 1].map(team => ({ team, hx: 0, hy: 0 })); s.fl.forEach((f, i) => { const F = this.flags[i]; [F.x, F.y, F.carrier] = f; F.home = !!f[3]; if (F.home) { F.hx = F.x; F.hy = F.y; } }); }
    if (s.rc) { this.raceOrder = s.rc.map(([id, lap, cp, fin]) => { const t = this.byId.get(id); if (t) { t.lap = lap; t.cp = cp; t.finishT = fin; } return t; }).filter(Boolean); }
    if (s.fk) for (const [id, k] of s.fk) { const t = this.byId.get(id); if (t) t.kills = k; }
    if (s.cl) { [this.lives, this.score, this.enemyKilled, this.enemyTotal] = s.cl; this.baseAlive = !!s.cl[4]; this.freezeT = s.cl[5]; }
    if (s.hu) { this.huntHold = s.hu[1]; for (const [id, lv, out, md] of s.hu[2]) { const t = this.byId.get(id); if (t) { t.lives = lv; t.outL = !!out; t.isTarget = id === s.hu[0]; if (md != null && md >= 0) t.model = md; if (t.isTarget && s.hu[3]) t.hk = s.hu[3]; } } }
    this.molos = (s.ml || []).map(a => ({ x: a[0], y: a[1], h: a[2] })); this.fires = (s.fi || []).map(a => ({ id: a[0], x: a[1], y: a[2], r: a[3], t: a[4], max: a[5] }));
    if (s.hu) this.htraps = (s.ht || []).map(a => ({ id: a[0], k: a[1], x: a[2], y: a[3], team: a[4], model: a[5], a: a[6] }));
    if (s.res) this.result = s.res;
    this.time = s.tm;
    for (const e of s.E) { events.push(e); if (e.k === 'shot') { const t = this.byId.get(e.o); if (t) t.recoil = 1; } if (e.k === 'dmg') { const t = this.byId.get(e.id); if (t) t.hitT = 0.12; } }
  }
  smooth(dt) {
    this.clock += dt; const k = 1 - Math.exp(-dt * 18);
    for (const t of this.tanks) {
      if (!t.seen) continue; if (t.tx === undefined) continue;
      // extrapolate target slightly with velocity, then ease
      const ex = t.tx + t.vx * Math.min(0.25, this.clock - t.snapT), ey = t.ty + t.vy * Math.min(0.25, this.clock - t.snapT);
      t.x += (ex - t.x) * k; t.y += (ey - t.y) * k; t.a += angD(t.a, t.taa) * k; t.ta += angD(t.ta, t.tta) * k;
      t.recoil = Math.max(0, t.recoil - dt * 6); t.hitT = Math.max(0, t.hitT - dt); t.tread += Math.hypot(t.vx, t.vy) * dt;
    }
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  }
}
NetView.prototype.raceRanking = function () { return this.raceOrder || this.tanks; };
NetView.prototype.ffaRanking = function () { return this.tanks.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0)); };
function angD(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

export class RemoteSession {
  constructor(app, transport, msg, opts = {}) {
    this.app = app; this.tr = transport; this.mode = msg.mode; this.online = true; this.canPause = false; this.paused = false; this.extra = {};
    this.view = new NetView(msg); this.camLock = msg.camLock ?? -1; this.meId = msg.me; this.pending = []; this.inT = 0; this.lastSent = null; this.opts = opts;
    this.off = (m) => { if (m.t === 's') this.pending.push(m); };
    transport.onMessage(this.off);
  }
  update(dt, inp) {
    const evs = []; for (const s of this.pending) this.view.apply(s, evs); this.pending.length = 0; this.view.smooth(dt);
    this.inT += dt; const key = [inp.mx.toFixed(2), inp.my.toFixed(2), inp.aim ? 1 : 0, (inp.ax || 0).toFixed(2), (inp.ay || 0).toFixed(2), inp.fire ? 1 : 0, inp.an || 0].join();
    if (this.inT > 1 / 30 && (key !== this.lastSent || this.inT > 0.25)) { this.inT = 0; this.lastSent = key; this.tr.send({ t: 'in', mx: inp.mx, my: inp.my, ax: inp.ax, ay: inp.ay, aim: inp.aim, fire: inp.fire, an: inp.an || 0, act: inp.act || null }); }
    return evs;
  }
  leave() { this.tr.send({ t: 'leave' }); }
  requeue() {}
  destroy() { this.tr.handlers = this.tr.handlers.filter(h => h !== this.off); }
}

export const ONLINE_URL = 'wss://pricopbum-server.onrender.com/ws';
export class NetClient {
  constructor(app) { this.app = app; this.status = 'offline'; this.tr = null; this.players = 0; }
  defaultUrl() {
    try { if (typeof window !== 'undefined' && window.__pbWsUrl) return window.__pbWsUrl(); } catch (e) {}
    try { const l = window.location; const native = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform(); if (!native && l && /^https?:$/.test(l.protocol) && l.hostname && (/onrender\.com$/.test(l.hostname) || (/^(localhost|127\.0\.0\.1)$/.test(l.hostname) && l.port))) return (l.protocol === 'https:' ? 'wss://' : 'ws://') + l.host + '/ws'; } catch (e) {}
    return ONLINE_URL;
  }
  set(st) { this.status = st; this.app.ui.setNetStatus(); }
  connect(url, attempt = 0) {
    url = url || this.defaultUrl(); if (/pages\.grok\.bot|cursor\.com/.test(url)) url = ONLINE_URL; if (/localhost:8080/.test(url) && !/^(localhost|127\.)/.test((typeof location !== 'undefined' && location.hostname) || '')) url = ONLINE_URL; if (!/^wss?:\/\//.test(url)) url = 'ws://' + url; try { if (typeof window !== 'undefined' && window.__pbSetServer) window.__pbSetServer(url); } catch (e) {}
    if (attempt === 0) this.wakeT0 = Date.now(); clearTimeout(this.retryT);
    this.app.meta.d.server = url; this.app.meta.save(); this.disconnect(); this.set('connecting');
    let tr; try { tr = new WsTransport(url); } catch (e) { this.set('error'); this.app.ui.toast('Неверный адрес сервера', 'info'); return; }
    this.tr = tr; const canRetry = () => /onrender\.com/.test(url) && Date.now() - this.wakeT0 < 90000;
    const retry = () => { tr.dead = true; tr.close(); if (this.tr === tr) this.tr = null; this.app.ui.toast('Сервер просыпается… подождите до минуты', 'globe'); this.retryT = setTimeout(() => { if (this.status === 'connecting') this.connect(url, attempt + 1); }, 2500); };
    const to = setTimeout(() => { if (this.status === 'connecting') { if (canRetry()) return retry(); this.set('error'); this.app.ui.toast('Сервер не отвечает', 'info'); tr.close(); } }, 12000);
    tr.onOpen(() => { const p = this.app.playerCfg(); tr.send({ t: 'hello', v: PROTO, name: p.name, skin: p.skin, weapon: p.weapon, lv: p.lv, tlv: p.tlv, model: p.model, tmod: p.tmod, build: p.build, loadout: p.loadout, cc: p.cc }); });
    tr.onMessage((m) => {
      if (m.t === 'welcome') { clearTimeout(to); this.players = m.players; try { if (typeof window !== 'undefined') { window.__pbServerFeatures = m.features || null; window.__pbLegacyServer = !m.features; if (window.__pbOnWelcome) window.__pbOnWelcome(m); } } catch (e) {} this.set('online'); if (this._rjPending) { const tk = this._rjPending; this._rjPending = null; tr.send({ t: 'rejoin', token: tk }); return; } const tourTok = this._tourToken; if (tourTok) { this._tourToken = null; tr.send({ t: 'tourRejoin', token: tourTok }); } this.app.ui.toast('Подключено к серверу', 'globe'); }
      else if (m.t === 'lobby') { this.players = m.players; if (this.status === 'online') this.app.ui.setNetStatus(); }
      else if (m.t === 'queue') { this.status = 'queue'; this.showQueue(m); }
      else if (m.t === 'rj') this.rejoinToken = m.token;
      else if (m.t === 'start') { this._rj = 0; this.closeQueue(); this.status = 'online'; this.app.startSession(new RemoteSession(this.app, tr, m)); }
      else if (m.t === 'room') { this.room = m; this.app.ui.roomLobby(m); }
      else if (m.t === 'roomGone') { this.room = null; this.app.ui.closeRoom(); if (m.msg) this.app.ui.toast(m.msg, 'info'); }
      else if (m.t === 'roomChat') { this.app.ui.roomChatMsg(m); }
      else if (m.t === 'tour') { if (m.token) this.tourToken = m.token; if (this.app.ui.tourNet) this.app.ui.tourNet(m); }
      else if (m.t === 'err') { this.app.ui.toast(m.msg || 'Ошибка сервера', 'info'); if (m.rejoin === false && this.app.state === 'game') this.app.quitToMenu(); }
    });
    tr.onClose(() => { clearTimeout(to); if (tr.dead) return; if (this.status === 'connecting' && canRetry()) return retry(); const was = this.status; this.tr = null; this.closeQueue();
      const inGame = this.app.state === 'game' && this.app.session && this.app.session.online && this.app.session.tr === tr;
      if (inGame && this.rejoinToken && (this._rj = (this._rj || 0) + 1) <= 3) { tr.dead = true; this._rjPending = this.rejoinToken; this.set('connecting'); this.app.ui.toast('Связь пропала, возвращаемся в бой…', 'info'); this.retryT = setTimeout(() => { if (this._rjPending) this.connect(url, 0); }, 600); return; }
      this.set(was === 'connecting' ? 'error' : 'offline'); if (inGame) { this.app.ui.toast('Соединение потеряно', 'info'); this.app.quitToMenu(); } });
  }
  disconnect() { if (this.tr) { const t = this.tr; this.tr = null; t.close(); } this.status = 'offline'; try { if (typeof window !== 'undefined' && window.__pbOnOffline) window.__pbOnOffline(); } catch (e) {} }
  tourRejoinToken() { return this.tourToken || null; }
  quickMatch(mode) { if (!this.tr) return this.app.ui.toast('Сначала подключитесь к серверу', 'info'); const p = this.app.playerCfg(); this.tr.send({ t: 'qm', mode, name: p.name, skin: p.skin, weapon: p.weapon, lv: p.lv, model: p.model, tmod: p.tmod, build: p.build, loadout: p.loadout }); }
  createRoom(variant) { if (!this.tr) return this.app.ui.toast('Сначала подключитесь к серверу', 'info'); const p = this.app.playerCfg(); this.tr.send({ t: 'create', variant, name: p.name, skin: p.skin, weapon: p.weapon, lv: p.lv, model: p.model, tmod: p.tmod, build: p.build, loadout: p.loadout }); }
  joinRoom(code) { if (!this.tr) return this.app.ui.toast('Сначала подключитесь к серверу', 'info'); const p = this.app.playerCfg(); this.tr.send({ t: 'join', code: String(code || '').toUpperCase().trim(), name: p.name, skin: p.skin, weapon: p.weapon, lv: p.lv, model: p.model, tmod: p.tmod, build: p.build, loadout: p.loadout }); }
  roomCmd(t, extra = {}) { if (this.tr) this.tr.send({ t, ...extra }); }
  showQueue(m) {
    const txt = 'Игроков: ' + m.n + ' · старт через ' + Math.max(0, Math.ceil(m.startIn)) + ' с';
    if (this.qov && this.qov.isConnected) { const p = this.qov.querySelector('[data-q]'); if (p) p.textContent = txt; return; }
    const hh = this.app.ui.h; this.qov = this.app.ui.modal([hh('h3', null, 'Поиск матча'), hh('p', null, VNAME[m.mode] || m.mode), hh('p', { data: { q: '' } }, txt), hh('p', { class: 'note' }, 'Свободные места займут боты'), hh('div', { class: 'btns' }, hh('button', { class: 'btn big', data: { m: 'cancel' } }, 'Отмена'))], (a) => { if (a === 'cancel' && this.tr) { this.tr.send({ t: 'cancel' }); this.status = 'online'; } }, { dismiss: false });
  }
  closeQueue() { if (this.qov) { this.qov.close(); this.qov = null; } }
}
