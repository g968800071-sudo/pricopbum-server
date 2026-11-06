// One address for the HTTP account API and the WebSocket. The page origin inside the
// APK is the WebView asset host (localhost) and is not the game server.
(function () {
  var KEY = 'pricopbum_server';
  var PROD_ORIGIN = 'https://pricopbum-server.onrender.com';
  var PROD_WS = 'wss://pricopbum-server.onrender.com/ws';
  var BUILD = '1.1.0';
  function storeGet() { try { return (localStorage.getItem(KEY) || '').trim(); } catch (e) { return ''; } }
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
  window.__pbSetServer = function (raw) {
    try {
      if (raw) localStorage.setItem(KEY, raw);
      else localStorage.removeItem(KEY);
    } catch (e) {}
  };
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
