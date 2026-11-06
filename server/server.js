// PRICOPBUM game server: static hosting of www/ + WebSocket matchmaking (/ws) with authoritative simulation.
// Run: node server/server.js   (env: PORT=8080, QUEUE_SECONDS=12, MAX_ROOMS=20)
import { normTmod } from '../src/sim/tmods.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { HostSession } from '../src/net/host.js';
import { PROTO, sanitizeName, startMsg } from '../src/net/protocol.js';
import crypto from 'crypto';
import { VARIANTS } from '../src/sim/defs.js';
import { MAPS, decodeMap } from '../src/sim/maps.js';
import { buildValid, MODELS } from '../src/sim/models.js';
import { normLoadout } from '../src/sim/loadout.js';
import { openStore, defaultDbFile, createAccount, getAccount, spendLegendary, creditMatch, validToken, tmodForModel } from '../src/account/store.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(__dir, '../www');
const PORT = +process.env.PORT || 8080, QUEUE_SECONDS = +(process.env.QUEUE_SECONDS ?? 12), MAX_ROOMS = +process.env.MAX_ROOMS || 20;
// r31: cheap defaults for Render free (0.1 CPU): cap tanks per online room and send 15 snapshots/s. Override with MAX_TANKS / NET_HZ.
const MAX_TANKS = +process.env.MAX_TANKS || 24, NET_HZ = +process.env.NET_HZ || 15;
// max humans per room; free slots are filled with bots
const CAP = { moba: 10, br: 100, brg: 100, cbr: 100, cbr2: 100, cbr3: 100, cbr4: 100, cbr5: 100, cbr20: 100, ffa: 30, team: 20, team20: 40, arena: 6, duel: 2, koth: 10, sniper: 10, ctf: 10, hunt: 6, trench: 30, race: 8, survival: 8, zombie: 8, boss: 8, coop: 4 };
const MAP_SIZES = { arena: [72, 48], duel: [72, 48], koth: [110, 72], sniper: [110, 72], ctf: [100, 64], hunt: [120, 80], trench: [220, 130] };
export function roomOpts(variant, n, cfg) {
  const V = VARIANTS[variant]; const o = { ...V.opts, variant }; cfg = cfg || {};
  if (V.mode === 'br' && !o.ffa && !o.giant) o.total = 100;
  if (V.mode === 'team' && o.special !== 'moba' && o.special !== 'race') { const sz = MAP_SIZES[variant] || [150, 96]; o.mapW = sz[0]; o.mapH = sz[1];
    if (cfg.map === 'custom' && cfg.custom && decodeMap(cfg.custom)) o.custom = cfg.custom; else o.map = Number.isInteger(cfg.map) && cfg.map >= 0 && cfg.map < MAPS.length ? cfg.map : (o.map ?? Math.floor(Math.random() * MAPS.length)); }
  // «Игра с друзьями»: host settings
  if (cfg.size) { if (V.mode === 'team' && !['survival', 'zombie', 'boss', 'race'].includes(o.special)) o.perTeam = cfg.size; else if (V.mode === 'br' && !o.ffa) o.squad = Math.min(5, cfg.size); }
  if (V.mode === 'team' && !['survival', 'zombie', 'boss', 'race'].includes(o.special)) o.perTeam = Math.max(o.perTeam || 10, Math.ceil(n / 2));
  if (variant === 'race') o.total = Math.max(cfg.bots === false ? 1 : 8, n);
  if (o.ffa) { o.total = Math.max(o.total, n); }
  if (cfg.bots === false) { if (V.mode === 'br') o.total = n; else o.noBots = true; }
  if (cfg.diff != null) o.diff = cfg.diff;
  if (cfg.time) { if (V.mode === 'br' && !o.ffa) o.brTime = cfg.time; else o.timeLimit = cfg.time; }
  if (cfg.target) { if (V.mode === 'br' && !o.ffa) o.brKills = cfg.target; else o.target = cfg.target; }
  if (cfg.equal === false) o.free = true; else o.equal = true; // r20: «Равные условия» also removes mythic +20% HP/dmg
  if (cfg.cam != null && cfg.cam >= 0) o.camLock = cfg.cam;
  if (variant === 'br' || variant === 'brg') o.terrain = 1; // r37: hills & craters in the big BR
  if (variant === 'trench') { o.map = V.opts.map; delete o.custom; o.mapW = 220; o.mapH = 130; o.timeLimit = cfg.time || 900; o.target = V.opts.target; } // r37 «Траншеи»: fixed 220×130 map, 15 min, most kills wins
  if (variant === 'hunt') { o.map = V.opts.map; delete o.custom; o.mapW = 120; o.mapH = 80; o.perTeam = 5; o.timeLimit = 600; o.target = V.opts.target; } // r36 «Охота»: fixed BUGA.BUM, 1 target + 5 hunters, 10 min
  if (o.total) o.total = Math.max(n, Math.min(o.total, MAX_TANKS)); if (o.perTeam) o.perTeam = Math.max(Math.ceil(n / 2), Math.min(o.perTeam, MAX_TANKS >> 1));
  if (variant === 'trench') o.perTeam = 15; // 15×15 = 30 tanks. The general MAX_TANKS cap still limits battle royale. 150 players are not enabled.
  return { mode: V.mode, opts: o };
}
const ROOM_VARIANTS = Object.keys(CAP);
const QUICK = ['Привет!', 'Готов!', 'Подождите', 'Начинаем?', 'Я за синих', 'Я за красных', 'Удачи!', 'GG'];
function normCfg(m, prev) { const c = { ...prev }; const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
  if (CAP[m.variant]) c.variant = m.variant;
  if (m.map === 'custom' && typeof m.custom === 'string' && m.custom.length < 40000 && decodeMap(m.custom)) { c.map = 'custom'; c.custom = m.custom; } else if (m.map === -1 || int(m.map, 0, MAPS.length - 1)) { c.map = m.map; c.custom = null; }
  if (m.size === 0 || int(m.size, 1, 30)) c.size = m.size; if (typeof m.bots === 'boolean') c.bots = m.bots; if (int(m.diff, 0, 4)) c.diff = m.diff;
  if (m.time === 0 || int(m.time, 60, 3600)) c.time = m.time; if (m.target === 0 || int(m.target, 1, 500)) c.target = m.target; if (typeof m.equal === 'boolean') c.equal = m.equal; if (int(m.cam, -1, 2)) c.cam = m.cam;
  return c; }
const DEF_CFG = { variant: 'team', map: -1, custom: null, size: 0, bots: true, diff: 1, time: 0, target: 0, equal: true, cam: -1 };
const codes = new Map(); // private rooms: code -> { code, variant, owner, members: Map }
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { for (;;) { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; if (!codes.has(s)) return s; } }
function roomInfo(r) { const cfg = { ...r.cfg, custom: r.cfg.custom ? true : null }; return { t: 'room', code: r.code, variant: r.cfg.variant, cfg, owner: r.owner, cap: CAP[r.cfg.variant], members: [...r.members.values()].map(c => ({ id: c.id, name: c.hello.name, team: c.team ?? null, ready: !!c.ready || c.id === r.owner })) }; }
function roomBroadcast(r) { const m = roomInfo(r); for (const c of r.members.values()) send(c, { ...m, me: c.id }); }
function leavePrivate(c, msg) { const r = c.priv; if (!r) return; r.members.delete(c.id); c.priv = null; send(c, { t: 'roomGone', msg });
  if (!r.members.size) codes.delete(r.code); else { if (r.owner === c.id) r.owner = r.members.keys().next().value; roomBroadcast(r); } }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.css': 'text/css' };
const accounts = openStore(defaultDbFile());
function readBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}
function sendJson(res, code, obj) { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(b); }
function getAccountSafe(token) { return getAccount(accounts, token) || { ok: false }; }
function applyAccountTmod(c) {
  if (!c.accountToken || !c.hello) return;
  const M = MODELS[c.hello.model];
  if (!M || M.rar >= 4) { c.hello.tmod = null; return; }
  if (M.rar === 3) c.hello.tmod = tmodForModel(accounts, c.accountToken, M.id);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/account' && req.method === 'GET') return sendJson(res, 200, getAccountSafe(u.searchParams.get('token')));
  if (u.pathname === '/api/account' && req.method === 'POST') { readBody(req).then((body) => { const acc = createAccount(accounts, { token: body.token, name: body.name, local: body.local }); sendJson(res, 200, acc); }).catch(() => sendJson(res, 400, { ok: false })); return; }
  if (u.pathname === '/api/account/spend' && req.method === 'POST') { readBody(req).then((body) => sendJson(res, 200, spendLegendary(accounts, body.token, body.model, body.track))).catch(() => sendJson(res, 400, { ok: false })); return; }
  if (u.pathname === '/privacy' || u.pathname === '/privacy/') { try { const b = fs.readFileSync(path.join(WWW, 'privacy.html')); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(b); } catch (e) { res.writeHead(404); return res.end('not found'); } }
  if (u.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('PRICOPBUM server OK'); }
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, players: clients.size, rooms: rooms.size, privateRooms: codes.size, stepMs: +stepStat.avg.toFixed(3), stepMaxMs: +stepStat.max.toFixed(3), maxTanks: MAX_TANKS, netHz: NET_HZ, list: [...rooms.values()].map(r => ({ id: r.id, variant: r.mode, humans: r.members.size, tanks: r.host.world.tanks.length, alive: r.host.world.tanks.filter(t => t.alive).length })) })); }
  let p = path.normalize(path.join(WWW, decodeURIComponent(u.pathname)));
  if (!p.startsWith(WWW)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(data); });
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096, perMessageDeflate: { threshold: 512, zlibDeflateOptions: { level: 1 }, serverNoContextTakeover: false, concurrencyLimit: 4 } });
const clients = new Map(); let nextCid = 1;
const queues = Object.fromEntries(Object.keys(CAP).map(k => [k, []])); const queueStart = Object.fromEntries(Object.keys(CAP).map(k => [k, 0]));
const rooms = new Map(); let nextRoom = 1;

const send = (c, o) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };
function lobbyInfo() { for (const c of clients.values()) if (!c.room) send(c, { t: 'lobby', players: clients.size }); }

wss.on('connection', (ws, req) => {
  const c = { id: 'c' + nextCid++, ws, room: null, mode: null, hello: null, msgs: 0, win: Date.now() };
  clients.set(c.id, c);
  ws.on('message', (data) => {
    const now = Date.now(); if (now - c.win > 1000) { c.win = now; c.msgs = 0; } if (++c.msgs > 90) return; // rate limit
    let m; try { m = JSON.parse(data); } catch (e) { return; } if (!m || typeof m.t !== 'string') return;
    if (m.t === 'rejoin') return adoptRejoin(c, m.token);
    if (m.t === 'hello') { if (m.v !== PROTO) return send(c, { t: 'err', msg: 'Обновите игру: версия протокола отличается' }); const tlv = Number.isInteger(+m.tlv) && +m.tlv >= 1 && +m.tlv <= 20 ? (+m.tlv | 0) : undefined; c.accountToken = validToken(m.acct); c.hello = { name: sanitizeName(m.name), cc: (typeof m.cc === 'string' && /^[A-Z]{2}$/.test(m.cc)) ? m.cc : undefined, skin: m.skin, weapon: m.weapon, lv: m.lv, tlv, tmod: normTmod(m.tmod), model: Number.isInteger(m.model) && m.model >= 0 && m.model < 200 ? m.model : 0, build: buildValid(m.build) ? m.build : null, loadout: normLoadout(m.loadout) }; applyAccountTmod(c); send(c, { t: 'welcome', id: c.id, players: clients.size, acct: !!c.accountToken }); lobbyInfo(); }
    else if (m.t === 'qm') { if (!c.hello || c.room) return; const mode = CAP[m.mode] ? m.mode : 'br'; leavePrivate(c); leaveQueue(c); c.hello = { ...c.hello, name: sanitizeName(m.name || c.hello.name), skin: m.skin, weapon: m.weapon, lv: m.lv, tmod: normTmod(m.tmod), model: Number.isInteger(m.model) && m.model >= 0 && m.model < 200 ? m.model : 0, build: buildValid(m.build) ? m.build : null, loadout: normLoadout(m.loadout) }; applyAccountTmod(c); c.mode = mode; queues[mode].push(c); if (queues[mode].length === 1) queueStart[mode] = Date.now(); queueTick(); }
    else if (m.t === 'cancel') leaveQueue(c);
    else if (m.t === 'create') { if (!c.hello || c.room) return; leaveQueue(c); leavePrivate(c); const variant = CAP[m.variant] ? m.variant : 'team'; c.team = null; c.ready = false; c.hello = { ...c.hello, name: sanitizeName(m.name || c.hello.name), skin: m.skin, weapon: m.weapon, lv: m.lv, tmod: normTmod(m.tmod), model: Number.isInteger(m.model) && m.model >= 0 && m.model < 200 ? m.model : 0, build: buildValid(m.build) ? m.build : null, loadout: normLoadout(m.loadout) }; applyAccountTmod(c);
      const r = { code: newCode(), cfg: normCfg(m.cfg || {}, { ...DEF_CFG, variant }), owner: c.id, members: new Map([[c.id, c]]), created: Date.now() }; codes.set(r.code, r); c.priv = r; roomBroadcast(r); }
    else if (m.t === 'join') { if (!c.hello || c.room) return; const r = codes.get(String(m.code || '').toUpperCase()); if (!r) return send(c, { t: 'err', msg: 'Комната с таким кодом не найдена' });
      if (r.members.size >= CAP[r.cfg.variant]) return send(c, { t: 'err', msg: 'Комната заполнена' }); if (r.kicked && r.kicked.has(c.id)) return send(c, { t: 'err', msg: 'Создатель комнаты исключил вас' }); leaveQueue(c); leavePrivate(c); c.team = null; c.ready = false; c.hello = { ...c.hello, name: sanitizeName(m.name || c.hello.name), skin: m.skin, weapon: m.weapon, lv: m.lv, tmod: normTmod(m.tmod), model: Number.isInteger(m.model) && m.model >= 0 && m.model < 200 ? m.model : 0, build: buildValid(m.build) ? m.build : null, loadout: normLoadout(m.loadout) }; applyAccountTmod(c); r.members.set(c.id, c); c.priv = r; roomBroadcast(r); }
    else if (m.t === 'roomTeam') { const r = c.priv; if (!r) return; c.team = m.team === 0 || m.team === 1 ? m.team : null; roomBroadcast(r); }
    else if (m.t === 'roomVariant') { const r = c.priv; if (!r || r.owner !== c.id || !CAP[m.variant]) return; r.cfg.variant = m.variant; roomBroadcast(r); }
    else if (m.t === 'roomCfg') { const r = c.priv; if (!r || r.owner !== c.id || !m.cfg) return; r.cfg = normCfg(m.cfg, r.cfg); for (const x of r.members.values()) if (x.id !== r.owner) x.ready = false; roomBroadcast(r); }
    else if (m.t === 'roomReady') { const r = c.priv; if (!r) return; c.ready = !!m.ready; roomBroadcast(r); }
    else if (m.t === 'roomKick') { const r = c.priv; if (!r || r.owner !== c.id || m.id === c.id) return; const x = r.members.get(m.id); if (!x) return; (r.kicked = r.kicked || new Set()).add(x.id); leavePrivate(x, 'Создатель комнаты исключил вас'); }
    else if (m.t === 'roomChat') { const r = c.priv; if (!r || !Number.isInteger(m.q) || !QUICK[m.q]) return; const now2 = Date.now(); if (now2 - (c.chatT || 0) < 800) return; c.chatT = now2; for (const x of r.members.values()) send(x, { t: 'roomChat', name: c.hello.name, q: m.q }); }
    else if (m.t === 'roomLeave') leavePrivate(c);
    else if (m.t === 'roomStart') { const r = c.priv; if (!r || r.owner !== c.id) return; if (rooms.size >= MAX_ROOMS) return send(c, { t: 'err', msg: 'Сервер заполнен, попробуйте позже' });
      const notReady = [...r.members.values()].filter(x => x.id !== r.owner && !x.ready).length; if (notReady && !m.force) return send(c, { t: 'err', msg: 'Не все игроки готовы: ' + notReady });
      codes.delete(r.code); const mem = [...r.members.values()].slice(0, CAP[r.cfg.variant]); for (const x of mem) { x.priv = null; x.ready = false; } startRoom(r.cfg.variant, mem, r.code, r.cfg); }
    else if (m.t === 'in') { if (c.room) c.room.host.setInput(c.id, m); }
    else if (m.t === 'leave') leaveRoom(c);
  });
  ws.on('close', () => { leaveQueue(c); leavePrivate(c); if (!armRejoin(c)) leaveRoom(c); clients.delete(c.id); lobbyInfo(); });
});
function leaveQueue(c) { for (const k of Object.keys(queues)) { const i = queues[k].indexOf(c); if (i >= 0) queues[k].splice(i, 1); } }
function leaveRoom(c) { if (!c.room) return; c.room.host.removePlayer(c.id); c.room.members.delete(c.id); c.room = null; }

function queueTick() {
  const now = Date.now();
  for (const mode of Object.keys(queues)) {
    const q = queues[mode]; if (!q.length) continue;
    const startIn = QUEUE_SECONDS - (now - queueStart[mode]) / 1000;
    if ((startIn <= 0 || q.length >= CAP[mode]) && rooms.size < MAX_ROOMS) startRoom(mode, q.splice(0, CAP[mode]));
    else for (const c of q) send(c, { t: 'queue', mode, n: q.length, startIn });
    if (q.length) queueStart[mode] = queueStart[mode] || now;
  }
}
const REJOIN_MS = +(process.env.REJOIN_MS ?? 45000);
const parked = new Map();
let shuttingDown = false;
function armRejoin(c) {
  if (shuttingDown || !c.room || !c.rejoinToken || c.room.host.ended || c.room.host.world.result) return false;
  c.suspended = true;
  const token = c.rejoinToken, prev = parked.get(token);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => { parked.delete(token); if (c.suspended && c.room) { c.suspended = false; leaveRoom(c); } }, REJOIN_MS);
  parked.set(token, { c, timer });
  return true;
}
function adoptRejoin(c, token) {
  const slot = parked.get(String(token || ''));
  if (!slot || !slot.c.room || slot.c.room.host.ended) return send(c, { t: 'err', msg: 'Бой уже закончился', rejoin: false });
  clearTimeout(slot.timer); parked.delete(slot.c.rejoinToken);
  const old = slot.c, room = old.room, hs = room.host.clients.get(old.id);
  if (!hs || !hs.tank) return send(c, { t: 'err', msg: 'Бой уже закончился', rejoin: false });
  room.wire.delete(old.id); room.members.delete(old.id);
  room.wire.set(c.id, c); room.members.set(c.id, c);
  room.host.clients.delete(old.id); room.host.clients.set(c.id, hs); hs.tank.cid = c.id;
  c.room = room; c.hello = old.hello; c.accountToken = old.accountToken; c.rejoinToken = old.rejoinToken; c.suspended = false; c.mode = old.mode;
  old.room = null; old.suspended = false;
  send(c, startMsg(room.host.world, hs.tank.id));
  send(c, { t: 'rj', token: c.rejoinToken, ms: REJOIN_MS });
  room.host.broadcast();
}
function startRoom(variant, members, code, cfg) {
  const id = nextRoom++; const wire = new Map(members.map(c => [c.id, c]));
  const players = members.map(c => ({ ...c.hello, cid: c.id, team: c.team ?? undefined }));
  const { mode, opts } = roomOpts(variant, members.length, cfg); if (code) opts.code = code;
  { const avg = (rar) => { const L = players.filter(p => p.tmod && MODELS[p.model] && MODELS[p.model].rar === rar && (rar < 4 || opts.payments)).map(p => p.tmod); return L.length ? L[0].map((_, i) => Math.round(L.reduce((a, b) => a + b[i], 0) / L.length)) : null; }; const lg = avg(3), my = avg(4); if (lg) opts.botMods = lg; if (my && opts.payments) opts.botMythMods = my; } // legendary coin mods only, unless real-money checkout is explicitly enabled
  if (variant === 'hunt' && members.length) { let lo = Infinity; for (const c of members) lo = Math.min(lo, c.huntN | 0); const P = members.filter(c => (c.huntN | 0) === lo), T = P[Math.floor(Math.random() * P.length)]; T.huntN = (T.huntN | 0) + 1; opts.huntTarget = T.id; for (const p of players) p.team = undefined; } // the target role rotates — whoever was target least often
  const room = { id, mode: variant, host: null, members: wire, wire, created: Date.now() };
  const host = new HostSession({ mode, players, opts, send: (cid, msg) => { const cl = wire.get(cid); if (cl && !cl.suspended) send(cl, msg); } }); host.netDiv = Math.max(1, Math.round(60 / NET_HZ));
  room.host = host;
  for (const c of members) { c.room = room; c.suspended = false; c.rejoinToken = crypto.randomBytes(9).toString('base64url'); }
  rooms.set(id, room); host.startAll();
  for (const c of members) send(c, { t: 'rj', token: c.rejoinToken, ms: REJOIN_MS });
  console.log(`[room ${id}] ${variant}${code ? ' #' + code : ''} started with ${members.length} players`);
}
// fixed-step simulation for all rooms — started with the listener, so importing this module does not spin a loop
let last = process.hrtime.bigint(), acc = 0; const STEP = 1 / 60; const stepStat = { avg: 0, max: 0, n: 0 };
let loopsOn = false;
const timers = [];
const every = (ms, fn) => { const id = setInterval(fn, ms); timers.push(id); return id; };
function creditRoom(room) {
  const w = room.host.world, res = w.result || {};
  for (const cl of room.wire.values()) {
    if (!cl.accountToken) continue;
    const hs = room.host.clients.get(cl.id), tank = hs && hs.tank;
    if (!tank) continue;
    const win = w.mode === 'team' ? res.winnerTeam === tank.team : w.mode === 'br' ? (res.winner === tank.id || tank.place === 1) : !!res.win;
    const summary = { mode: w.mode, variant: w.opts.variant || w.special || null, kills: tank.kills | 0, place: tank.place || 0, total: w.tanks.length, win, rew: w.diff ? w.diff.rew : 1, online: true };
    const acc = creditMatch(accounts, cl.accountToken, 'room-' + room.id, summary);
    if (acc) send(cl, { t: 'acct', ...acc });
  }
}
export function startServer(port = PORT) {
  shuttingDown = false;
  if (!loopsOn) {
    loopsOn = true;
    every(10000, () => { stepStat.max = 0; });
    every(4, () => {
      const now = process.hrtime.bigint(); acc += Number(now - last) / 1e9; last = now; if (acc > 0.25) acc = 0.25;
      while (acc >= STEP) { acc -= STEP; const t0 = process.hrtime.bigint(); for (const r of rooms.values()) { r.host.step(STEP); if (r.host.world.result && !r.credited) { r.credited = true; creditRoom(r); } if ((r.host.ended && r.host.endT > 15) || (r.members.size === 0 && !parkedHas(r))) { for (const c of r.members.values()) c.room = null; rooms.delete(r.id); console.log(`[room ${r.id}] closed`); } }
        const ms = Number(process.hrtime.bigint() - t0) / 1e6; stepStat.avg = stepStat.avg * 0.98 + ms * 0.02; stepStat.max = Math.max(stepStat.max, ms); }
    });
    every(1000, queueTick);
  }
  if (server.listening) return Promise.resolve(server);
  return new Promise((resolve) => server.listen(port, '0.0.0.0', () => { console.log(`PRICOPBUM server on http://0.0.0.0:${server.address().port}  (ws path /ws)`); resolve(server); }));
}
function parkedHas(r) { for (const slot of parked.values()) if (slot.c.room === r) return true; return false; }
export function stopServer() {
  shuttingDown = true;
  for (const id of timers) clearInterval(id);
  timers.length = 0; loopsOn = false;
  for (const slot of parked.values()) clearTimeout(slot.timer);
  parked.clear();
  return new Promise((resolve) => { if (!server.listening) resolve(); else server.close(() => resolve()); });
}
const isMain = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) startServer(PORT);
