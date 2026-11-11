import { GEAR, MYTH_GEAR, ROCKETS, fxText } from '../sim/loot.js';
import { PRICE_TIERS, tierOf } from './catalog.js';
import { APPLE_PRODUCTS } from '../iap/products.js';
// window.Ads / window.IAP — demo implementations on the web, native adapters when running inside Capacitor.
// Native: @capacitor-community/admob (AdMob) and cordova-plugin-purchase (Google Play Billing). IDs below are Google's public TEST ids.
export const AD_CONFIG = {
  // Replace with your real AdMob unit ids before release (these are Google's official test units).
  android: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
  testing: true, // set false for release builds
  interstitialEveryMatches: 3, interstitialMinSeconds: 180, interstitialGraceMatches: 2, rewardedPerDay: 10,
};
// Release flag: true = real Google Play Billing (cordova-plugin-purchase) in the Android app. Products must exist in Play Console with the same ids (see store/iap_products.csv).
// If billing is off or the store fails to load, native builds NEVER grant items for free — the purchase is refused with a message.
export const BILLING_ENABLED = false;
export const PRODUCTS = [
  { id: 'coins_500', title: '500 монет', coins: 500, price: '0,99 недоступно', icon: 'coin' },
  { id: 'coins_1400', title: '1 400 монет', coins: 1400, price: '2,49 недоступно', icon: 'coin' },
  { id: 'coins_3000', title: '3 000 монет', desc: '≈15 боёв с лучшим снаряжением', coins: 3000, price: '4,99 недоступно', icon: 'coin', badge: 'Популярно' },
  { id: 'coins_6500', title: '6 500 монет', coins: 6500, price: '9,99 недоступно', icon: 'coin' },
  { id: 'coins_14000', title: '14 000 монет', coins: 14000, price: '19,99 недоступно', icon: 'coin', badge: 'Выгодно' },
  { id: 'coins_38000', title: '38 000 монет', coins: 38000, price: '49,99 недоступно', icon: 'coin', badge: 'Лучшая цена' },
  // r20: MYTHIC items — the only PERMANENT equipment («навсегда»), real money only, non-consumable; stats stay capped (turret dmg ≤ +25%, MG within the same balance caps)
  { id: 'myth_mgt_48', title: 'Мифический пулемёт навсегда', desc: 'навсегда', myth: 'mgt:48', price: '19,99 недоступно', once: true, icon: 'crown' },
  { id: 'myth_mgt_49', title: 'Мифический пулемёт навсегда', desc: 'навсегда', myth: 'mgt:49', price: '19,99 недоступно', once: true, icon: 'crown' },
  { id: 'myth_tur_48', title: 'Мифическая башня навсегда', desc: 'навсегда', myth: 'tur:48', price: '24,99 недоступно', once: true, icon: 'crown' },
  { id: 'myth_tur_49', title: 'Мифическая башня навсегда', desc: 'навсегда', myth: 'tur:49', price: '24,99 недоступно', once: true, icon: 'crown' },
  // r25: every changeable part has mythic versions (permanent, real money only, +20% over best legendary, own look)
  ...MYTH_GEAR.map((gi, k) => ({ id: 'myth_gear_' + gi, title: 'Мифическая деталь: ' + GEAR[gi].name, desc: 'навсегда · ' + fxText(GEAR[gi].fx), myth: 'gear:' + gi, price: ['19,99 недоступно', '24,99 недоступно', '29,99 недоступно'][k % 3], once: true, icon: 'crown' })),
  ...ROCKETS.map((R, i) => R.myth ? { id: 'myth_rocket_' + i, title: 'Мифические ракеты навсегда: ' + R.name, desc: 'навсегда', myth: 'rocket:' + i, price: '19,99 недоступно', once: true, icon: 'crown' } : null).filter(Boolean),
  { id: 'myth_perk_0', title: 'Мифический перк «Рой»', desc: 'навсегда · каждый бой: 2 легендарных дрона', myth: 'mperk:0', price: '24,99 недоступно', once: true, icon: 'crown' },
  { id: 'myth_perk_1', title: 'Мифический перк «Гром»', desc: 'навсегда · каждый бой: спаренные ракеты', myth: 'mperk:1', price: '24,99 недоступно', once: true, icon: 'crown' },
  { id: 'myth_perk_2', title: 'Мифический перк «Медик»', desc: 'навсегда · каждый бой: +3 аптечки и +2 дыма', myth: 'mperk:2', price: '19,99 недоступно', once: true, icon: 'crown' },
  { id: 'season_pass', title: 'Премиум-пропуск сезона', desc: 'Премиум-дорожка: 35 модификаций · 1 мифическая навсегда, 34 легендарных и обычных на 3–5 боёв', price: '7,00 недоступно', once: true, icon: 'crown' },
  { id: 'gems_small', title: '80 кристаллов', gems: 80, price: '0,99 недоступно', icon: 'gem1' },
  { id: 'gems_medium', title: '450 кристаллов', gems: 450, price: '4,99 недоступно', icon: 'gem2', badge: 'Выгодно' },
  { id: 'gems_large', title: '1200 кристаллов', gems: 1200, price: '9,99 недоступно', icon: 'gem3', badge: 'Лучшая цена' },
  { id: 'starter_pack', title: 'Набор новичка', desc: '50 кристаллов + 500 монет + раскраска «Неон»', gems: 50, coins: 500, skin: 'neon', price: '1,99 недоступно', once: true, icon: 'starter' },
  { id: 'remove_ads', title: 'Убрать рекламу', desc: 'Навсегда отключает межстраничную рекламу. Награды за просмотр остаются по желанию.', removeAds: true, price: '2,49 недоступно', once: true, icon: 'noads' },
  { id: 'skin_gold', title: 'Раскраска «Золото»', desc: 'Только внешний вид, без преимуществ в бою', skin: 'gold', price: '1,24 недоступно', once: true, icon: 'gold' },
];

function isNative() { return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform(); }
function pbIapBridge() {
  const handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pbIap;
  if (!handler) return null;
  window.__pbIapWait = window.__pbIapWait || {};
  window.__pbIapSeq = window.__pbIapSeq || 0;
  window.__pbIapResult = window.__pbIapResult || function (id, body) { const fn = window.__pbIapWait[id]; if (fn) { delete window.__pbIapWait[id]; fn(body || {}); } };
  const call = (op, extra) => new Promise((resolve) => {
    const id = 'iap' + (++window.__pbIapSeq);
    window.__pbIapWait[id] = resolve;
    try { handler.postMessage(Object.assign({ id, op }, extra || {})); } catch (e) { resolve({ status: 'error' }); }
  });
  return { load: (o) => call('load', o), purchase: (o) => call('purchase', o), restore: () => call('restore'), finish: (o) => call('finish', o), dialogs: (o) => call('dialogs', o) };
}
function storeKit() {
  const bridge = typeof window !== 'undefined' ? pbIapBridge() : null;
  if (bridge) return bridge;
  const cap = typeof window !== 'undefined' && window.Capacitor;
  if (!cap || !cap.getPlatform || cap.getPlatform() !== 'ios') return null;
  return cap.Plugins && cap.Plugins.StoreKit || null;
}

export function installMonetization(ui, meta) {
  const native = isNative();
  const demoOverlay = (kind, seconds = 3) => new Promise((res) => ui.demoAd(kind, seconds, res));
  const Ads = {
    demo: !native,
    async init() {
      if (!native) return;
      try { const { AdMob } = window.Capacitor.Plugins; await AdMob.initialize({ initializeForTesting: AD_CONFIG.testing }); this.admob = AdMob; } catch (e) { console.warn('AdMob init failed', e); }
    },
    removed() { return !!meta.d.removeAds; },
    canRewarded() { const a = meta.d.ads, t = new Date().toDateString(); if (a.rewardedDay !== t) { a.rewardedDay = t; a.rewardedToday = 0; } return a.rewardedToday < AD_CONFIG.rewardedPerDay; },
    async showRewarded(placement) {
      if (!this.canRewarded()) return false;
      let ok = false;
      if (this.admob) {
        try { await this.admob.prepareRewardVideoAd({ adId: AD_CONFIG.android.rewarded, isTesting: AD_CONFIG.testing }); const r = await this.admob.showRewardVideoAd(); ok = !!r; } catch (e) { ok = false; }
      } else ok = await demoOverlay('rewarded', 3);
      if (ok) { meta.d.ads.rewardedToday++; meta.save(); }
      return ok;
    },
    shouldInterstitial() {
      const a = meta.d.ads, now = Date.now() / 1000;
      if (meta.d.removeAds) return false; if (meta.d.stats.matches < AD_CONFIG.interstitialGraceMatches) return false;
      if (a.matchesSince < AD_CONFIG.interstitialEveryMatches) return false; if (now - (a.lastInterstitial || 0) < AD_CONFIG.interstitialMinSeconds) return false;
      return true;
    },
    async maybeInterstitial(placement) {
      if (!this.shouldInterstitial()) return false;
      meta.d.ads.matchesSince = 0; meta.d.ads.lastInterstitial = Date.now() / 1000; meta.save();
      if (this.admob) { try { await this.admob.prepareInterstitial({ adId: AD_CONFIG.android.interstitial, isTesting: AD_CONFIG.testing }); await this.admob.showInterstitial(); } catch (e) {} return true; }
      await demoOverlay('interstitial', 3); return true;
    },
  };
  const tierId = (t) => 'tier_' + Math.round(t * 100);
  const IAP = {
    demo: !native, products: PRODUCTS, pend: {},
    // catalog items / bundles / boxes (hundreds of them) are bought through a price-tier product; the client grants the item when Play verifies the tier purchase
    // r35: never fail silently — if Google Play is not ready (no store, product not registered yet, no offer) show a sheet with the price and a clear message
    unavailable(title, price, done) { const ios = !!storeKit(); try { ui.app.audio.play('click'); ui.modal([ui.h('h3', null, title || 'Покупка'), price ? ui.h('div', { class: 'big-title', style: 'font-size:26px' }, price) : null, ui.h('p', null, ios ? 'App Store не вернул этот товар. Покупка не выполнена.' : 'Покупки за деньги скоро будут доступны.'), ui.h('p', { class: 'note' }, ios ? 'Товар должен быть заведён в App Store Connect с тем же идентификатором.' : (BILLING_ENABLED ? 'Оплата через Google Play откроется после выхода игры в Google Play. Покупки за монеты и кристаллы работают уже сейчас.' : 'Покупки за монеты и кристаллы работают уже сейчас.')), ui.confirmBtns(['', 'ok', 'Понятно'])], null); } catch (e) {} if (done) done(false); return false; },
    offerOf(id) { try { const sp = this.store && this.store.get(id); const o = sp && sp.getOffer && sp.getOffer(); return o && sp.canPurchase !== false ? o : null; } catch (e) { return null; } },
    async buyTier(priceStr, done, title) {
      const v = parseFloat(String(priceStr).replace(',', '.')) || 0, id = tierId(tierOf(v));
      if (storeKit()) { const ok = await this.purchaseApple(id); if (done) done(ok); return ok; }
      const o = this.offerOf(id); if (!o) return this.unavailable(title, priceStr, done); this.pend[id] = done; try { const err = await o.order(); if (err) { delete this.pend[id]; done(false); } } catch (e) { delete this.pend[id]; done(false); }
    },
    priceOf(p) { const hit = this.loaded && this.loaded[p.id]; return hit && hit.displayPrice ? hit.displayPrice : p.price; },
    async init() {
      const sk = storeKit();
      if (sk) {
        this.sk = sk;
        this.loaded = {};
        try {
          const ids = APPLE_PRODUCTS.map(p => p.id);
          for (let attempt = 0; attempt < 8; attempt++) {
            const res = await sk.load({ ids });
            this.loadNote = 'req=' + ((res && res.requested) || 0) + ' got=' + ((res && res.products && res.products.length) || 0);
            for (const row of (res && res.products) || []) if (row && row.id) this.loaded[row.id] = row;
            if (Object.keys(this.loaded).length) break;
            await new Promise(r => setTimeout(r, 700));
          }
          this.ready = Object.keys(this.loaded).length > 0;
        } catch (e) { this.ready = false; console.warn('StoreKit load failed', e); }
        return;
      }
      if (!native || !BILLING_ENABLED || !window.CdvPurchase) return;
      try {
        const { store, ProductType, Platform } = window.CdvPurchase; this.store = store;
        store.register([...PRODUCTS.map(p => ({ id: p.id, type: p.once ? ProductType.NON_CONSUMABLE : ProductType.CONSUMABLE, platform: Platform.GOOGLE_PLAY })), ...PRICE_TIERS.map(t => ({ id: tierId(t), type: ProductType.CONSUMABLE, platform: Platform.GOOGLE_PLAY }))]);
        store.when().approved(t => t.verify()).verified(r => { for (const pr of r.collection || []) { if (/^tier_/.test(pr.id)) { const cb = this.pend[pr.id]; delete this.pend[pr.id]; if (cb) cb(true); } else this.grant(pr.id); } r.finish(); });
        await store.initialize([Platform.GOOGLE_PLAY]);
        for (const p of PRODUCTS) { const sp = store.get(p.id); if (sp && sp.pricing) p.price = sp.pricing.price; }
      } catch (e) { console.warn('IAP init failed', e); }
    },
    owned(id) { const p = PRODUCTS.find(x => x.id === id); if (!p) return false; if (id === 'remove_ads') return meta.d.removeAds; if (id === 'starter_pack') return meta.d.starter; if (p.myth) return (meta.d.myth || []).includes(p.myth); if (p.skin && p.once) return meta.d.skins.includes(p.skin); return false; },
    grant(id) {
      const p = PRODUCTS.find(x => x.id === id); if (!p) return;
      if (p.gems) meta.addGems(p.gems); if (p.coins) meta.addCoins(p.coins, false); if (p.skin) meta.grantSkin(p.skin);
      if (p.myth) { const L = meta.d.myth || (meta.d.myth = []); if (!L.includes(p.myth)) L.push(p.myth); } if (p.removeAds) meta.d.removeAds = true; if (id === 'starter_pack') meta.d.starter = true; meta.save();
    },
    applyEntitlement(body) {
      if (!body || !body.ok) return;
      if (body.account && window.__pbApplyAcct) window.__pbApplyAcct(meta, body.account);
      const kept = meta.d.coins | 0;
      if (body.myth) { const L = meta.d.myth || (meta.d.myth = []); if (!L.includes(body.myth)) L.push(body.myth); }
      if (body.skin) meta.grantSkin(body.skin);
      if (body.removeAds) meta.d.removeAds = true;
      if (body.starter) meta.d.starter = true;
      if (body.seasonPass) { const bp = meta.d.bp || (meta.d.bp = { xp: 0, fc: [], pc: [], prem: false }); bp.prem = true; }
      if (!body.replay && body.gems) meta.addGems(body.gems);
      if ((meta.d.coins | 0) !== kept) meta.d.coins = kept;
      meta.save();
    },
    async submitApple(jws) {
      const token = window.__pbDurableGet ? window.__pbDurableGet('pricopbum_account') : '';
      const res = await fetch(window.__pbApi('/api/iap/apple'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, jws }) });
      const body = await res.json();
      this.applyEntitlement(body);
      return body;
    },
    async purchaseApple(id) {
      const sk = this.sk || storeKit();
      const p = PRODUCTS.find(x => x.id === id);
      if (!sk) { this.last = { status: 'no-plugin' }; return false; }
      if (!this.loaded || !this.loaded[id]) { this.last = { status: 'unavailable', ready: !!this.ready, count: this.loaded ? Object.keys(this.loaded).length : 0 }; return this.unavailable(p && p.title, p && p.price); }
      this.busy = id;
      try {
        const result = await sk.purchase({ productId: id });
        this.last = result || { status: 'error' };
        if (!result || result.status === 'cancelled') { try { ui.toast('Покупка отменена', 'coin'); } catch (e) {} return false; }
        if (result.status === 'pending') { try { ui.toast('Покупка ожидает подтверждения', 'coin'); } catch (e) {} return false; }
        if (result.status !== 'purchased' || !result.jws) { try { ui.toast('Покупка не выполнена', 'coin'); } catch (e) {} return false; }
        const grant = await this.submitApple(result.jws);
        this.last = { ...result, ...grant, status: grant && grant.ok ? 'purchased' : (grant && grant.error) || 'error' };
        if (!grant || !grant.ok) { try { ui.toast('Чек не принят сервером', 'coin'); } catch (e) {} return false; }
        if (window.__pbIapScenario !== 'buy') { try { await sk.finish({ transactionId: result.transactionId }); } catch (e) {} }
        if (grant.coinsAdded) { try { ui.toast('+' + grant.coinsAdded + ' монет на счёте', 'coin'); } catch (e) {} }
        else if (!grant.replay) { try { ui.toast('Покупка выполнена', 'check'); } catch (e) {} }
        this.busy = '';
        try { ui.shop && ui.screen === 'shop' && ui.shop(); } catch (e) {}
        return !grant.replay;
      } catch (e) {
        this.last = { status: 'error' };
        try { ui.toast('Покупка не выполнена', 'coin'); } catch (err) {}
        return false;
      } finally { this.busy = ''; }
    },
    async purchase(id) {
      const p = PRODUCTS.find(x => x.id === id); if (!p || this.owned(id)) return false;
      if (storeKit()) return this.purchaseApple(id);
      if (native) { const o = this.offerOf(id); if (!o) return this.unavailable(p.title, p.price); try { const err = await o.order(); return !err; } catch (e) { return false; } } const ok = await new Promise(res => ui.demoPurchase(p, res)); if (ok) this.grant(id); return ok;
    },
    async restore() {
      const sk = this.sk || storeKit();
      if (sk) {
        let replay = false;
        try {
          const res = await sk.restore();
          const rows = [...(res.unfinished || []), ...(res.entitlements || [])];
          for (const row of rows) {
            if (!row || !row.jws) continue;
            const grant = await this.submitApple(row.jws);
            if (grant && grant.replay) replay = true;
            if (grant && grant.ok && row.transactionId) { try { await sk.finish({ transactionId: row.transactionId }); } catch (e) {} }
          }
        } catch (e) { this.last = { status: 'error' }; try { ui.toast('Не удалось восстановить покупки', 'coin'); } catch (err) {} return false; }
        this.last = { status: 'restored', replay, serverCoins: meta.d.serverCoins | 0 };
        try { ui.toast(replay ? 'Покупки уже были на счёте' : 'Покупки восстановлены', 'check'); } catch (e) {}
        try { ui.shop && ui.screen === 'shop' && ui.shop(); } catch (e) {}
        return true;
      }
      if (this.store) { try { await this.store.restorePurchases(); } catch (e) {} }
      return true;
    },
  };
  if (native) { const demo = ui.demoPurchase.bind(ui); ui.demoPurchase = (p, done) => (p && p.price ? IAP.buyTier(p.price, done, p.title) : demo(p, done)); } // native: shop items never granted without a real Play purchase
  if (typeof window !== 'undefined') { window.Ads = Ads; window.IAP = IAP; }
  Ads.init(); IAP.init();
  return { Ads, IAP };
}
