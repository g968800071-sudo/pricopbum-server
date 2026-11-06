import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'node:vm';

const js = fs.readFileSync(new URL('../www/game.js', import.meta.url), 'utf8');
const account = fs.readFileSync(new URL('../www/account.js', import.meta.url), 'utf8');
const endpoint = fs.readFileSync(new URL('../www/server-endpoint.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');

function boot(location, stored) {
  const bag = { value: stored || '' };
  const sandbox = {
    URL,
    localStorage: {
      getItem: () => bag.value,
      setItem: (k, v) => { bag.value = v; },
      removeItem: () => { bag.value = ''; },
    },
    location,
    Capacitor: { isNativePlatform: () => true },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(endpoint, sandbox);
  return sandbox;
}

test('the APK resolves API and websocket from one configured server, not the asset host', () => {
  const native = boot({ protocol: 'https:', hostname: 'localhost', host: 'localhost', port: '' });
  assert.equal(native.__pbWsUrl(), 'wss://pricopbum-server.onrender.com/ws');
  assert.equal(native.__pbApi('/api/capabilities'), 'https://pricopbum-server.onrender.com/api/capabilities');
  native.__pbSetServer('http://10.0.2.2:9090');
  assert.equal(native.__pbWsUrl(), 'ws://10.0.2.2:9090/ws');
  assert.equal(native.__pbApi('/api/account'), 'http://10.0.2.2:9090/api/account');
  assert.match(js, /window\.__pbWsUrl\)return window\.__pbWsUrl\(\)/);
  assert.match(html, /server-endpoint\.js/);
  assert.match(js, /tag:"150 ТАНКОВ"/);
  assert.match(js, /150 tanks on a huge map/);
  assert.doesNotMatch(js, /tag:"100 ТАНКОВ"/);
  assert.doesNotMatch(js, /A hundred tanks on a huge map/);
});

test('account linking waits for a compatible welcome and does not copy device coins', () => {
  assert.match(account, /__pbOnWelcome/);
  assert.match(account, /f\.proto === 5/);
  assert.match(account, /f\.accounts === true/);
  assert.match(account, /f\.payments === false/);
  assert.match(account, /d\.serverCoins = msg\.coins \| 0/);
  assert.doesNotMatch(account, /fetch\('\/api\/capabilities'\)/);
  assert.doesNotMatch(account, /d\.coins = \(msg\.coins/);
  assert.match(account, /Этот сервер старее этой сборки/);
  assert.match(account, /1\.2\.2/);
  assert.match(account, /applyLedger\(meta, acc, 'restored'\)/);
  assert.match(js, /Камера другого боя, управление не отправляется/);
  assert.match(js, /Открыть камеру другого боя/);
  assert.match(js, /pb-tour-board/);
  assert.match(js, /acctBound/);
  assert.match(account, /bindAcct/);
});
