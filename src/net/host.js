import { normLoadout } from '../sim/loadout.js';
import { normTmod } from '../sim/tmods.js';
// Authoritative match host. Used by the Node server and by the phone hosting a Bluetooth game.
import { World } from '../sim/sim.js';
import { WEAPON_LIST, SHOP_WEAPONS, SKINS, UPGRADES } from '../sim/defs.js';
import { snapshot, startMsg, sanitizeInput, sanitizeName } from './protocol.js';
import { buildValid } from '../sim/models.js';

export function sanitizePlayer(p, free) {
  const lv = {}; for (const k of Object.keys(UPGRADES)) lv[k] = Math.max(0, Math.min(free ? UPGRADES[k].max : Math.min(2, UPGRADES[k].max), /* online «равные условия»: garage upgrades capped at level 2 */ (p.lv && +p.lv[k]) | 0));
  const tlv = Number.isInteger(+p.tlv) && +p.tlv >= 1 && +p.tlv <= 20 ? (+p.tlv | 0) : undefined;
  return { cid: p.cid, name: sanitizeName(p.name), skin: SKINS[p.skin] ? p.skin : 'olive', weapon: SHOP_WEAPONS.includes(p.weapon) ? p.weapon : 'cannon', lv, tmod: normTmod(p.tmod), tlv, model: Number.isInteger(p.model) && p.model >= 0 && p.model < 200 ? p.model : 0, cc: (typeof p.cc === 'string' && /^[A-Z]{2}$/.test(p.cc)) ? p.cc : undefined, build: buildValid(p.build) ? p.build.slice() : null, loadout: normLoadout(p.loadout), human: true, team: p.team === 0 || p.team === 1 ? p.team : undefined };
}
export class HostSession {
  constructor({ mode, players, opts = {}, send }) {
    this.mode = mode; this.send = send; this.clients = new Map();
    const ps = players.map(p => sanitizePlayer(p, !!opts.free)); // opts.free: host turned «равные условия» off
    this.world = new World({ mode, seed: (Math.random() * 1e9) | 0, players: ps, countdown: opts.countdown ?? 4, ...opts });
    for (const p of ps) { const t = this.world.tanks.find(x => x.cid === p.cid); this.clients.set(p.cid, { tank: t, tilePtr: this.world.map.changes.length, evBuf: [] }); t.baseWeapon = p.weapon; }
    this.tick = 0; this.ended = false; this.endT = 0; this.watchers = [];
  }
  addWatcher(client, sendFn) {
    this.watchers = this.watchers.filter(w => w.client !== client);
    this.watchers.push({ client, send: sendFn, tilePtr: this.world.map.changes.length, evBuf: [], spect: null });
  }
  removeWatcher(client) { this.watchers = (this.watchers || []).filter(w => w.client !== client); }
  startAll() { for (const [cid, c] of this.clients) this.send(cid, startMsg(this.world, c.tank.id)); }
  setInput(cid, inp) { const c = this.clients.get(cid); if (!c || !c.tank) return; Object.assign(c.tank.input, sanitizeInput(inp)); c.lastInput = Date.now(); }
  removePlayer(cid) { const c = this.clients.get(cid); if (!c) return; if (c.tank && c.tank.alive) { c.tank.human = false; c.tank.ai = { skill: 0.5, t: 0 }; c.tank.name += ' (бот)'; } this.clients.delete(cid); }
  step(dt) {
    const w = this.world; w.step(dt); this.tick++;
    for (const c of this.clients.values()) for (const e of w.events) c.evBuf.push(e);
    for (const watcher of this.watchers) for (const e of w.events) watcher.evBuf.push(e);
    if (this.tick % (this.netDiv || 3) === 0) this.broadcast();
    if (w.result && !this.ended) { this.ended = true; }
    if (this.ended) this.endT += dt;
  }
  broadcast() {
    const w = this.world, m = w.map;
    for (const [cid, c] of this.clients) {
      const tiles = []; for (let i = c.tilePtr; i < m.changes.length; i++) { const idx = m.changes[i]; tiles.push(idx, m.t[idx]); } c.tilePtr = m.changes.length;
      let focus = c.tank; if (focus && !focus.alive && w.mode === 'br') { if (!c.spect || !c.spect.alive) c.spect = w.tanks.find(t => t.alive); focus = c.spect || focus; }
      this.send(cid, snapshot(w, focus, c.evBuf, tiles, w.mode !== 'br', c.tank));
      c.evBuf.length = 0;
    }
    for (const watcher of this.watchers) {
      const tiles = []; for (let i = watcher.tilePtr; i < m.changes.length; i++) { const idx = m.changes[i]; tiles.push(idx, m.t[idx]); } watcher.tilePtr = m.changes.length;
      if (!watcher.spect || !watcher.spect.alive) watcher.spect = w.tanks.find(t => t.alive) || w.tanks[0];
      if (watcher.spect) watcher.send(snapshot(w, watcher.spect, watcher.evBuf, tiles, true, null));
      watcher.evBuf.length = 0;
    }
    // Drop tile deltas every client has already been offered, so the change log cannot grow for the whole match.
    let min = Infinity;
    for (const c of this.clients.values()) if (c.tilePtr < min) min = c.tilePtr;
    for (const watcher of this.watchers) if (watcher.tilePtr < min) min = watcher.tilePtr;
    if (min > 0 && min < Infinity && m.changes) { m.changes.splice(0, min); for (const c of this.clients.values()) c.tilePtr -= min; for (const watcher of this.watchers) watcher.tilePtr -= min; }
  }
  get humans() { return this.clients.size; }
}
