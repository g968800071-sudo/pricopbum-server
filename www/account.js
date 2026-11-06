// Links this device to the local account server. localStorage is not deleted.
// Online match coins and legendary upgrades are applied from the server ledger.
// Mythic purchases stay refused. Offline coin spends stay on the device and are not wiped.
(function () {
  var TOKEN_KEY = 'pricopbum_account';
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function saveToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  window.__pbApplyAcct = function (meta, msg) {
    if (!meta || !meta.d || !msg || !msg.token) return;
    var d = meta.d;
    // Device coins and rank stay on the device. The server balance is separate and starts at zero.
    d.serverCoins = msg.coins | 0;
    d.serverRp = msg.rp | 0;
    d.acct = msg.token;
    saveToken(msg.token);
    try { meta.save(); } catch (e) {}
    try { if (window.__pbUi && window.__pbUi.refreshCurrency) window.__pbUi.refreshCurrency(); } catch (e) {}
  };
  window.__pbBuyTmod = function (ui, model, track, cost, apply) {
    var h = ui.h || ui.app && ui.app.ui && ui.app.ui.h;
    ui.modal([
      h('h3', null, 'Модернизация за монеты'),
      h('p', null, 'Списать ' + cost + ' монет со счёта? Сервер проверит баланс. Мифические улучшения за деньги не выдаются.'),
      ui.confirmBtns(['', 'no', 'Отмена'], ['y', 'ok', 'Списать'])
    ], function (a) {
      if (a !== 'ok') return;
      fetch('/api/account/spend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token(), model: model, track: track }) })
        .then(function (r) { return r.json(); })
        .then(function (body) {
          if (!body || !body.ok) { ui.toast(body && body.error === 'coins' ? 'Не хватает монет на счёте' : 'Недоступно', 'coin'); return; }
          window.__pbApplyAcct(ui.m, body.account);
          apply();
        })
        .catch(function () { ui.toast('Счёт недоступен', 'info'); });
    });
  };
  function link() {
    var meta = window.__pbMeta;
    var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    console.log('[pb-boot] href=' + location.href + ' origin=' + location.origin + ' native=' + native);
    if (!meta || !meta.d) return;
    fetch('/api/capabilities').then(function (r) { return r.ok ? r.json() : null; }).then(function (cap) {
      console.log('[pb-boot] capabilities ' + (cap && cap.accounts === true ? 'accounts' : 'unavailable'));
      if (!cap || cap.accounts !== true || cap.payments !== false) return;
      var d = meta.d;
      var existing = token();
      var body = { token: existing || undefined, name: d.name || 'Игрок' };
      var kept = d.coins | 0;
      return fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (acc) {
          if (!acc || !acc.token || acc.coins == null) return;
          window.__pbApplyAcct(meta, acc);
          if ((meta.d.coins | 0) !== kept) meta.d.coins = kept;
          try { meta.save(); } catch (e) {}
        });
    }).catch(function () {});
  }
  var tries = 0;
  var timer = setInterval(function () {
    if (window.__pbMeta || ++tries > 40) { clearInterval(timer); if (window.__pbMeta) link(); }
  }, 150);
})();
