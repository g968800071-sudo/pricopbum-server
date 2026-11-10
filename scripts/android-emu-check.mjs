// Runs on the GitHub ubuntu runner after the debug APK is installed on a booted emulator.
// Screenshots are the emulator framebuffer. The stick drags are adb input events.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = process.env.ANDROID_REPORT || 'android-report';
fs.mkdirSync(out, { recursive: true });
const log = [];
const say = (m) => { log.push(m); console.log(m); };
function adb(args, opts = {}) {
  return execFileSync('adb', args, { encoding: opts.binary ? undefined : 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts });
}
function sh(args) { return adb(args); }

function screencap(name) {
  const buf = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 32 * 1024 * 1024 });
  const file = path.join(out, name);
  fs.writeFileSync(file, buf);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  say(`shot ${name} ${w}x${h} bytes=${buf.length}`);
  return { file, w, h };
}
function wmSize() {
  const text = sh(['shell', 'wm', 'size']);
  const over = text.match(/Override size:\s*(\d+)x(\d+)/);
  const phys = text.match(/Physical size:\s*(\d+)x(\d+)/);
  const m = over || phys;
  if (!m) throw new Error('wm size: ' + text);
  return { w: +m[1], h: +m[2], text: text.trim() };
}

async function devtools() {
  for (let i = 0; i < 40; i++) {
    const raw = sh(['shell', 'cat', '/proc/net/unix']).replace(/\0/g, '');
    const names = [...raw.matchAll(/webview_devtools_remote_\d+/g)].map(m => m[0]);
    const uniq = [...new Set(names)];
    for (const name of uniq) {
      try { sh(['forward', '--remove', 'tcp:9222']); } catch (e) {}
      sh(['forward', 'tcp:9222', 'localabstract:' + name]);
      try {
        const list = await (await fetch('http://127.0.0.1:9222/json')).json();
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page;
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('webview devtools socket did not appear');
}

let seq = 0;
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({
      ws,
      cdp(method, params = {}) {
        const id = ++seq;
        return new Promise((res, rej) => {
          pending.set(id, (m) => { pending.delete(id); if (m.error) rej(new Error(method + ' ' + JSON.stringify(m.error))); else res(m.result); });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
    });
    ws.onerror = reject;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) pending.get(m.id)(m);
    };
  });
}
async function ev(cdp, expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 700));
  return r.result.value;
}

const problems = [];
try {
  const apk = process.env.ANDROID_APK;
  if (!apk) throw new Error('ANDROID_APK is not set');
  say(sh(['install', '-r', '-t', apk]).trim());
  sh(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  sh(['shell', 'wm', 'dismiss-keyguard']);
  const size = wmSize();
  say('wm ' + size.text);
  sh(['shell', 'am', 'start', '-n', 'studio.pricop.pricopbum/.MainActivity']);
  const page = await devtools();
  say('page ' + page.url);
  const { cdp } = await connect(page.webSocketDebuggerUrl);
  await cdp('Runtime.enable');
  for (let i = 0; i < 40; i++) {
    if (await ev(cdp, '!!(window.__pbApp && window.__pbApp.ui)')) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!await ev(cdp, '!!window.__pbApp')) throw new Error('game did not boot');
  await ev(cdp, `(() => {
    const d = new Date();
    const today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    let cur = {};
    try { cur = JSON.parse(localStorage.getItem('pricopbum_save') || '{}'); } catch (e) {}
    cur.onboarded = 1;
    cur.settings = Object.assign({}, cur.settings, { lang: 'ru' });
    cur.daily = Object.assign({}, cur.daily, { last: today });
    localStorage.setItem('pricopbum_save', JSON.stringify(cur));
    location.reload();
    return true;
  })()`);
  for (let i = 0; i < 40; i++) {
    if (await ev(cdp, '!!(window.__pbApp && window.__pbApp.ui && window.__pbApp.state)')) break;
    await new Promise(r => setTimeout(r, 500));
  }
  await ev(cdp, `(() => {
    document.querySelectorAll('.studio,.ov').forEach(n => n.remove());
    window.__pbApp.ui.shop();
    return true;
  })()`);
  await new Promise(r => setTimeout(r, 800));
  const shop = await ev(cdp, `(() => {
    const q = (s) => document.querySelector(s);
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height, text: (el.innerText || '').slice(0, 80) }; };
    const title = q('.scr[data-name=shop] h2');
    const close = q('.shop-close-btn');
    const price = [...document.querySelectorAll('.scr[data-name=shop] .card .btn')].find(b => /недоступно/.test(b.innerText || ''));
    const game = q('.pcb-game');
    const gcs = game ? getComputedStyle(game).visibility : 'none';
    return { iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, title: box(title), close: box(close), price: box(price), game: gcs, ovs: document.querySelectorAll('.ov').length };
  })()`);
  say('shop ' + JSON.stringify(shop));
  const shopShot = screencap('shop.png');
  if (!shop.title || !/Магазин/.test(shop.title.text)) problems.push('shop title missing');
  if (!shop.close || !/Закрыть/.test(shop.close.text)) problems.push('shop close missing');
  if (!shop.price || shop.price.b > shop.ih + 1 || shop.price.t < 0) problems.push('coin price not fully on screen');
  if (shop.game === 'visible') problems.push('battle HUD visible over the shop');
  if (shopShot.h < 400) problems.push('shop screenshot is not full height: ' + shopShot.h);

  await ev(cdp, `(() => { document.querySelectorAll('.ov').forEach(n => n.remove()); window.__pbApp.startLocal('duel', { noPre: 1 }); return true; })()`);
  let play = false;
  for (let i = 0; i < 40; i++) {
    play = await ev(cdp, `(() => { const v = window.__pbApp.session && window.__pbApp.session.view; return !!(v && v.state === 'play'); })()`);
    if (play) break;
    await new Promise(r => setTimeout(r, 250));
  }
  if (!play) problems.push('duel did not reach play');
  const before = await ev(cdp, `(() => { const s = window.__pbApp.session; const me = s.view.tanks.find(t => t.human || t.cid === 'me'); return { x: me.x, y: me.y, fire: me.lastFire || 0 }; })()`);
  const size2 = wmSize();
  const x1 = Math.round(size2.w * 0.18), y1 = Math.round(size2.h * 0.72);
  const x2 = Math.round(size2.w * 0.40), y2 = Math.round(size2.h * 0.40);
  const ax1 = Math.round(size2.w * 0.78), ay1 = Math.round(size2.h * 0.72);
  const ax2 = Math.round(size2.w * 0.58), ay2 = Math.round(size2.h * 0.40);
  say(`swipe move ${x1},${y1} -> ${x2},${y2} aim ${ax1},${ay1} -> ${ax2},${ay2}`);
  sh(['shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), '800']);
  await new Promise(r => setTimeout(r, 400));
  sh(['shell', 'input', 'swipe', String(ax1), String(ay1), String(ax2), String(ay2), '800']);
  await new Promise(r => setTimeout(r, 700));
  const after = await ev(cdp, `(() => { const s = window.__pbApp.session; const me = s.view.tanks.find(t => t.human || t.cid === 'me'); const bullets = (s.view.bullets || []).length; return { x: me.x, y: me.y, fire: me.lastFire || 0, bullets, dx: Math.abs(me.x - ${before.x}), dy: Math.abs(me.y - ${before.y}) }; })()`);
  say('touch ' + JSON.stringify({ before, after }));
  screencap('touch.png');
  if (!(after.dx > 8 || after.dy > 8)) problems.push('tank did not move dx=' + after.dx + ' dy=' + after.dy);
  if (!(after.fire > before.fire + 0.05 || after.bullets > 0)) problems.push('no shot after the aim drag');

  await ev(cdp, `(() => { window.__pbApp.quitToMenu(); return true; })()`);
  let menu = false;
  for (let i = 0; i < 20; i++) {
    menu = await ev(cdp, `window.__pbApp && window.__pbApp.state === 'menu'`);
    if (menu) break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (!menu) problems.push('did not return to the menu before the draw');
  await ev(cdp, `(() => {
    document.querySelectorAll('.ov').forEach(n => n.remove());
    const app = window.__pbApp;
    const origShow = app.showResults.bind(app);
    app.showResults = function () {
      const orig = Math.random; let i = 0;
      Math.random = () => { const v = i === 0 ? 0.01 : i === 1 ? 0.9 : orig(); i++; return v; };
      try { return origShow.apply(app, arguments); } finally { Math.random = orig; }
    };
    app.startLocal('team', { noPre: 1 });
    return true;
  })()`);
  for (let i = 0; i < 40; i++) {
    if (await ev(cdp, `window.__pbApp && window.__pbApp.state === 'game' && !!(window.__pbApp.session && window.__pbApp.session.world)`)) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await ev(cdp, `(() => { window.__pbApp.session.world.finish({ winnerTeam: -1 }); return true; })()`);
  let draw = null;
  for (let i = 0; i < 30; i++) {
    draw = await ev(cdp, `(() => {
      const crate = document.querySelector('.ov.res .crate');
      const btn = document.querySelector('.ov.res .btn.g');
      if (!crate || !btn) return null;
      const cr = crate.getBoundingClientRect(), br = btn.getBoundingClientRect();
      const body = document.querySelector('.ov.res .resbody');
      const odds = crate.querySelector('small.note');
      const ob = odds ? odds.getBoundingClientRect() : null;
      const overlap = !(cr.bottom <= br.top + 1 || br.bottom <= cr.top + 1);
      return { text: crate.innerText.slice(0, 160), crate: { t: cr.top, b: cr.bottom, h: cr.height }, btn: { t: br.top, b: br.bottom }, odds: ob && { t: ob.top, b: ob.bottom, text: odds.innerText.slice(0, 90) }, overlap, scroll: body.scrollHeight > body.clientHeight + 4, ih: innerHeight };
    })()`);
    if (draw) break;
    await new Promise(r => setTimeout(r, 250));
  }
  say('draw ' + JSON.stringify(draw));
  const drawShot = screencap('draw.png');
  if (!draw) problems.push('draw dialog did not open');
  else {
    if (!/Легендарный ящик/.test(draw.text)) problems.push('legendary crate title missing');
    if (draw.overlap) problems.push('legendary crate overlaps the ad button');
    if (draw.odds && draw.odds.b > draw.btn.t + 1) problems.push('crate odds sit under the ad button');
  }
  if (drawShot.h < 400) problems.push('draw screenshot is not full height: ' + drawShot.h);
  if (shopShot.w !== drawShot.w || shopShot.h !== drawShot.h) problems.push('screenshot sizes differ');
} catch (err) {
  problems.push(String(err && err.stack || err).slice(0, 800));
}
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ problems, log }, null, 2));
try { fs.writeFileSync(path.join(out, 'logcat.txt'), sh(['logcat', '-d', '-t', '200'])); } catch (e) {}
if (problems.length) {
  say('PROBLEMS\n' + problems.join('\n'));
  process.exit(1);
}
say('ANDROID EMU OK');
