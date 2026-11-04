// Local multiplayer over Bluetooth / Wi-Fi Direct using Google Nearby Connections (Android, Capacitor plugin "PricopbumNearby").
// The hosting phone runs the authoritative HostSession; guests are RemoteSessions over a NearbyTransport.
import { HostSession } from './host.js';
import { RemoteSession } from './client.js';
import { PROTO } from './protocol.js';

class NearbyTransport {
  constructor(plugin, endpointId) { this.p = plugin; this.ep = endpointId; this.handlers = []; this.closeHandlers = []; }
  send(o) { this.p.send({ endpointId: this.ep, data: JSON.stringify(o) }).catch(() => {}); }
  onMessage(h) { this.handlers.push(h); } onClose(h) { this.closeHandlers.push(h); }
  deliver(m) { for (const h of this.handlers) h(m); } closed() { for (const h of this.closeHandlers) h(); }
  close() { this.p.disconnect({ endpointId: this.ep }).catch(() => {}); }
}

class HostedSession {
  constructor(app, host, cid) { this.app = app; this.host = host; this.cid = cid; this.mode = host.mode; this.online = true; this.canPause = false; this.paused = false; this.extra = {}; this.acc = 0; this.evBuf = []; this.meId = host.world.tanks.find(t => t.cid === cid).id; }
  get view() { return this.host.world; }
  update(dt, inp) { this.evBuf.length = 0; this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n < 6) { this.host.setInput(this.cid, inp); this.host.step(1 / 60); for (const e of this.host.world.events) this.evBuf.push(e); this.acc -= 1 / 60; n++; } if (n === 6) this.acc = 0; return this.evBuf; }
  leave() {} destroy() { this.app.bt.stop(); }
}

export class Bluetooth {
  constructor(app) { this.app = app; this.role = null; this.peers = new Map(); this.found = new Map(); this.state = 'idle'; this.listeners = []; }
  get plugin() { try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PricopbumNearby; } catch (e) { return null; } }
  get available() { return !!this.plugin; }
  statusText() { if (!this.available) return 'только в Android-версии'; return { idle: 'готово', hosting: 'ожидание игроков', searching: 'поиск игр…', joined: 'подключено', }[this.state] || this.state; }
  panel(h) {
    const B = (cls, a, v, t, st) => h('button', { class: 'btn ' + cls, style: st, data: { a, v } }, t), note = (t) => h('p', { class: 'note' }, t);
    if (!this.available) return note('Игра с друзьями рядом без интернета через Bluetooth и Wi-Fi Direct. Доступно в Android-версии приложения: один телефон создаёт игру, остальные подключаются.');
    if (this.state === 'hosting') { const list = [...this.peers.values()].map(p => h('div', { class: 'row' }, '• ' + p.name));
      return [h('p', null, 'Игроков: ' + (this.peers.size + 1)), list.length ? list : note('Пока никого. Друзья нажимают «Найти игру».'), h('div', { class: 'btns', style: 'display:flex;flex-direction:column;gap:8px;margin-top:8px' }, B('y big', 'btstart', 'team', 'Начать: командный бой'), B('b big', 'btstart', 'br', 'Начать: королевская битва'), B('', 'btstop', null, 'Отмена'))]; }
    if (this.state === 'searching') { const list = [...this.found.entries()].map(([id, n]) => B('', 'btpick', id, n, 'width:100%;margin:4px 0'));
      return [list.length ? list : note('Ищем игры поблизости…'), B('', 'btstop', null, 'Отмена', 'margin-top:8px')]; }
    if (this.state === 'joined') return [h('p', null, 'Ждём, пока хост начнёт бой…'), B('', 'btstop', null, 'Выйти')];
    return h('div', { class: 'btns', style: 'display:flex;gap:8px' }, B('y grow', 'bthost', null, 'Создать игру'), B('b grow', 'btjoin', null, 'Найти игру'));
  }
  refresh() { this.app.ui.setNetStatus(); }
  async listen() {
    const p = this.plugin; this.unlisten();
    const on = async (ev, fn) => { const h = await p.addListener(ev, fn); this.listeners.push(h); };
    await on('endpointFound', (e) => { this.found.set(e.endpointId, e.name || 'Игра'); this.refresh(); });
    await on('endpointLost', (e) => { this.found.delete(e.endpointId); this.refresh(); });
    await on('connectionRequest', (e) => { if (this.role === 'host' && this.peers.size >= 7) p.reject({ endpointId: e.endpointId }); else p.accept({ endpointId: e.endpointId }); });
    await on('connected', (e) => { if (this.role === 'host') { const tr = new NearbyTransport(p, e.endpointId); this.peers.set(e.endpointId, { tr, name: e.name || 'Игрок', hello: null }); this.refresh(); } else { this.hostTr = new NearbyTransport(p, e.endpointId); this.state = 'joined'; const c = this.app.playerCfg(); this.hostTr.send({ t: 'hello', v: PROTO, name: c.name, skin: c.skin, weapon: c.weapon, lv: c.lv }); this.refresh(); } });
    await on('disconnected', (e) => { if (this.role === 'host') { const pr = this.peers.get(e.endpointId); if (pr) { this.peers.delete(e.endpointId); if (this.hostSession) this.hostSession.removePlayer(e.endpointId); this.refresh(); } } else if (this.hostTr) { this.hostTr.closed(); this.hostTr = null; this.app.ui.toast('Связь с хостом потеряна', 'bt'); if (this.app.state === 'game' && this.app.session && this.app.session.online) this.app.quitToMenu(); this.state = 'idle'; this.refresh(); } });
    await on('message', (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (this.role === 'host') { const pr = this.peers.get(e.endpointId); if (!pr) return; if (m.t === 'hello') { pr.hello = m; pr.name = m.name; this.refresh(); } else if (m.t === 'in' && this.hostSession) this.hostSession.setInput(e.endpointId, m); }
      else if (this.hostTr) { if (m.t === 'start') this.app.startSession(new RemoteSession(this.app, this.hostTr, m)); this.hostTr.deliver(m); } });
  }
  unlisten() { for (const h of this.listeners) try { h.remove(); } catch (e) {} this.listeners = []; }
  async ensurePerms() { try { const r = await this.plugin.requestPermissions(); return r && r.granted !== false; } catch (e) { return true; } }
  async host() {
    if (!this.available) return this.app.ui.toast('Доступно в Android-версии', 'bt');
    if (!(await this.ensurePerms())) return this.app.ui.toast('Нужно разрешение на Bluetooth и устройства рядом', 'bt');
    this.role = 'host'; this.peers.clear(); await this.listen();
    try { await this.plugin.startAdvertising({ name: this.app.meta.d.name }); this.state = 'hosting'; } catch (e) { this.app.ui.toast('Не удалось начать: ' + (e.message || e), 'bt'); this.state = 'idle'; }
    this.refresh();
  }
  async join() {
    if (!this.available) return this.app.ui.toast('Доступно в Android-версии', 'bt');
    if (!(await this.ensurePerms())) return this.app.ui.toast('Нужно разрешение на Bluetooth и устройства рядом', 'bt');
    this.role = 'guest'; this.found.clear(); await this.listen();
    try { await this.plugin.startDiscovery(); this.state = 'searching'; } catch (e) { this.app.ui.toast('Поиск не удался: ' + (e.message || e), 'bt'); this.state = 'idle'; }
    this.refresh();
  }
  async pick(id) { try { await this.plugin.requestConnection({ endpointId: id, name: this.app.meta.d.name }); this.app.ui.toast('Подключение…', 'bt'); } catch (e) { this.app.ui.toast('Не удалось подключиться', 'bt'); } }
  startMatch(mode) {
    if (this.role !== 'host') return; try { this.plugin.stopAdvertising(); } catch (e) {}
    const me = { ...this.app.playerCfg(), cid: 'host' };
    const players = [me, ...[...this.peers.entries()].map(([id, p]) => ({ ...(p.hello || {}), name: p.name, cid: id }))];
    const opts = mode === 'br' ? { total: 40, mapSize: 200 } : { perTeam: Math.max(5, Math.ceil(players.length / 2)) };
    const hs = new HostSession({ mode, players, opts, send: (cid, msg) => { if (cid === 'host') return; const p = this.peers.get(cid); if (p) p.tr.send(msg); } });
    this.hostSession = hs; hs.startAll();
    this.app.startSession(new HostedSession(this.app, hs, 'host'));
  }
  stop() { const p = this.plugin; if (!p) return; try { p.stopAdvertising(); p.stopDiscovery(); p.disconnectAll(); } catch (e) {} this.unlisten(); this.peers.clear(); this.found.clear(); this.hostSession = null; this.hostTr = null; this.state = 'idle'; this.role = null; }
}
