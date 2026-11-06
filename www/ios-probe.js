// Runs only when the iOS shell was launched with -pbProbe. It drives the real page:
// menu text, a touch on the stick, a throwaway local server, relaunch restore, and the other-match camera.
// It never sends an account token.
(function () {
  if (!window.__pbProbe) return;
  var PORT = 8799;
  function post(body) {
    body.build = window.__pbBuild || '';
    body.payments = !!(window.__pbServerFeatures && window.__pbServerFeatures.payments === true);
    return fetch('http://127.0.0.1:' + PORT + '/probe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(function () {});
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pointer(type, x, y) {
    var target = document.querySelector('canvas') || document.body;
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
  }
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
    await post({ stage: 'menu', menu: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 180), coins: window.__pbMeta.d.coins | 0 });
    window.__pbApp.startLocal('duel', { noPre: 1 });
    await sleep(900);
    var cv = document.querySelector('canvas');
    var rect = cv ? cv.getBoundingClientRect() : { left: 30, top: 80, width: 400, height: 280 };
    pointer('pointerdown', rect.left + 70, rect.top + rect.height * 0.72);
    await sleep(80);
    pointer('pointermove', rect.left + 110, rect.top + rect.height * 0.72);
    await sleep(200);
    var input = window.__pbApp.input;
    var touched = !!(input && (Math.abs(input.move.x) + Math.abs(input.move.y) > 0.05 || input.fireHeld));
    pointer('pointerup', rect.left + 110, rect.top + rect.height * 0.72);
    await post({ stage: 'touch', moved: touched, tanks: window.__pbApp.session && window.__pbApp.session.view ? window.__pbApp.session.view.tanks.length : 0 });
    window.__pbApp.quitToMenu();
    await sleep(800);
    window.__pbApp.net.connect('ws://127.0.0.1:' + PORT + '/ws');
    for (var q = 0; q < 40 && !window.__pbMeta.d.onlineAuth; q++) await sleep(300);
    await post({ stage: 'linked', auth: !!window.__pbMeta.d.onlineAuth, coins: window.__pbMeta.d.coins | 0, serverCoins: window.__pbMeta.d.serverCoins | 0 });
  }
  main();
})();
