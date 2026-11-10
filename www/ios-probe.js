// Runs only when the iOS shell was launched with -pbProbe. It drives the real page:
// menu text, a touch on the stick, a throwaway local server, relaunch restore, and the other-match camera.
// It never sends an account token.
(function () {
  if (!window.__pbProbe) return;
  window.__pbProbeLive = true;
  var nativeRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return window.__pbProbeLive ? nativeRaf(cb) : 0; };
  fetch('http://127.0.0.1:8799/probe', { method: 'POST', body: JSON.stringify({ stage: 'boot', build: window.__pbBuild || '' }) }).catch(function () {});
  var PORT = 8799;
  function post(body) {
    body.build = window.__pbBuild || '';
    body.payments = !!(window.__pbServerFeatures && window.__pbServerFeatures.payments === true);
    return fetch('http://127.0.0.1:' + PORT + '/probe', { method: 'POST', body: JSON.stringify(body) }).catch(function () {});
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var touchN = { start: 0, move: 0, end: 0 };
  var ptrN = { touch: 0, mouse: 0, other: 0 };
  function noteTouch(e, kind) {
    if (!e || !e.isTrusted) return;
    var n = kind === 'move' ? 1 : ((e.touches && e.touches.length) || (e.changedTouches && e.changedTouches.length) || 1);
    touchN[kind] += n;
  }
  window.addEventListener('touchstart', function (e) { noteTouch(e, 'start'); }, true);
  window.addEventListener('touchmove', function (e) { noteTouch(e, 'move'); }, true);
  window.addEventListener('touchend', function (e) { noteTouch(e, 'end'); }, true);
  window.addEventListener('pointerdown', function (e) {
    if (!e || !e.isTrusted) return;
    if (e.pointerType === 'touch') ptrN.touch++;
    else if (e.pointerType === 'mouse') ptrN.mouse++;
    else ptrN.other++;
  }, true);
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
  async function runIap() {
    window.__pbSetServer && window.__pbSetServer('http://127.0.0.1:' + PORT);
    if (window.__pbApp.net) window.__pbApp.net.connect('ws://127.0.0.1:' + PORT + '/ws');
    for (var k = 0; k < 50 && !window.__pbMeta.d.onlineAuth; k++) await sleep(300);
    if (!window.__pbMeta.d.onlineAuth) return post({ stage: 'iap-no-auth', auth: false, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0 });
    var beforeCoins = window.__pbMeta.d.coins | 0, beforeServer = window.__pbMeta.d.serverCoins | 0;
    var cap = window.Capacitor;
    var bridge = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pbIap);
    var loaded = window.__pbApp.IAP && window.__pbApp.IAP.loaded ? Object.keys(window.__pbApp.IAP.loaded).length : -1;
    await post({ stage: 'iap-before', auth: true, coins: beforeCoins, serverCoins: beforeServer, menu: 'plat=' + (cap && cap.getPlatform ? cap.getPlatform() : 'none') + ' bridge=' + bridge + ' n=' + loaded + ' ready=' + !!(window.__pbApp.IAP && window.__pbApp.IAP.ready) });
    await window.__pbApp.IAP.purchase('coins_500');
    var bought = window.__pbApp.IAP.last || {};
    await post({ stage: 'iap-buy', auth: true, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0, status: bought.status || '' });
    await window.__pbApp.IAP.restore();
    var restored = window.__pbApp.IAP.last || {};
    await post({ stage: 'iap-restore', auth: true, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0, status: restored.status || '', replay: !!restored.replay });
    for (var s = 0; s < 80; s++) {
      var step = await fetch('http://127.0.0.1:' + PORT + '/api/iap/test-step').then(function (r) { return r.json(); }).catch(function () { return null; });
      if (step && step.step === 'cancel') break;
      await sleep(250);
    }
    await window.__pbApp.IAP.purchase('coins_500');
    var cancelled = window.__pbApp.IAP.last || {};
    return post({ stage: 'iap-cancel', auth: true, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0, status: cancelled.status || '' });
  }
  async function main() {
    for (var i = 0; i < 50 && !(window.__pbApp && window.__pbMeta); i++) await sleep(200);
    if (!window.__pbApp) return post({ stage: 'no-app' });
    if (window.__pbIapScenario === 'buy') return runIap();
    var saved = '';
    try { saved = (window.__pbDurableGet && window.__pbDurableGet('pricopbum_server')) || ''; } catch (e) {}
    if (!saved && window.__pbBootStore) saved = window.__pbBootStore.pricopbum_server || '';
    if (saved) {
      for (var k = 0; k < 70 && !window.__pbMeta.d.onlineAuth; k++) await sleep(300);
      if (!window.__pbMeta.d.onlineAuth && window.__pbApp.net) window.__pbApp.net.connect(saved);
      for (var k2 = 0; k2 < 40 && !window.__pbMeta.d.onlineAuth; k2++) await sleep(300);
      await post({ stage: 'restored', auth: !!window.__pbMeta.d.onlineAuth, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0 });
      if (!window.__pbMeta.d.onlineAuth) return;
      window.__pbApp.net.connect('ws://127.0.0.1:' + PORT + '/ws');
      for (var n = 0; n < 40 && window.__pbApp.net.status !== 'online'; n++) await sleep(250);
      window.__pbApp.ui.tourJoin(4);
      for (var a = 0; a < 60 && !(window.__pbTour && window.__pbTour.members && window.__pbTour.members.length === 4); a++) await sleep(300);
      if (window.__pbApp.net.tr) window.__pbApp.net.tr.send({ t: 'tourReady' });
      for (var b = 0; b < 80 && !(window.__pbTour && window.__pbTour.phase === 'live'); b++) await sleep(250);
      for (var wtry = 0; wtry < 40; wtry++) {
        var sess0 = window.__pbApp.session;
        if (sess0 && sess0.opts && sess0.opts.watch) break;
        if (window.__pbApp.net.tr && window.__pbTour && window.__pbTour.phase === 'live') window.__pbApp.net.tr.send({ t: 'tourWatch' });
        await sleep(300);
      }
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
    await post({ stage: 'menu', menu: ('safe=' + Math.round(safe.l || 0) + ',' + Math.round(safe.t || 0) + ',' + Math.round(safe.r || 0) + ',' + Math.round(safe.b || 0) + (shopBox ? ' shop=' + Math.round(shopBox.x) + ',' + Math.round(shopBox.y) + ',' + Math.round(shopBox.width) + ',' + Math.round(shopBox.height) : ' shop=missing') + ' ' + (document.body.innerText || '').replace(/\s+/g, ' ')).slice(0, 180), coins: window.__pbMeta.d.coins | 0, tanks: 0, moved: window.innerWidth > window.innerHeight, watch: !!shop, serverCoins: Math.round(safe.l || 0) });
    await sleep(8000);
    var shopOpen = /магазин|shop/i.test(document.body.innerText || '');
    await post({ stage: 'shop', watch: shopOpen, moved: window.innerWidth > window.innerHeight, coins: window.__pbMeta.d.coins | 0, tanks: shopBox ? Math.round(shopBox.width) : 0, serverCoins: Math.round((safe.t || 0) + (safe.b || 0) + (safe.l || 0) + (safe.r || 0)), menu: shopOpen ? 'shop-open' : 'shop-closed' });
    await dismiss();
    window.__pbApp.startLocal('duel', { noPre: 1 });
    var play = false;
    for (var p = 0; p < 50; p++) {
      var st = window.__pbApp.session && window.__pbApp.session.view && window.__pbApp.session.view.state;
      if (st === 'play') { play = true; break; }
      await sleep(200);
    }
    var me0 = window.__pbApp.session && window.__pbApp.session.view && window.__pbApp.session.view.tanks.find(function (t) { return t.cid === 'me' || t.human; });
    var x0 = me0 ? me0.x : 0, y0 = me0 ? me0.y : 0, fire0 = me0 ? me0.lastFire || 0 : 0;
    touchN.start = touchN.move = touchN.end = 0;
    ptrN.touch = ptrN.mouse = ptrN.other = 0;
    var fingers = 0;
    function arm(e) { if (e && e.isTrusted) { fingers++; if (window.__pbApp.setProbeLive) window.__pbApp.setProbeLive(true); } }
    function lift(e) {
      if (!e || !e.isTrusted) return;
      fingers = Math.max(0, fingers - 1);
      if (fingers) return;
      setTimeout(function () { if (!fingers && window.__pbApp.setProbeLive) window.__pbApp.setProbeLive(false); }, 800);
    }
    window.addEventListener('touchstart', arm, true);
    window.addEventListener('touchend', lift, true);
    window.addEventListener('touchcancel', lift, true);
    if (window.__pbApp.setProbeLive) window.__pbApp.setProbeLive(false);
    await post({ stage: 'ready-touch', tanks: window.__pbApp.session && window.__pbApp.session.view ? window.__pbApp.session.view.tanks.length : 0, coins: Math.round(x0), serverCoins: Math.round(y0), menu: play ? 'play' : 'not-play' });
    var best = { dx: 0, dy: 0, shots: 0 }, both = false, overlap = 0, maxFingers = 0, px = x0, py = y0, pf = fire0;
    window.addEventListener('touchmove', function (e) { if (e && e.isTrusted && e.touches) maxFingers = Math.max(maxFingers, e.touches.length); }, true);
    var poll = 0;
    function sample() {
      var me = window.__pbApp.session && window.__pbApp.session.view && window.__pbApp.session.view.tanks.find(function (t) { return t.cid === 'me' || t.human; });
      var inp = window.__pbApp.input;
      var moving = !!(inp && Math.hypot(inp.move.x, inp.move.y) > 0.2);
      var firing = !!(inp && (inp.fireHeld || (inp.aim && inp.aim.active) || inp.autoFire));
      if (moving && firing) both = true;
      if (!me) return;
      best.dx = Math.max(best.dx, Math.abs(me.x - x0));
      best.dy = Math.max(best.dy, Math.abs(me.y - y0));
      var bullets = (window.__pbApp.session.view.bullets || []).length;
      if ((me.lastFire || 0) > fire0 + 0.05 || bullets > 0) best.shots++;
      var step = Math.hypot(me.x - px, me.y - py), firedNow = (me.lastFire || 0) > pf + 0.02;
      if (step > 1.5 && firedNow) overlap++;
      px = me.x; py = me.y; pf = me.lastFire || pf;
    }
    var finishWait = function () {};
    var origArm = arm, origLift = lift;
    arm = function (e) { origArm(e); if (e && e.isTrusted && !poll) poll = setInterval(sample, 100); };
    lift = function (e) {
      origLift(e);
      setTimeout(function () {
        if (fingers) return;
        sample();
        if ((best.dx > 8 || best.dy > 8) && best.shots > 0 && touchN.move > 0) finishWait();
      }, 1000);
    };
    window.removeEventListener('touchstart', origArm, true);
    window.removeEventListener('touchend', origLift, true);
    window.removeEventListener('touchcancel', origLift, true);
    window.addEventListener('touchstart', arm, true);
    window.addEventListener('touchend', lift, true);
    window.addEventListener('touchcancel', lift, true);
    // One timer only. A 200ms poll here keeps the web view awake, so XCTest never delivers the drag.
    await new Promise(function (resolve) {
      var done = false;
      finishWait = function () { if (!done) { done = true; resolve(); } };
      setTimeout(finishWait, 90000);
    });
    if (poll) clearInterval(poll);
    sample();
    if (overlap > 0) both = true;
    window.removeEventListener('touchstart', arm, true);
    window.removeEventListener('touchend', lift, true);
    window.removeEventListener('touchcancel', lift, true);
    if (window.__pbApp.setProbeLive) window.__pbApp.setProbeLive(true);
    await post({ stage: 'touch', moved: best.dx > 8 || best.dy > 8, tanks: window.__pbApp.session && window.__pbApp.session.view ? window.__pbApp.session.view.tanks.length : 0, coins: touchN.start, serverCoins: touchN.move, watch: best.shots > 0, menu: 'end=' + touchN.end + ' dx=' + Math.round(best.dx) + ' dy=' + Math.round(best.dy) + ' both=' + (both ? 1 : 0) + ' ov=' + overlap + ' fingers=' + maxFingers + ' ptr=' + ptrN.touch + '/' + ptrN.mouse + ' play=' + (play ? 1 : 0) + ' shots=' + best.shots + ' wh=' + window.innerWidth + 'x' + window.innerHeight });
    window.__pbApp.quitToMenu();
    await sleep(1000);
    window.__pbApp.net.connect('ws://127.0.0.1:' + PORT + '/ws');
    for (var q = 0; q < 100 && !window.__pbMeta.d.onlineAuth; q++) await sleep(300);
    await post({ stage: 'linked', auth: !!window.__pbMeta.d.onlineAuth, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0 });
  }
  main();
})();
