// One address for the HTTP account API and the WebSocket. The page origin inside the
// APK is the WebView asset host (localhost) and is not the game server.
(function () {
  var KEY = 'pricopbum_server';
  var PROD_ORIGIN = 'https://pricopbum-server.onrender.com';
  var PROD_WS = 'wss://pricopbum-server.onrender.com/ws';
  var BUILD = '1.2.5';
  window.__pbDurableGet = function (key) {
    try { if (window.pbStore && window.pbStore.get) { var v = window.pbStore.get(key); if (v) return String(v); } } catch (e) {}
    try { if (window.__pbBootStore && window.__pbBootStore[key]) return String(window.__pbBootStore[key]); } catch (e) {}
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  };
  window.__pbDurableSet = function (key, value) {
    try { if (window.pbStore && window.pbStore.set) window.pbStore.set(key, value || ''); } catch (e) {}
    try { window.__pbBootStore = window.__pbBootStore || {}; if (value) window.__pbBootStore[key] = String(value); else delete window.__pbBootStore[key]; } catch (e) {}
    try { if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pbStore) window.webkit.messageHandlers.pbStore.postMessage({ key: key, value: value || '' }); } catch (e) {}
    try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch (e) {}
  };
  function storeGet() { return (window.__pbDurableGet(KEY) || '').trim(); }
  function parse(raw) {
    if (!raw) return null;
    try {
      var u = new URL(raw);
      var secure = u.protocol === 'https:' || u.protocol === 'wss:';
      var origin = (secure ? 'https:' : 'http:') + '//' + u.host;
      var path = u.pathname && u.pathname !== '/' ? u.pathname : '/ws';
      if (!/\/ws$/.test(path)) path = path.replace(/\/$/, '') + '/ws';
      return { origin: origin, ws: (secure ? 'wss:' : 'ws:') + '//' + u.host + path, productionDefault: false };
    } catch (e) { return null; }
  }
  window.__pbBuild = BUILD;
  window.__pbSetServer = function (raw) { window.__pbDurableSet(KEY, raw || ''); };
  window.__pbResolveServer = function () {
    var custom = parse(storeGet());
    if (custom) return custom;
    try {
      var loc = window.location;
      var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
      if (!native && loc && /^https?:$/.test(loc.protocol) && loc.hostname && (/onrender\.com$/.test(loc.hostname) || (/^(localhost|127\.0\.0\.1)$/.test(loc.hostname) && loc.port))) {
        var secure = loc.protocol === 'https:';
        return { origin: loc.protocol + '//' + loc.host, ws: (secure ? 'wss:' : 'ws:') + '//' + loc.host + '/ws', productionDefault: /onrender\.com$/.test(loc.hostname) };
      }
    } catch (e) {}
    return { origin: PROD_ORIGIN, ws: PROD_WS, productionDefault: true };
  };
  window.__pbApi = function (path) { return window.__pbResolveServer().origin + path; };
  window.__pbWsUrl = function () { return window.__pbResolveServer().ws; };
})();
