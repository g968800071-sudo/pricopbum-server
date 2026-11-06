// Hosted knockout for real connected sockets. Empty seats are not filled with bots.
// A clock that ends level advances the earlier seed. That is a tie-break, not a pretend player.
import crypto from 'crypto';

const SIZES = new Set([2, 4, 8]);

export function createTourneyBook({ send, startMatch, roomById }) {
  const tours = new Map();
  const byClient = new Map();
  const open = new Map();
  let seq = 1;

  function view(T, you) {
    return {
      t: 'tour', id: T.id, phase: T.phase, size: T.size, practice: false, humansOnly: true,
      you, token: you && T.members.get(you) ? T.members.get(you).token : null,
      members: [...T.members.values()].map(m => ({ id: m.id, name: m.name, ready: !!m.ready, alive: m.alive !== false })),
      rounds: T.rounds, live: T.live.map(m => ({ a: m.a, b: m.b, winner: m.winner, killsA: m.killsA | 0, killsB: m.killsB | 0, roomId: m.roomId })),
      champion: T.champion || null,
    };
  }
  function pub(T) { for (const m of T.members.values()) if (m.client) send(m.client, view(T, m.id)); }
  function findToken(token) {
    for (const T of tours.values()) {
      const id = T.tokenOf.get(token);
      if (id && T.members.has(id)) return { T, id };
    }
    return null;
  }
  function join(c, size) {
    if (!c.hello) return;
    size = SIZES.has(size | 0) ? (size | 0) : 4;
    if (byClient.has(c.id)) return pub(byClient.get(c.id));
    let T = open.get(size);
    if (!T || T.phase !== 'lobby' || T.members.size >= T.size) {
      T = { id: 't' + (seq++), size, phase: 'lobby', members: new Map(), tokenOf: new Map(), rounds: [], live: [], champion: null };
      tours.set(T.id, T); open.set(size, T);
    }
    const token = crypto.randomBytes(9).toString('base64url');
    T.members.set(c.id, { id: c.id, name: c.hello.name, ready: false, alive: true, client: c, token });
    T.tokenOf.set(token, c.id);
    byClient.set(c.id, T);
    c.tourneyId = T.id;
    if (T.members.size >= T.size) open.delete(size);
    pub(T);
  }
  function memberOf(c) {
    const T = byClient.get(c.id) || (c.tourneyId && tours.get(c.tourneyId));
    if (!T) return null;
    if (T.members.has(c.id)) return { T, m: T.members.get(c.id) };
    for (const m of T.members.values()) if (m.client === c) return { T, m };
    return null;
  }
  function ready(c) {
    const hit = memberOf(c); if (!hit || hit.T.phase !== 'lobby') return;
    hit.m.ready = true;
    const T = hit.T;
    if (T.members.size === T.size && [...T.members.values()].every(x => x.ready && x.client)) begin(T);
    else pub(T);
  }
  function begin(T) {
    T.phase = 'live';
    open.delete(T.size);
    const list = [...T.members.values()];
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    T.rounds = [list.map(m => ({ id: m.id, name: m.name }))];
    pair(T);
  }
  function pair(T) {
    const round = T.rounds[T.rounds.length - 1];
    if (round.length <= 1) {
      T.phase = 'done'; T.champion = round[0] || null; T.live = []; pub(T); return;
    }
    T.live = [];
    for (let i = 0; i < round.length; i += 2) {
      const A = T.members.get(round[i].id), B = T.members.get(round[i + 1].id);
      const match = { a: { id: A.id, name: A.name }, b: { id: B.id, name: B.name }, winner: null, roomId: null, killsA: 0, killsB: 0 };
      T.live.push(match);
      const humans = [A, B].filter(m => m.client);
      if (humans.length === 2) {
        const room = startMatch(humans.map(m => m.client), T.id);
        if (room) { match.roomId = room.id; room.tourneyMatch = { tourneyId: T.id, key: A.id + ':' + B.id }; }
      } else if (humans.length === 1) match.winner = humans[0].id;
      else match.winner = A.id;
    }
    if (T.live.every(m => m.winner)) advance(T);
    else pub(T);
  }
  function advance(T) {
    const next = [];
    for (const m of T.live) {
      const id = m.winner; const who = T.members.get(id); if (who) next.push({ id: who.id, name: who.name });
    }
    for (const m of T.members.values()) m.alive = next.some(p => p.id === m.id);
    T.rounds.push(next);
    T.live = [];
    pair(T);
  }
  function onRoom(room) {
    const link = room.tourneyMatch; if (!link) return;
    const T = tours.get(link.tourneyId); if (!T) return;
    const match = T.live.find(m => m.a.id + ':' + m.b.id === link.key); if (!match || match.winner) return;
    const res = room.host.world.result || {};
    const tanks = room.host.world.tanks || [];
    let winnerId = null;
    if (res.winnerTeam === 0 || res.winnerTeam === 1) {
      const tank = tanks.find(t => t.team === res.winnerTeam && t.cid);
      winnerId = tank && (tank.cid === match.a.id || tank.cid === match.b.id) ? tank.cid : null;
    }
    if (!winnerId) {
      const ka = tanks.find(t => t.cid === match.a.id), kb = tanks.find(t => t.cid === match.b.id);
      const sa = ka ? ka.kills | 0 : 0, sb = kb ? kb.kills | 0 : 0;
      winnerId = sa === sb ? match.a.id : (sa > sb ? match.a.id : match.b.id);
    }
    match.winner = winnerId;
    if (T.live.every(m => m.winner)) advance(T);
    else pub(T);
  }
  function sample() {
    for (const T of tours.values()) {
      if (T.phase !== 'live') continue;
      let changed = false;
      for (const m of T.live) {
        if (!m.roomId) continue;
        const room = roomById && roomById(m.roomId);
        if (!room) continue;
        const tanks = room.host.world.tanks || [];
        const ka = (tanks.find(t => t.cid === m.a.id) || {}).kills | 0;
        const kb = (tanks.find(t => t.cid === m.b.id) || {}).kills | 0;
        if (ka !== m.killsA || kb !== m.killsB) { m.killsA = ka; m.killsB = kb; changed = true; }
      }
      if (changed) pub(T);
    }
  }
  function drop(c) {
    const hit = memberOf(c); if (!hit) return;
    if (hit.m.client === c) hit.m.client = null;
  }
  function leave(c) {
    const hit = memberOf(c); if (!hit || hit.T.phase !== 'lobby') return;
    const { T, m } = hit;
    T.members.delete(m.id); T.tokenOf.delete(m.token); byClient.delete(c.id); c.tourneyId = null;
    if (!T.members.size) { tours.delete(T.id); open.delete(T.size); }
    else { if (T.members.size < T.size) open.set(T.size, T); pub(T); }
    send(c, { t: 'tour', phase: 'left', id: T.id });
  }
  function rejoin(c, token) {
    const hit = findToken(String(token || '')); if (!hit || !c.hello) return false;
    const { T, id } = hit;
    const m = T.members.get(id);
    m.client = c;
    m.name = c.hello.name;
    byClient.set(c.id, T);
    c.tourneyId = T.id;
    pub(T);
    return true;
  }
  function otherRoom(c) {
    const hit = memberOf(c);
    if (!hit || hit.T.phase !== 'live') return null;
    const mine = hit.T.live.find(x => x.a.id === c.id || x.b.id === c.id);
    const other = hit.T.live.find(x => x !== mine && x.roomId && !x.winner);
    if (!other || !roomById) return null;
    const room = roomById(other.roomId);
    if (!room || !room.host || room.host.ended) return null;
    return room;
  }
  return { join, ready, leave, rejoin, drop, onRoom, sample, otherRoom };
}
