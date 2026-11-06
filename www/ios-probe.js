// Runs only when the iOS shell was launched with -pbProbe. It drives the real page:
// menu text, a touch on the stick, a throwaway local server, relaunch restore, and the other-match camera.
// It never sends an account token.
(function () {
  if (!window.__pbProbe) return;
  fetch('http://127.0.0.1:8799/probe', { method: 'POST', body: JSON.stringify({ stage: 'boot', build: window.__pbBuild || '' }) }).catch(function () {});
  var PORT = 8799;
  function post(body) {
    body.build = window.__pbBuild || '';
    body.payments = !!(window.__pbServerFeatures && window.__pbServerFeatures.payments === true);
    return fetch('http://127.0.0.1:' + PORT + '/probe', { method: 'POST', body: JSON.stringify(body) }).catch(function () {});
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var touchN = { start: 0, move: 0, end: 0 };
  function noteTouch(e, kind) { if (e && e.isTrusted) touchN[kind]++; }
  window.addEventListener('touchstart', function (e) { noteTouch(e, 'start'); }, true);
  window.addEventListener('touchmove', function (e) { noteTouch(e, 'move'); }, true);
  window.addEventListener('touchend', function (e) { noteTouch(e, 'end'); }, true);
  async function dismiss() {
    for (var i = 0; i < 6; i++) {
      var b = document.querySelector('[data-m=skip],[data-m=done]');
      if (b) b.click();
      var overs = document.querySelectorAll('.ov');
      for (var j = 0; j < overs.length; j++) overs[j].remove();
      await sleep(150);
    }
    if (window.__pbMeta && window.__pbMeta.d) { window.__pbMeta.d.onboarded = 1; try { window.__pbMeta.save(); } catch (e) {} }
  }
  async function main() {
    for (var i = 0; i < 50 && !(window.__pbApp && window.__pbMeta); i++) await sleep(200);
    if (!window.__pbApp) return post({ stage: 'no-app' });
    var saved = window.__pbBootStore && window.__pbBootStore.pricopbum_server;
    if (saved) {
      for (var k = 0; k < 40 && !window.__pbMeta.d.onlineAuth; k++) await sleep(300);
      await post({ stage: 'restored', auth: !!window.__pbMeta.d.onlineAuth, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0 });
      if (!window.__pbMeta.d.onlineAuth) return;
      window.__pbApp.net.connect('ws://127.0.0.1:' + PORT + '/ws');
      for (var n = 0; n < 40 && window.__pbApp.net.status !== 'online'; n++) await sleep(250);
      window.__pbApp.ui.tourJoin(4);
      for (var a = 0; a < 60 && !(window.__pbTour && window.__pbTour.members && window.__pbTour.members.length === 4); a++) await sleep(300);
      if (window.__pbApp.net.tr) window.__pbApp.net.tr.send({ t: 'tourReady' });
      for (var b = 0; b < 40 && !(window.__pbTour && (window.__pbTour.phase === 'live' || window.__pbTour.phase === 'done')); b++) await sleep(250);
      if (window.__pbApp.net.tr) window.__pbApp.net.tr.send({ t: 'tourWatch' });
      var x0 = null, moved = false, tanks = 0, watch = false;
      for (var c = 0; c < 40; c++) {
        var sess = window.__pbApp.session;
        watch = !!(sess && sess.opts && sess.opts.watch);
        tanks = sess && sess.view && sess.view.tanks ? sess.view.tanks.length : 0;
        if (watch && tanks >= 2) {
          if (x0 == null) x0 = sess.view.tanks[0].x;
          else if (sess.view.tanks[0].x !== x0) { moved = true; break; }
        }
        await sleep(200);
      }
      return post({ stage: 'watch', watch: watch, tanks: tanks, moved: moved, auth: !!window.__pbMeta.d.onlineAuth, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0 });
    }
    await dismiss();
    var shop = document.querySelector('[data-a=shop]');
    var shopBox = shop ? shop.getBoundingClientRect() : null;
    var safe = window.__pbApp.safeInsets ? window.__pbApp.safeInsets() : { l: 0, t: 0, r: 0, b: 0 };
    await post({ stage: 'menu', menu: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 180), coins: window.__pbMeta.d.coins | 0, tanks: 0, moved: window.innerWidth > window.innerHeight, watch: !!shop, serverCoins: Math.round(safe.l || 0) });
    await sleep(8000);
    var shopOpen = /магазин|shop/i.test(document.body.innerText || '');
    await post({ stage: 'shop', watch: shopOpen, moved: window.innerWidth > window.innerHeight, coins: window.__pbMeta.d.coins | 0, tanks: shopBox ? Math.round(shopBox.width) : 0, serverCoins: Math.round((safe.t || 0) + (safe.b || 0) + (safe.l || 0) + (safe.r || 0)) });
    await dismiss();
    window.__pbApp.startLocal('duel', { noPre: 1 });
    await sleep(1200);
    var me0 = window.__pbApp.session && window.__pbApp.session.view && window.__pbApp.session.view.tanks.find(function (t) { return t.cid === 'me' || t.human; });
    var x0 = me0 ? me0.x : 0, y0 = me0 ? me0.y : 0, fire0 = me0 ? me0.lastFire || 0 : 0;
    await post({ stage: 'ready-touch', tanks: window.__pbApp.session && window.__pbApp.session.view ? window.__pbApp.session.view.tanks.length : 0, coins: Math.round(x0), serverCoins: Math.round(y0) });
    var best = { dx: 0, dy: 0, shots: 0 };
    for (var w = 0; w < 40; w++) {
      var me = window.__pbApp.session && window.__pbApp.session.view && window.__pbApp.session.view.tanks.find(function (t) { return t.cid === 'me' || t.human; });
      if (me) {
        best.dx = Math.max(best.dx, Math.abs(me.x - x0));
        best.dy = Math.max(best.dy, Math.abs(me.y - y0));
        var bullets = (window.__pbApp.session.view.bullets || []).length;
        if ((me.lastFire || 0) > fire0 + 0.05 || bullets > 0) best.shots++;
      }
      await sleep(400);
    }
    await post({ stage: 'touch', moved: best.dx > 8 || best.dy > 8, tanks: window.__pbApp.session && window.__pbApp.session.view ? window.__pbApp.session.view.tanks.length : 0, coins: touchN.start, serverCoins: touchN.move, watch: best.shots > 0, menu: 'end=' + touchN.end + ' dx=' + Math.round(best.dx) + ' dy=' + Math.round(best.dy) });
    window.__pbApp.quitToMenu();
    await sleep(800);
    window.__pbApp.net.connect('ws://127.0.0.1:' + PORT + '/ws');
    for (var q = 0; q < 40 && !window.__pbMeta.d.onlineAuth; q++) await sleep(300);
    await post({ stage: 'linked', auth: !!window.__pbMeta.d.onlineAuth, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0 });
  }
  main();
})();
