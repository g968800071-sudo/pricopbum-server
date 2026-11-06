import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const js = fs.readFileSync(new URL('../www/game.js', import.meta.url), 'utf8');
const account = fs.readFileSync(new URL('../www/account.js', import.meta.url), 'utf8');

test('the bundled client defaults online play to the existing production host', () => {
  assert.match(js, /wss:\/\/pricopbum-server\.onrender\.com\/ws/);
  assert.match(js, /isNativePlatform\(\);if\(n\)return eo/);
  assert.doesNotMatch(js, /wss:\/\/pricopbum-server\.onrender\.com\/ws\/branch/);
});

test('account linking requires a server that advertises accounts and does not copy device coins', () => {
  assert.match(account, /\/api\/capabilities/);
  assert.match(account, /cap\.accounts !== true/);
  assert.match(account, /d\.serverCoins = msg\.coins \| 0/);
  assert.doesNotMatch(account, /d\.coins = \(msg\.coins/);
});
