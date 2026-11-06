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
    if (meta._anchorCoins == null) meta._anchorCoins = d.coins | 0;
    if (meta._anchorRp == null) meta._anchorRp = d.rp | 0;
    var offlineCoins = (d.coins | 0) - meta._anchorCoins;
    var offlineRp = (d.rp | 0) - meta._anchorRp;
    d.coins = (msg.coins | 0) + offlineCoins;
    d.rp = Math.max(0, (msg.rp | 0) + offlineRp);
    d.acct = msg.token;
    d.tmod = d.tmod || {};
    if (msg.tmods) { for (var id in msg.tmods) d.tmod[id] = msg.tmods[id]; }
    meta._anchorCoins = d.coins;
    meta._anchorRp = d.rp;
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
    if (!meta || !meta.d) return;
    var d = meta.d;
    var existing = token();
    var body = { token: existing || undefined, name: d.name || 'Игрок' };
    if (!existing) body.local = { coins: d.coins | 0, rp: d.rp | 0, kills: d.stats && d.stats.kills | 0, name: d.name, tmods: d.tmod || {} };
    fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (acc) {
        if (!acc || !acc.token) return;
        if (meta._anchorCoins == null) { meta._anchorCoins = d.coins | 0; meta._anchorRp = d.rp | 0; }
        d.acct = acc.token;
        saveToken(acc.token);
        window.__pbApplyAcct(meta, acc);
      })
      .catch(function () {});
  }
  var tries = 0;
  var timer = setInterval(function () {
    if (window.__pbMeta || ++tries > 40) { clearInterval(timer); if (window.__pbMeta) link(); }
  }, 150);
})();
