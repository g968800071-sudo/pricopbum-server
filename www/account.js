// Offline until the player connects. The server ledger is a different balance from device coins.
// A device snapshot is never sent as spendable coins. Mythic purchases stay refused.
(function () {
  var TOKEN_KEY = 'pricopbum_account';
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function saveToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  function api(path) { return (window.__pbApi ? window.__pbApi(path) : path); }
  function chip() {
    var el = document.getElementById('pb-build');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pb-build';
    el.textContent = 'PRICOPBUM ' + (window.__pbBuild || '1.2.0') + ' test';
    el.style.cssText = 'position:fixed;left:8px;bottom:6px;z-index:40;font:600 11px system-ui,sans-serif;color:#ffd23d;pointer-events:none;text-shadow:0 1px 2px #000';
    document.body.appendChild(el);
    return el;
  }
  function banner(text) {
    var el = document.getElementById('pb-compat');
    if (!text) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'pb-compat';
      el.style.cssText = 'position:fixed;left:12px;right:12px;top:8px;z-index:45;padding:8px 12px;border-radius:12px;background:rgba(20,12,8,.92);color:#ffe1c2;border:1px solid #e0a15a;font:600 13px/1.35 system-ui,sans-serif;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = text;
  }
  function compatible(f) {
    return !!(f && f.proto === 5 && f.accounts === true && f.payments === false);
  }
  window.__pbApplyAcct = function (meta, msg) {
    if (!meta || !meta.d || !msg || !msg.token) return;
    var d = meta.d;
    d.serverCoins = msg.coins | 0;
    d.serverRp = msg.rp | 0;
    d.acct = msg.token;
    d.onlineAuth = true;
    saveToken(msg.token);
    try { meta.save(); } catch (e) {}
    try { if (window.__pbUi && window.__pbUi.refreshCurrency) window.__pbUi.refreshCurrency(); } catch (e) {}
  };
  window.__pbBuyTmod = function (ui, model, track, cost, apply) {
    var h = ui.h || ui.app && ui.app.ui && ui.app.ui.h;
    ui.modal([
      h('h3', null, 'Модернизация за монеты'),
      h('p', null, 'Списать ' + cost + ' монет со счёта этого сервера? Мифические улучшения за деньги не выдаются.'),
      ui.confirmBtns(['', 'no', 'Отмена'], ['y', 'ok', 'Списать'])
    ], function (a) {
      if (a !== 'ok') return;
      fetch(api('/api/account/spend'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token(), model: model, track: track }) })
        .then(function (r) { return r.json(); })
        .then(function (body) {
          if (!body || !body.ok) { ui.toast(body && body.error === 'coins' ? 'Не хватает монет на счёте' : 'Недоступно', 'coin'); return; }
          window.__pbApplyAcct(ui.m, body.account);
          apply();
        })
        .catch(function () { ui.toast('Счёт недоступен', 'info'); });
    });
  };
  function link(meta) {
    var d = meta.d;
    var kept = d.coins | 0;
    var body = { token: token() || undefined, name: d.name || 'Игрок' };
    return fetch(api('/api/account'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (acc) {
        if (!acc || !acc.token || acc.coins == null) return;
        window.__pbApplyAcct(meta, acc);
        if ((meta.d.coins | 0) !== kept) meta.d.coins = kept;
        try { meta.save(); } catch (e) {}
        console.log('[pb-acct] linked coins=' + acc.coins + ' credited=false');
      });
  }
  window.__pbOnWelcome = function (msg) {
    var meta = window.__pbMeta;
    var f = msg && msg.features;
    window.__pbServerFeatures = f || null;
    window.__pbLegacyServer = !compatible(f);
    var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    console.log('[pb-boot] href=' + location.href + ' api=' + api('/api/capabilities') + ' ws=' + (window.__pbWsUrl ? window.__pbWsUrl() : '') + ' native=' + native + ' legacy=' + window.__pbLegacyServer);
    if (!compatible(f)) {
      if (meta && meta.d) meta.d.onlineAuth = false;
      banner('Этот сервер старее этой сборки. Новые счета, комнаты на 30 игроков и королевская битва на 150 здесь недоступны. Монеты устройства не уходят на сервер.');
      return;
    }
    banner('Счёт этого сервера. Траншеи ' + f.trenchPlayers + ', королевская битва допускает ' + f.brAdmit + '. Монеты устройства не зачислены.');
    if (meta && meta.d) link(meta).catch(function () { banner('Сервер объявил счета, но API счёта не ответил. Игра остаётся без серверного счёта.'); });
  };
  window.__pbOnOffline = function () {
    window.__pbLegacyServer = false;
    banner('');
    if (window.__pbMeta && window.__pbMeta.d) window.__pbMeta.d.onlineAuth = false;
  };
  function arm() {
    chip();
    if (window.__pbMeta) window.__pbMeta.d.onlineAuth = false;
  }
  if (document.body) arm(); else document.addEventListener('DOMContentLoaded', arm);
})();
