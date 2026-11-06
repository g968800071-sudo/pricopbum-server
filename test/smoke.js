// Local smoke: boot the authoritative server, check the playable page, and run one scripted duel.
// Usage: node test/smoke.js
import { WebSocket } from 'ws';
process.env.QUEUE_SECONDS = process.env.QUEUE_SECONDS || '0';
const { startServer, stopServer } = await import('../server/server.js');

const server = await startServer(0);
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;
const health = await fetch(base + '/healthz');
if ((await health.text()) !== 'PRICOPBUM server OK') throw new Error('healthz');
const page = await fetch(base + '/');
const html = await page.text();
if (!html.includes('PRICOPBUM') || !html.includes('game.js')) throw new Error('index');
const js = await (await fetch(base + '/game.js')).text();
if (js.includes('Купить (демо)') || !js.includes('Оплата реальными деньгами не подключена')) throw new Error('checkout still grants items');
const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
const msgs = [];
ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
ws.send(JSON.stringify({ t: 'hello', v: 5, name: 'Smoke' }));
const t0 = Date.now();
while (!msgs.some(m => m.t === 'welcome')) { if (Date.now() - t0 > 3000) throw new Error('no welcome'); await new Promise(r => setTimeout(r, 20)); }
ws.send(JSON.stringify({ t: 'qm', mode: 'duel', name: 'Smoke' }));
while (!msgs.some(m => m.t === 'start')) { if (Date.now() - t0 > 5000) throw new Error('no start ' + msgs.map(m => m.t).join(',')); await new Promise(r => setTimeout(r, 30)); }
ws.close();
await stopServer();
console.log('smoke ok  http://127.0.0.1:' + port + '  duel started with bots filling the empty seat');
