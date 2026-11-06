// Battle royale admits 150 humans. The earlier out-of-memory run kept every snapshot
// inside the same process as the server. This file runs the server in its own process
// and drops snapshots. The clients are sockets on this machine, not people.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { roomOpts, admitCount, serverFeatures } from '../server/server.js';

test('battle royale room options admit 150 and do not treat that as a human trial', () => {
  const features = serverFeatures();
  assert.equal(admitCount('br'), 150);
  assert.equal(admitCount('trench'), 30);
  assert.equal(roomOpts('br', 150, {}).opts.total, 150);
  assert.equal(roomOpts('br', 1, {}).opts.total, 150);
  assert.equal(features.brAdmit, 150);
  assert.equal(features.brGoal, 150);
  assert.equal(features.brGoalVerified, false);
  assert.equal(features.hostedTournament, false);
  assert.equal(features.payments, false);
  assert.equal(features.accounts, true);
});

test('150 simulated clients hold one battle royale without retaining snapshots', async () => {
  const db = '/tmp/pb-brstress-' + process.pid + '.sqlite';
  const child = spawn(process.execPath, ['test/br-stress-server.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, QUEUE_SECONDS: '120', ACCOUNT_DB: db },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { out += d.toString(); });
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not print a port\n' + out)), 20000);
    const watch = () => {
      const m = out.match(/PORT (\d+)/);
      if (m) { clearTimeout(t); resolve(+m[1]); }
    };
    child.stdout.on('data', watch);
    child.on('exit', (code) => { clearTimeout(t); reject(new Error('server exited ' + code + '\n' + out)); });
  });
  const N = 150;
  const clients = [];
  const open = () => new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    let started = false;
    let snaps = 0;
    ws.on('message', (d) => {
      const t = d.toString().slice(0, 12);
      if (t.includes('"start"')) started = true;
      else snaps++;
    });
    ws.on('error', reject);
    ws.on('open', () => resolve({ ws, get started() { return started; }, get snaps() { return snaps; } }));
  });
  try {
    for (let i = 0; i < N; i += 25) {
      const batch = await Promise.all(Array.from({ length: Math.min(25, N - i) }, () => open()));
      clients.push(...batch);
    }
    clients.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'hello', v: 5, name: 'B' + i, model: 0 })));
    await new Promise(r => setTimeout(r, 300));
    clients.forEach((c, i) => c.ws.send(JSON.stringify({ t: 'qm', mode: 'br', name: 'B' + i })));
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      if (clients.filter(c => c.started).length === N) break;
      await new Promise(r => setTimeout(r, 50));
    }
    const started = clients.filter(c => c.started).length;
    await new Promise(r => setTimeout(r, 1200));
    const health = await (await fetch('http://127.0.0.1:' + port + '/health')).json();
    const room = health.list.find(r => r.variant === 'br');
    const mem = [...out.matchAll(/MEM (\d+) (\d+)/g)].at(-1);
    const rssMb = mem ? Math.round(+mem[1] / 1048576) : health.rssMb;
    const heapMb = mem ? Math.round(+mem[2] / 1048576) : health.heapMb;
    const report = { started, humans: room && room.humans, tanks: room && room.tanks, stepMs: health.stepMs, stepMaxMs: health.stepMaxMs, rssMb, heapMb, snaps: clients.reduce((a, c) => a + c.snaps, 0) };
    console.log(JSON.stringify(report));
    assert.equal(started, 150);
    assert.equal(room.humans, 150);
    assert.equal(room.tanks, 150);
    assert.ok(rssMb < 1800, 'server RSS ' + rssMb + ' MB');
    assert.equal(health.features.brGoalVerified, false);
    assert.equal(health.features.payments, false);
  } finally {
    for (const c of clients) try { c.ws.close(); } catch {}
    child.kill('SIGTERM');
    await new Promise(r => child.once('exit', r));
  }
});
