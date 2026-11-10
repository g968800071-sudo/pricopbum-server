// The account API is absolute, cross-origin, and still refuses device balances.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ACCOUNT_DB = '/tmp/pb-route-' + process.pid + '.sqlite';
process.env.QUEUE_SECONDS = '0';
const { startServer, stopServer } = await import('../server/server.js');

test('capabilities and account creation answer the configured origin and do not credit device coins', async () => {
  const server = await startServer(0);
  const port = server.address().port;
  const origin = 'http://127.0.0.1:' + port;
  try {
    const opt = await fetch(origin + '/api/account', { method: 'OPTIONS', headers: { origin: 'http://localhost', 'access-control-request-method': 'POST' } });
    assert.equal(opt.status, 204);
    assert.equal(opt.headers.get('access-control-allow-origin'), '*');
    const cap = await (await fetch(origin + '/api/capabilities')).json();
    assert.equal(cap.accounts, true);
    assert.equal(cap.payments, false);
    assert.equal(cap.proto, 5);
    assert.equal(cap.brAdmit, 150);
    assert.equal(cap.trenchPlayers, 30);
    assert.equal(cap.brGoalVerified, false);
    assert.equal(cap.durable, false);
    const acc = await (await fetch(origin + '/api/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ name: 'Route', local: { coins: 9000000, rp: 800000, kills: 4000, tmods: { '1': [5, 5, 5, 5, 5] } } }),
    })).json();
    assert.equal(acc.coins, 0);
    assert.equal(acc.rp, 0);
    assert.equal(acc.kills, 0);
    assert.deepEqual(acc.tmods, {});
    assert.equal(acc.deviceNote.accepted, false);
    assert.equal(acc.authoritative, true);
  } finally {
    await stopServer();
  }
});
