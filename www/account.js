// Offline until the player connects. The server ledger is a different balance from device coins.
// A device snapshot is never sent as spendable coins. Mythic purchases stay refused.
(function () {
  var TOKEN_KEY = 'pricopbum_account';
  function token() { return window.__pbDurableGet ? window.__pbDurableGet(TOKEN_KEY) : ''; }
  function saveToken(t) { if (window.__pbDurableSet) window.__pbDurableSet(TOKEN_KEY, t || ''); }
  function api(path) { return (window.__pbApi ? window.__pbApi(path) : path); }
  function chip() {
    var el = document.getElementById('pb-build');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pb-build';
    el.textContent = 'PRICOPBUM ' + (window.__pbBuild || '1.2.5') + ' test';
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
      el.style.cssText = 'position:absolute;left:12px;right:12px;top:8px;z-index:40;padding:8px 12px;border-radius:12px;background:rgba(20,12,8,.92);color:#ffe1c2;border:1px solid #e0a15a;font:600 13px/1.35 system-ui,sans-serif;pointer-events:none';
      var host = document.querySelector('.pcb') || document.body;
      host.appendChild(el);
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
    var key = String(model) + ':' + String(track) + ':' + String(Date.now());
    var h = ui.h || ui.app && ui.app.ui && ui.app.ui.h;
    ui.modal([
      h('h3', null, 'Модернизация за монеты'),
      h('p', null, 'Списать ' + cost + ' монет со счёта этого сервера? Мифические улучшения за деньги не выдаются.'),
      ui.confirmBtns(['', 'no', 'Отмена'], ['y', 'ok', 'Списать'])
    ], function (a) {
      if (a !== 'ok') return;
      var spendKey = key;
      fetch(api('/api/account/spend'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token(), model: model, track: track, spendKey: spendKey }) })
        .then(function (r) { return r.json(); })
        .then(function (body) {
          if (!body || !body.ok) { ui.toast(body && body.error === 'coins' ? 'Не хватает монет на счёте' : 'Недоступно', 'coin'); return; }
          window.__pbApplyAcct(ui.m, body.account);
          apply();
        })
        .catch(function () { ui.toast('Счёт недоступен', 'info'); });
    });
  };
  function applyLedger(meta, acc, how) {
    var prev = meta.d.serverCoins | 0;
    var kept = meta.d.coins | 0;
    window.__pbApplyAcct(meta, acc);
    if ((meta.d.coins | 0) !== kept) meta.d.coins = kept;
    try { meta.save(); } catch (e) {}
    var total = acc.coins | 0;
    var delta = total - prev;
    var reward = document.getElementById('pb-server-reward');
    var totalEl = document.getElementById('pb-server-total');
    if (how === 'match' && reward) reward.textContent = String(delta);
    if (totalEl) totalEl.textContent = how === 'match' ? (' · счёт ' + total) : '';
    var wallet = document.getElementById('pb-device-wallet');
    if (wallet) wallet.textContent = ' · устройство ' + kept + ' не зачислено';
    var line = 'Серверный счёт ' + total;
    if (how === 'match') line += ' · этот бой +' + delta;
    line += '. На устройстве ' + kept + '. Монеты устройства не зачислены.';
    banner(line);
    console.log('[pb-acct] ' + how + ' serverCoins=' + total + ' delta=' + delta + ' deviceCoins=' + kept + ' auth=' + !!meta.d.onlineAuth + ' credited=false');
    try {
      var net = window.__pbApp && window.__pbApp.net;
      if (net && net.tr && acc.token) net.tr.send({ t: 'bindAcct', token: acc.token });
    } catch (e) {}
  }
  function link(meta) {
    var body = { token: token() || undefined, name: meta.d.name || 'Игрок' };
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 8000);
    return fetch(api('/api/account'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal })
      .then(function (r) { return r.json().then(function (acc) { return { status: r.status, acc: acc }; }); })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.acc || !res.acc.token || res.acc.coins == null || res.acc.authoritative !== true) {
          meta.d.onlineAuth = false;
          banner('Сервер ответил, но счёт не создан. Монеты устройства не зачислены.');
          console.log('[pb-acct] rejected status=' + res.status);
          return;
        }
        applyLedger(meta, res.acc, 'linked');
      })
      .catch(function (err) {
        clearTimeout(timer);
        meta.d.onlineAuth = false;
        banner('API счёта не ответил. Игра без серверного счёта. Монеты устройства на месте.');
        console.log('[pb-acct] link-failed ' + (err && err.message ? err.message : err) + ' api=' + api('/api/account'));
      });
  }
  function restore(meta, attempt) {
    var saved = token();
    var srv = window.__pbResolveServer ? window.__pbResolveServer() : null;
    meta.d.onlineAuth = false;
    if (!saved || !srv || srv.productionDefault) {
      console.log('[pb-acct] no-restore productionDefault=' + !!(srv && srv.productionDefault));
      return;
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 12000);
    fetch(api('/api/account?token=' + encodeURIComponent(saved)), { signal: ctrl.signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (acc) {
        clearTimeout(timer);
        if (!acc || acc.token !== saved || acc.coins == null || acc.authoritative !== true) {
          meta.d.onlineAuth = false;
          banner('Сохранённый счёт на этом сервере не найден. Монеты устройства не зачислены.');
          console.log('[pb-acct] restore-miss');
          return;
        }
        applyLedger(meta, acc, 'restored');
      })
      .catch(function (err) {
        clearTimeout(timer);
        if ((attempt || 0) < 1) {
          console.log('[pb-acct] restore-retry ' + (err && err.message ? err.message : err));
          setTimeout(function () { restore(meta, (attempt || 0) + 1); }, 600);
          return;
        }
        meta.d.onlineAuth = false;
        banner('Сервер счёта недоступен. Игра офлайн. Монеты устройства на месте.');
        console.log('[pb-acct] restore-failed ' + (err && err.message ? err.message : err));
      });
  }
  window.__pbOnAcct = function (msg) {
    var meta = window.__pbMeta;
    if (!meta || !meta.d || !msg || msg.coins == null || !msg.token) return;
    applyLedger(meta, msg, 'match');
  };
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
    if (!meta || !meta.d) {
      banner('Игра ещё не готова записать счёт.');
      console.log('[pb-acct] no-meta');
      return;
    }
    banner('Проверка серверного счёта…');
    link(meta);
  };
  window.__pbOnOffline = function () {
    window.__pbLegacyServer = false;
    banner('');
    if (window.__pbMeta && window.__pbMeta.d) window.__pbMeta.d.onlineAuth = false;
  };
  function arm() {
    chip();
    var tries = 0;
    var timer = setInterval(function () {
      if (window.__pbMeta && window.__pbMeta.d || ++tries > 40) {
        clearInterval(timer);
        if (window.__pbMeta && window.__pbMeta.d) restore(window.__pbMeta);
      }
    }, 150);
  }
  if (document.body) arm(); else document.addEventListener('DOMContentLoaded', arm);
})();
