// 30 simulated clients in Trenches (15×15). This is not a 150-player battle royale test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

process.env.QUEUE_SECONDS = '120';
process.env.ACCOUNT_DB = '/tmp/pb-trench-' + process.pid + '.sqlite';
const { startServer, stopServer } = await import('../server/server.js');

const N = 30;

test('thirty simulated clients play Trenches 15×15 and the step time is measured', async () => {
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
    throw new Error('timeout ' + bag.msgs.map(m => m.t).slice(-6).join(','));
  };
  const t0 = Date.now();
  let clients = [];
  try {
    clients = await Promise.all(Array.from({ length: N }, () => open()));
    clients.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'hello', v: 5, name: 'T' + i, model: i % 5 === 0 ? 11 : 0 })));
    await Promise.all(clients.map(c => waitFor(c, m => m.t === 'welcome')));
    clients.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'qm', mode: 'trench', name: 'T' + i, model: 0 })));
    await Promise.all(clients.map(c => waitFor(c, m => m.t === 'start', 25000)));
    const started = Date.now() - t0;
    await Promise.all(clients.map(c => waitFor(c, m => m.t === 's' && m.T, 15000)));
    const samples = [];
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 300));
      const health = await (await fetch('http://127.0.0.1:' + port + '/health')).json();
      samples.push(health);
    }
    const last = samples[samples.length - 1];
    const room = last.list.find(r => r.variant === 'trench');
    console.log(JSON.stringify({ startedMs: started, tanks: room && room.tanks, humans: room && room.humans, alive: room && room.alive, stepMs: samples.map(s => s.stepMs), stepMaxMs: samples.map(s => s.stepMaxMs) }));
    assert.ok(room, 'trench room missing');
    assert.equal(room.tanks, 30);
    assert.equal(room.humans, 30);
    assert.ok(room.alive >= 20);
    const warm = samples.slice(2).map(s => s.stepMs);
    const avg = warm.reduce((a, b) => a + b, 0) / warm.length;
    assert.ok(avg < 50, 'measured step ' + avg.toFixed(2) + 'ms is too slow for 30 tanks on this machine');
  } finally {
    for (const c of clients) try { c.ws.close(); } catch {}
    await stopServer();
  }
});
