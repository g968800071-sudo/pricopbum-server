// Battle royale goal is 150. This file records why that room is not started here.
// A previous run set MAX_TANKS=150 and opened 150 websocket clients. Matchmaking
// still filled the room at CAP.br (100). The process was then killed:
// V8 "Ineffective mark-compacts near heap limit", heap about 2039 MB, ~76 s, SIGABRT.
// No step time was recorded. Those were sockets on this machine, not 150 people,
// and not the production host. brGoalVerified stays false.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

process.env.QUEUE_SECONDS = '120';
process.env.ACCOUNT_DB = '/tmp/pb-brcap-' + process.pid + '.sqlite';
const { startServer, stopServer, roomOpts, serverFeatures, admitCount } = await import('../server/server.js');

test('battle royale admits MAX_TANKS humans and does not claim the 150-player goal', () => {
  const features = serverFeatures();
  assert.equal(features.brGoal, 150);
  assert.equal(features.brGoalVerified, false);
  assert.equal(features.hostedTournament, false);
  assert.equal(features.durable, false);
  assert.equal(features.brCap, 24);
  assert.equal(features.brQueueCap, 100);
  assert.equal(features.brAdmit, 24);
  assert.equal(admitCount('br'), 24);
  assert.equal(admitCount('trench'), 30);
  assert.equal(roomOpts('br', 150, {}).opts.total, 24);
  assert.equal(roomOpts('br', 100, {}).opts.total, 24);
});

test('26 simulated clients open one 24-human battle royale and leave the extras queued', async () => {
  const server = await startServer(0);
  const port = server.address().port;
  const open = () => new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const msgs = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    ws.on('error', reject);
    ws.on('open', () => resolve({ ws, msgs }));
  });
  const waitFor = async (bag, pred, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = bag.msgs.find(pred);
      if (hit) return hit;
      await new Promise(r => setTimeout(r, 20));
    }
    return null;
  };
  const N = 26;
  let clients = [];
  try {
    clients = await Promise.all(Array.from({ length: N }, () => open()));
    clients.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'hello', v: 5, name: 'B' + i, model: 0 })));
    const welcome = await waitFor(clients[0], m => m.t === 'welcome');
    assert.equal(welcome.features.brAdmit, 24);
    assert.equal(welcome.features.brGoalVerified, false);
    clients.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'qm', mode: 'br', name: 'B' + i })));
    const started = await Promise.all(clients.map(c => waitFor(c, m => m.t === 'start', 30000)));
    const inRoom = started.filter(Boolean).length;
    assert.equal(inRoom, 24);
    await new Promise(r => setTimeout(r, 400));
    const health = await (await fetch('http://127.0.0.1:' + port + '/health')).json();
    const room = health.list.find(r => r.variant === 'br');
    assert.ok(room);
    assert.equal(room.humans, 24);
    assert.equal(room.tanks, 24);
    assert.equal(health.features.brGoalVerified, false);
    console.log(JSON.stringify({ humans: room.humans, tanks: room.tanks, stepMs: health.stepMs, stepMaxMs: health.stepMaxMs, brAdmit: health.features.brAdmit }));
  } finally {
    for (const c of clients) try { c.ws.close(); } catch {}
    await stopServer();
  }
});
