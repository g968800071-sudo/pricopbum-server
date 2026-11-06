// Four real sockets play a hosted knockout. No names are invented to fill seats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

process.env.QUEUE_SECONDS = '120';
process.env.ACCOUNT_DB = '/tmp/pb-tour-' + process.pid + '.sqlite';
const { startServer, stopServer } = await import('../server/server.js');

function client(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const msgs = [];
    let snaps = 0;
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === 's') { snaps++; return; }
      msgs.push(m);
    });
    ws.on('error', reject);
    ws.on('open', () => resolve({
      ws, msgs, get snaps() { return snaps; },
      send(o) { ws.send(JSON.stringify(o)); },
      latest(pred) { for (let i = msgs.length - 1; i >= 0; i--) if (pred(msgs[i])) return msgs[i]; return null; },
    }));
  });
}
async function waitFor(c, pred, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = c.latest(pred);
    if (hit) return hit;
    await new Promise(r => setTimeout(r, 40));
  }
  throw new Error('timeout ' + c.msgs.map(m => m.t + (m.phase ? ':' + m.phase : '')).join(','));
}

test('four connected players finish a hosted bracket and a dropped player can rejoin the lobby', async () => {
  const server = await startServer(0);
  const port = server.address().port;
  const cs = [];
  try {
    for (let i = 0; i < 4; i++) cs.push(await client(port));
    cs.forEach((c, i) => c.send({ t: 'hello', v: 5, name: 'P' + i, model: 0 }));
    await Promise.all(cs.map(c => waitFor(c, m => m.t === 'welcome' && m.features && m.features.hostedTournament === true)));
    cs.forEach(c => c.send({ t: 'tourJoin', size: 4 }));
    const lobbies = await Promise.all(cs.map(c => waitFor(c, m => m.t === 'tour' && m.phase === 'lobby' && m.members.length === 4)));
    for (const m of lobbies) {
      assert.equal(m.humansOnly, true);
      assert.equal(m.practice, false);
      assert.equal(m.members.length, 4);
      assert.deepEqual(m.members.map(p => p.name).sort(), ['P0', 'P1', 'P2', 'P3']);
    }
    const token = lobbies[3].token;
    cs[3].ws.close();
    const again = await client(port);
    again.send({ t: 'hello', v: 5, name: 'P3', model: 0 });
    await waitFor(again, m => m.t === 'welcome');
    again.send({ t: 'tourRejoin', token });
    const back = await waitFor(again, m => m.t === 'tour' && m.phase === 'lobby' && m.members.length === 4);
    assert.equal(back.token, token);
    assert.ok(back.members.some(p => p.name === 'P3' && p.id === back.you));
    cs[3] = again;
    cs.forEach(c => c.send({ t: 'tourReady' }));
    await Promise.all(cs.map(c => waitFor(c, m => m.t === 'tour' && (m.phase === 'live' || m.phase === 'done'))));
    const done = await Promise.all(cs.map(c => waitFor(c, m => m.t === 'tour' && m.phase === 'done' && m.champion, 25000)));
    const names = new Set(done[0].rounds[0].map(p => p.name));
    assert.deepEqual([...names].sort(), ['P0', 'P1', 'P2', 'P3']);
    assert.ok(['P0', 'P1', 'P2', 'P3'].includes(done[0].champion.name));
    assert.equal(done.every(m => m.champion.name === done[0].champion.name), true);
    const health = await (await fetch('http://127.0.0.1:' + port + '/health')).json();
    assert.equal(health.features.hostedTournament, true);
    assert.equal(health.features.payments, false);
    console.log(JSON.stringify({ champion: done[0].champion.name, rounds: done[0].rounds.map(r => r.length), snaps: cs.reduce((a, c) => a + c.snaps, 0) }));
  } finally {
    for (const c of cs) try { c.ws.close(); } catch {}
    await stopServer();
  }
});
