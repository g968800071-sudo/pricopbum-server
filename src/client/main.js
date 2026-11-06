import { ccFromLocale, drawFlag, ccOfName } from '../sim/flags.js';
import { rankOf, rankInfo, tankLv, tankLvFx } from './meta.js';
import { flagOf } from './tour.js';
import { GMODS } from '../sim/gmods.js';
import { botRanks, botMatch } from './meta.js';
import { mythLids, mythPk } from './prebattle.js';
import { LOOTX, ROCKETS, ammoInfo, fxText } from '../sim/loot.js';
import { MGS, TURRETS, mgInfo, turInfo } from '../sim/arms.js';
import { installI18n, setLang, detectLang } from './i18n.js';
import { itemBonus } from './catalog.js';
import { SHELLS } from '../sim/loadout.js';
import { GLStage } from './gl.js';
import { autoQuality } from './fx.js';
import './polyfill.js';
import { h } from './dom.js';
// PRICOPBUM — app shell: loop, sessions, event → effects/sound, results & economy hooks.
import { World } from '../sim/sim.js';
import { T_BRICK, T_STEEL, T_CRATE, T_BASE, WEAPONS, PICKUPS, CELL, TIERS, ARMOR_NAMES, ARMOR_KINDS, VARIANTS, HROCKET_LOCK, DMG_COLOR, PARTS, PART_NAMES } from '../sim/defs.js';
import { MAPS, BUGA_IDX, TRENCH_IDX } from '../sim/maps.js';
import { HTRAPS } from '../sim/htraps.js';
import { modelOf } from '../sim/models.js';
import { tmodOf, botModsOpts } from './tankmods.js';
const MODEL_NAME = (id) => { try { const M = modelOf(id); return M ? M.name || '' : ''; } catch (e) { return ''; } };
import { HUNT } from '../sim/defs.js';
import { MODS, teamTag, armorMax } from '../sim/defs.js';
import { ROT } from './dom.js';
import { voiceOf, mgClass } from './voice.js';
const fam0 = (w) => { const f = (WEAPONS[w] || {}).fam || w; return f === 'cannon' || f === 'twin' || w === 'heavy'; };
import { weightOf, loadK, W_MAX } from '../sim/weight.js';
const MAP_SIZES = { arena: [72, 48], duel: [72, 48], koth: [110, 72], sniper: [110, 72], survival: [100, 64], zombie: [100, 64], coop: [100, 64], boss: [110, 72], ctf: [100, 64] };
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Meta } from './meta.js';
import { UI } from './ui.js';
import { CSS } from './styles.js';
import { icon } from './icons.js';
import { installMonetization } from './monetization.js';
import { NetClient, RemoteSession } from '../net/client.js';
import { Bluetooth } from '../net/bluetooth.js';

const VERSION = '1.0.0';
const STEP = 1 / 60;
const AIM_ASSIST = { 1: { cone: 0.16, pull: 0.35, lead: 0.35, range: 210 }, 2: { cone: 0.26, pull: 0.6, lead: 0.6, range: 250 }, 3: { cone: 0.38, pull: 0.88, lead: 0.85, range: 290 } };

class LocalSession {
  constructor(app, variant, extra = {}) {
    const p = app.playerCfg(); this.player = p;
    let V = VARIANTS[variant] || VARIANTS.br, mode = V.mode; this.variant = variant; const d = app.meta.d; let vo = { ...V.opts }; if (variant === 'brg' && (d.brSize || 0) === 2) vo.total = 150;
    if (variant === 'arena') { const f = d.arenaF || 3; if (f === 'ffa6') { mode = 'br'; vo = { ffa: true, total: 6, mapSize: 110, target: 15, timeLimit: 300 }; } else { vo.perTeam = f; vo.target = f * 7; } }
    if (variant === 'ffa') { vo.target = d.ffaT || 50; vo.timeLimit = Math.max(900, vo.target * 18); }
    if (mode === 'team') { const sz = MAP_SIZES[variant] || [150, 96]; vo.mapW = sz[0]; vo.mapH = sz[1]; const cm = variant === 'race' ? null : extra.custom || (d.mapSel === 'custom' ? d.customMap : null);
      if (cm) vo.custom = cm; else vo.map = typeof d.mapSel === 'number' && d.mapSel >= 0 ? d.mapSel : Math.floor(Math.random() * MAPS.length); }
    else if (mode !== 'classic') vo.map = typeof d.mapSel === 'number' && d.mapSel >= 0 ? d.mapSel : Math.floor(Math.random() * MAPS.length); // r26: every mode on every map
    if (variant === 'br' || variant === 'brg') vo.terrain = 1; // r37: relief only in Королевская битва (standard, giant, giant-150)
    Object.assign(vo, botModsOpts(d)); // r37: bots upgrade legendary tanks with the same coin economy
    if (variant === 'trench') { vo.map = TRENCH_IDX; vo.mapW = 220; vo.mapH = 130; delete vo.custom; } // r37 «Траншеи»: fixed map
    if (variant === 'hunt') { vo.map = BUGA_IDX; vo.mapW = 120; vo.mapH = 80; delete vo.custom; d.huntRound = (d.huntRound | 0) + 1; vo.huntTarget = extra.huntRole === 'target' || (extra.huntRole == null && d.huntRound % 2 === 1) ? 'me' : null; this.huntRole = vo.huntTarget ? 'target' : 'hunter'; } // r36 «Охота»: the target role rotates every round
    const pl = extra.spec ? [] : [{ ...p, cid: 'me' }]; if (extra.botNames) vo.botNames = extra.botNames; if (vo.coop) pl.push({ ...p, name: 'Игрок 2', skin: p.skin === 'desert' ? 'olive' : 'desert', cid: 'p2', team: 0 }); if ((vo.coop || mode === 'team') && pl[0]) pl[0].team = 0;
    this.app = app; this.mode = mode; this.canPause = true; this.online = false; this.extra = extra;
    this.world = new World({ mode, seed: (Math.random() * 1e9) | 0, ...vo, botRk: botRanks(app.meta.d), players: pl, diff: app.meta.d.diff ?? 1, squad: variant === 'br' ? (app.meta.d.squad || 1) : (vo.squad || 1), level: extra.level || 0, lives: extra.lives, score: extra.score });
    this.p2 = this.world.tanks.find(t => t.cid === 'p2') || null; if (this.p2) this.p2.baseWeapon = p.weapon;
    this.me = this.world.tanks.find(t => t.cid === 'me'); if (this.me) { this.me.baseWeapon = p.weapon; if (extra.stars) this.me.stars = extra.stars; }
    this.acc = 0; this.paused = false; this.evBuf = [];
  }
  get view() { return this.world; }
  get meId() { return this.me ? this.me.id : 0; }
  update(dt, inp) {
    this.evBuf.length = 0; if (this.paused) return this.evBuf;
    this.acc += dt; let n = 0;
    while (this.acc >= STEP && n < 6) { if (this.me) Object.assign(this.me.input, inp); if (this.p2 && this.inp2) Object.assign(this.p2.input, this.inp2); this.world.step(STEP); for (const e of this.world.events) this.evBuf.push(e); this.acc -= STEP; n++; inp.fire = inp.fire && !inp.once; }
    if (n === 6) this.acc = 0;
    return this.evBuf;
  }
  destroy() {}
}

export class App {
  constructor(root, opts = {}) {
    this.root = root; this.opts = opts; this.version = VERSION;
    const wrap = document.createElement('div'); wrap.className = 'pcb'; this.wrap = wrap;
    const st = document.createElement('style'); st.textContent = CSS; wrap.appendChild(st);
    this.cv = document.createElement('canvas'); this.cv.className = 'pcb-cv'; wrap.appendChild(this.cv);
    this.gls = new GLStage(wrap, this.cv, { T_BRICK, T_STEEL, T_CRATE, T_BASE }); this.camYaw = null; this.camRot = null;
    root.appendChild(wrap);
    this.meta = new Meta(); { const st = this.meta.d.settings; if (!st.lang) { st.lang = detectLang(); this.meta.save(); } setLang(st.lang); this._i18nOff = installI18n(root); }
    this.audio = new Audio(); this.renderer = new Renderer(this.cv); this.hud = new Hud();
    this.input = new Input(this.cv, () => this.layout); this.input.onKeyAction = (k) => this.onKey(k); this.input.onFireStart = () => this.vibrate(8); // r26: haptic tick the moment the fire stick engages
    this.ui = new UI(this, wrap);
    const mon = installMonetization(this.ui, this.meta); this.Ads = mon.Ads; this.IAP = mon.IAP;
    this.net = new NetClient(this); this.bt = new Bluetooth(this);
    this.state = 'menu'; this.session = null; this.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.applySettings();
    this.resize(); try { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(wrap); } catch (e) { this.ro = { disconnect() {} }; } this._onWinResize = () => { this._orK = null; this.resize(); setTimeout(() => { this._orK = null; this.resize(); }, 260); setTimeout(() => { this._orK = null; this.resize(); }, 800); }; try { window.addEventListener('resize', this._onWinResize); window.addEventListener('orientationchange', this._onWinResize); if (window.visualViewport) { window.visualViewport.addEventListener('resize', this._onWinResize); window.visualViewport.addEventListener('scroll', this._onWinResize); } window.addEventListener('pageshow', this._onWinResize); for (const t of [100, 300, 800, 1600]) setTimeout(() => { this._orK = null; this.resize(); }, t); } catch (e) {}
    const unlock = () => { this.audio.ensure(); if (this.state === 'menu') this.audio.playMusic('menu'); }; wrap.addEventListener('pointerdown', unlock, { once: true });
    this.onVis = () => { if (document.hidden) { if (this.session && this.session.canPause && !this.session.paused && this.state === 'game') this.pause(); this.audio.ctx && this.audio.ctx.suspend && this.audio.ctx.suspend(); } else if (this.audio.ctx) this.audio.ctx.resume(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.startAttract(); try { const q = new URLSearchParams(location.search), rc = q.get('room'); if (rc && /^[A-Za-z0-9]{5}$/.test(rc)) { this.ui.pendingRoom = rc.toUpperCase(); const sv = q.get('srv'); if (sv && /^wss?:\/\/[\w.:\-\/\[\]]+$/.test(sv)) this.ui.pendingSrv = sv; } } catch (e) {}
    if (typeof location !== 'undefined' && /nosplash/.test(location.hash)) this.ui.menu(); else this.ui.studioSplash(() => this.ui.menu());
    this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.loop(t));
    this.debug = { app: this };
    if (typeof window !== 'undefined') window.__pricopbum = this.debugApi();
  }
  destroy() { if (this._i18nOff) this._i18nOff(); cancelAnimationFrame(this.raf); this.ro.disconnect(); this.input.destroy(); this.audio.stopMusic(); document.removeEventListener('visibilitychange', this.onVis); this.net.disconnect(); this.wrap.remove(); }
  playerCfg() { const d = this.meta.d, tlv = tankLv((d.tankXp || {})[String(d.model ?? 0)]); const TM = d.tmp || []; return { extraLives: (d.mb && d.mb.lives) || 0, tlv, tfx: tankLvFx(tlv), rank: rankOf(d), rki: rankInfo(d).i, name: d.name, cc: d.cc || ccFromLocale(navigator.language), skin: d.skin, model: d.model ?? 0, tmod: tmodOf(d, d.model ?? 0), build: (d.builds || [])[d.buildSel || 0] || null, loadout: d.loadout || null, ib: itemBonus(d), weapon: (d.mb && d.mb.weapon) || d.weapon, tur: d.turSel ?? null, buy: (d.myth && d.myth.length) || TM.length || (d.mb && (d.mb.lx.length || d.mb.pk.length)) ? { lx: [...mythLids(d), ...TM.filter(x => x.lid != null).map(x => x.lid), ...((d.mb && d.mb.lx) || [])], pk: [...mythPk(d), ...TM.filter(x => x.pk).map(x => x.pk), ...((d.mb && d.mb.pk) || [])] } : null, lv: Object.fromEntries(Object.entries(d.up).map(([k, v]) => [k, Math.min(5, v + ((d.mb && d.mb.up[k]) || 0) + (d.mb && d.mb.kit ? 1 : 0))])), human: true }; }
  applySettings() { const s = this.meta.d.settings; if (!s.q31) { s.q31 = 1; if (s.quality === 1) s.quality = 3; try { this.meta.save(); } catch (e) {} } /* r31: mobile default = auto quality */ if (this.input) this.input.sens = 0.5 + (s.sens ?? 0.5); if (this.hud) this.hud.joyA = 0.25 + 0.75 * (s.joyA ?? 1); this._orK = null; try { this.applyOrient(); } catch (_) {} this.audio.setSfx(s.sfx); this.audio.setMusic(s.music); this.audio.setVolumes(s.musVol ?? 0.8, s.sfxVol ?? 1); this.qAuto = (s.quality ?? 3) === 3; this.renderer.quality = [0.45, 0.75, 1, 1, 1.5][s.quality ?? 3]; this.renderer.ultra = (s.quality ?? 3) === 4; this.renderer.qMax = /iPhone|iPad|Android/i.test(navigator.userAgent) ? 1 : 1.2; /* r25: Ultra preset; Auto picks Medium–High on phones */ this.input.leftHanded = !!s.leftHanded; }
  resumeMusic() { if (this.state === 'game') this.audio.playMusic(this.session && this.session.mode === 'classic' ? 'classic' : 'battle'); else this.audio.playMusic('menu'); }
  vibrate(ms) { if (!this.meta.d.settings.vibro) return; const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics; try { if (H && H.impact) H.impact({ style: ms >= 80 ? 'HEAVY' : ms >= 35 ? 'MEDIUM' : 'LIGHT' }); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  // ---------- layout ----------
  // r22: in-game orientation lock (iOS host webviews keep the page portrait): 0 Авто, 1 Вертикально, 2 Горизонтально.
  // When the wanted orientation differs from the screen, the whole game root is rotated 90° clockwise with CSS; pointer math uses rel() from dom.js.
  applyOrient() { const w = this.wrap, s = (this.meta && this.meta.d.settings) || {}, pr = this.root.getBoundingClientRect(), vv = window.visualViewport, VW = Math.round(pr.width || (vv && vv.width) || window.innerWidth), VH = Math.round(pr.height || (vv && vv.height) || window.innerHeight), /* r34: size = the root's own fixed box (what Safari actually shows); vv/inner only as fallback */ mode = 2; // r32: portrait viewport → render rotated 90° (iOS can't lock orientation); was r31: landscape only — no CSS rotation; portrait shows the «Поверните телефон» overlay
    this.landGate(VW, VH); // r29: forced orientation only rotates the battle; menus always follow the real viewport
    const rot = (mode === 2 && VW < VH) || (mode === 1 && VW > VH); ROT.on = rot; w.classList.toggle('rot', rot); const key = rot + ':' + VW + 'x' + VH + ':' + (this.state === 'game'); if (this._orK === key) return; this._orK = key;
    if (this._orK0 !== undefined && String(this._orK0) !== String(rot)) { w.style.transition = 'opacity .18s'; w.style.opacity = '0'; setTimeout(() => { w.style.opacity = '1'; }, 60); } this._orK0 = rot; if (rot) { w.style.right = w.style.bottom = 'auto'; w.style.position = 'absolute'; w.style.left = '0px'; w.style.top = '0px'; w.style.margin = '0'; w.style.maxWidth = w.style.maxHeight = 'none'; w.style.boxSizing = 'border-box'; try { window.scrollTo(0, 0); } catch (e) {} w.style.width = VH + 'px'; w.style.height = VW + 'px'; w.style.transformOrigin = '0 0'; w.style.transform = 'translateX(' + VW + 'px) rotate(90deg)'; }
    else { for (const k of ['margin', 'maxWidth', 'maxHeight', 'boxSizing', 'position', 'right', 'bottom', 'left', 'top', 'width', 'height', 'transformOrigin', 'transform']) w.style[k] = ''; } }
  landGate(VW, VH) { let o = this._lg; if (!o) { o = this._lg = document.createElement('div'); o.className = 'rotgate'; o.style.cssText = 'position:fixed;inset:0;z-index:99999;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#000;color:#fff;text-align:center;padding:24px;font-family:system-ui,sans-serif'; o.append(Object.assign(document.createElement('div'), { className: 'rotph', textContent: '📱' }), Object.assign(document.createElement('b'), { textContent: 'Поверните телефон горизонтально' }), Object.assign(document.createElement('small'), { textContent: 'PRICOPBUM играется только в горизонтальном режиме' })); this.root.appendChild(o);
      const lock = () => { try { const de = document.documentElement, fs = de.requestFullscreen || de.webkitRequestFullscreen; if (fs && !document.fullscreenElement && !document.webkitFullscreenElement && !/iPhone|iPad/.test(navigator.userAgent)) { const r = fs.call(de, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } } catch (e) {} try { window.scrollTo(0, 1); } catch (e) {} try { const so = screen.orientation; if (so && so.lock) so.lock('landscape').catch(() => {}); } catch (e) {} }; lock(); this.root.addEventListener('pointerdown', lock, { once: true }); }
    const port = VW < VH; o.style.display = 'none'; /* r32: never block — portrait is rendered rotated */ if (o.parentNode !== document.body && document.body) document.body.appendChild(o); this.portrait = port; }
  cycleOrient() { const s = this.meta.d.settings; s.orient = ((s.orient | 0) + 1) % 3; this.meta.save(); this._orK = null; this.resize(); setTimeout(() => this.resize(), 60); return ['Авто', 'Вертикально', 'Горизонтально'][s.orient]; }
  resize() {
    this.applyOrient(); const r = { width: this.wrap.offsetWidth || this.wrap.getBoundingClientRect().width, height: this.wrap.offsetHeight || this.wrap.getBoundingClientRect().height }; const W = Math.max(200, r.width), H = Math.max(300, r.height), dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2) * (this.qAuto && this.renderer && this.renderer.dprK || 1)); // r31: auto quality also lowers render resolution
    this.W = W; this.H = H; this.renderer.resize(W, H, dpr); if (this.gls && this.gls.ok) { this.gls.cv.style.width = W + 'px'; this.gls.cv.style.height = H + 'px'; } this.computeLayout();
  }
  safeInsets() {
    // read env(safe-area-inset-*) through a hidden probe (notch side in landscape)
    try { if (!this._sap) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-top:env(safe-area-inset-top,0px)'; document.body.appendChild(d); this._sap = d; }
      const cs = getComputedStyle(this._sap), P = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, t: parseFloat(cs.paddingTop) || 0 }; return ROT.on ? { l: P.t, t: P.r, r: P.b, b: P.l } : P; /* r32: rotated 90° cw — physical top is the content's left edge */ } catch (e) { return { l: 0, r: 0, b: 0, t: 0 }; }
  }
  computeLayout() {
    const W = this.W, H = this.H, mode = this.session ? this.session.mode : 'br';
    const R = Math.round(0.78 * Math.max(44, Math.min(68, Math.min(W, H) * 0.15)) * /* r33: sticks ~22% smaller */ [0.8, 1, 1.18, 1.35][this.meta.d.settings.joy ?? 1]); // r19: joystick size setting
    const ins = this.safeInsets(), land = W > H * 1.1;
    const L = { W, H, stickR: R, safeTop: 4 + (ins.t || 0), st: ins.t || 0, topSafe: 64, land, sl: ins.l, sr: ins.r, sb: ins.b };
    L.moveHint = { x: R + 26 + ins.l, y: H - R - (land ? 22 : 34) - ins.b }; L.aimHint = { x: W - R - 26 - ins.r, y: H - R - (land ? 22 : 34) - ins.b };
    if (this.input.leftHanded) { const t = L.moveHint; L.moveHint = L.aimHint; L.aimHint = t; }
    if (mode === 'classic') {
      const top = 74, S = Math.min(W - 12, H - top - (2 * R + 96)); L.vp = { x: (W - S) / 2, y: top, w: S, h: S }; L.zoom = S / 416; L.hudBottom = L.vp.y + S + 40;
      if (W > H * 1.1) { const S2 = Math.min(H - 80, W - 4 * R - 120); L.vp = { x: (W - S2) / 2, y: 70, w: S2, h: S2 }; L.zoom = S2 / 416; L.hudBottom = H - 8; }
    } else { L.vp = { x: 0, y: 0, w: W, h: H }; L.zoom = Math.max(1, Math.min(W, H) / (land ? 215 : 205)); /* r22: closer top view, bigger tanks */ L.hudBottom = H - 2 * R - 92 - ins.b; }
    if (W > H * 1.1) L.hudBottom = H - 8 - (mode === 'classic' ? 0 : ins.b); L.hpW = land && mode !== 'classic' ? Math.min(170, W * 0.26) : Math.min(220, W * 0.5);
    this.layout = L;
  }

  // ---------- attract mode (background battle behind the menu) ----------
  startAttract() {
    this.attract = new World({ mode: 'team', seed: 4242, perTeam: 6, players: [], target: 9999, timeLimit: 1e9, countdown: 0 });
    this.attractFollow = this.attract.tanks[0].id; this.attractAcc = 0;
  }

  // ---------- starting matches ----------
  startLocal(mode, extra = {}) {
    this.audio.ensure();
    if (!extra.noPre && !extra.level && !window.__noPre) { this.ui.prebattle(mode, () => this.startLocal(mode, { ...extra, noPre: 1 })); return; } // r20: one-match loadout screen
    this.ui.fade(() => {
      this.endOverlay(); this.ui.clear();
      if (this.session) this.session.destroy();
      this.session = new LocalSession(this, mode, extra); this.pickAtmo(); this.beginSession();
    });
  }
  pickAtmo() { const w = this.meta.d.settings.weather ?? 0, ids = ['day', 'dusk', 'night', 'rain', 'fog', 'snow']; this.renderer.atmo = w === 1 ? 'day' : w >= 2 ? ids[w - 2] : (Math.random() < 0.3 ? 'day' : ids[Math.floor(Math.random() * ids.length)]); this.renderer.wrecks = []; }
  startSession(session) { this.ui.fade(() => { this.endOverlay(); this.ui.clear(); if (this.session) this.session.destroy(); this.session = session; this.pickAtmo(); this.beginSession(); }); }
  beginSession() {
    this.closeModals(); const s = this.session; this.state = 'game'; if (s.extra && s.extra.spec) setTimeout(() => { if (this.session === s) this.specStart(); }, 400); if (this.hud) this.hud.banners = []; { const d = this.meta.d; if (d.mb) d.mb = null; if (d.itemsTmp && d.itemsTmp.length) { const T = new Set(d.itemsTmp); d.items = (d.items || []).filter(x => !T.has(x)); for (const k in d.itemEq || {}) if (T.has(d.itemEq[k])) delete d.itemEq[k]; d.itemsTmp = []; } this.meta.save(); } // r20: one-match purchases are consumed by this match this.computeLayout(); this.hud = new Hud(); this.hud.chatMode = this.meta.d.settings.chat ?? 1; this.renderer.setMap(s.view.map, s.mode); this.renderer._camInit = false;
    this.stats = { kills: 0, damage: 0, pickups: 0, crates: 0, classicLevels: this.stats && s.extra && s.extra.level ? this.stats.classicLevels : 0 };
    if (!(s.extra && s.extra.level)) this.stats.classicLevels = 0;
    this.deadT = 0; this.overShown = false; this.lastCount = -1; this.revived = this.revived && s.extra && s.extra.level ? this.revived : false; this.spectate = 0; this.tapPending = 0;
    this.input.reset(); this.input.enabled = true;
    this.audio.playMusic(s.mode === 'classic' ? 'classic' : 'battle');
    this.makeGameButtons();
    if (s.mode === 'classic') this.hud.banner('УРОВЕНЬ ' + ((s.view.level || 0) + 1), s.view.levelName, '#ffd23d', 2.2);
    else if (s.view.ffa) this.hud.banner('КАЖДЫЙ ЗА СЕБЯ', 'Первый, кто наберёт ' + s.view.target + ' уничтожений, побеждает', '#ffd23d', 2.4);
    else if (s.view.special === 'koth') this.hud.banner('ЦАРЬ ГОРЫ', 'Удерживай точку в центре · до ' + s.view.target + ' очков', '#ffd23d', 2.4);
    else if (s.view.special === 'survival') this.hud.banner(s.p2 ? 'КООПЕРАТИВ' : 'ВЫЖИВАНИЕ', s.p2 ? 'Низ экрана — игрок 1, верх — игрок 2' : 'Продержись как можно больше волн · 3 жизни', '#ff9f3d', 2.6);
    else if (s.view.special === 'zombie') this.hud.banner('ЗОМБИ-ТАНКИ', 'Не подпускай орду близко · 3 жизни', '#8fdc5a', 2.4);
    else if (s.view.special === 'boss') this.hud.banner('БОСС «МАМОНТ»', 'Уничтожьте босса за 5 минут', '#ff5d5d', 2.4);
    else if (s.view.special === 'sniper') this.hud.banner('СНАЙПЕРЫ', 'Только рельсотроны · до ' + s.view.target, '#c48bff', 2.4);
    else if (s.view.special === 'ctf') this.hud.banner('ЗАХВАТ ФЛАГА', 'Укради флаг врага и привези к своему · до ' + s.view.target, '#5cc2ff', 2.6);
    else if (s.view.special === 'race') this.hud.banner('ТАНКОВЫЕ ГОНКИ', s.view.laps + ' круга по контрольным точкам · стрелять можно!', '#ffd23d', 2.6);
    else if (s.variant === 'duel') this.hud.banner('ДУЭЛЬ', 'Один на один · до ' + s.view.target + ' побед', '#ff9f3d', 2.4);
    else if (s.variant === 'arena') this.hud.banner('АРЕНА 3×3', 'До ' + s.view.target + ' уничтожений', '#5cc2ff', 2.4);
    else if (s.variant === 'moba') { this.hud.banner('ОБОРОНА БАЗ', 'Сноси башни по линиям и уничтожь вражеский штаб', '#ffd54f', 3); if (!localStorage.getItem('pcb_mobaTip')) { try { localStorage.setItem('pcb_mobaTip', '1'); } catch (e) {} setTimeout(() => this.hud.note('Подсказка: 3 линии и лес. Башни бьют сами — сперва внешние, потом внутренние и базовые. Штаб лечит. Золото тратьте в «Магазине базы».', '#ffd54f', 9), 3200); } }
    else if (s.variant === 'team20') this.hud.banner('БИТВА 20×20', 'До ' + s.view.target + ' уничтожений', '#5cc2ff', 2.4);
    else if (s.mode === 'br') this.hud.banner('КОРОЛЕВСКАЯ БИТВА', s.view.tanks.length + ' танков · останься последним', '#ff9f3d', 2.4);
    else this.hud.banner('КОМАНДНЫЙ БОЙ', 'Первые ' + (s.view.target || 100) + ' уничтожений — победа', '#5cc2ff', 2.4);
  }
  makeGameButtons() {
    this.endOverlay();
    const g = document.createElement('div'); g.className = 'pcb-game'; g.appendChild(h('button', { class: 'gbtn', style: 'right:10px;top:8px', data: { g: 'pause' } }, icon('pause', 20))); g.appendChild(h('button', { class: 'gbtn setbtn', data: { g: 'setg' }, title: 'Настройки' }, icon('gear', 20))); g.appendChild(h('button', { class: 'gbtn oribtn', data: { g: 'orient' }, title: 'Ориентация экрана' }, '⟲')); { const ob = g.querySelector('.oribtn'); ob.style.setProperty('left', '10px', 'important'); ob.style.setProperty('right', 'auto', 'important'); ob.style.setProperty('top', '196px', 'important'); ob.style.fontSize = '18px'; } if (this.session && this.session.mode !== 'classic') g.appendChild(h('button', { class: 'gbtn cambtn', data: { g: 'cam' }, title: 'Камера (C)' }, h('span', { class: 'camic' })));
    this.actEls = null;
    if (this.session && this.session.mode !== 'classic') {
      const ab = (k, ic, key) => h('button', { class: 'abtn', data: { g: k }, title: key }, h('i', { class: 'aic ' + k }), h('b', null, '0'));
      const take = h('button', { class: 'takebtn', data: { g: 'take' } }, h('span', { class: 'tk' }, 'ВЗЯТЬ'), h('small', null, ''));
      const items = h('div', { class: 'items' }, ab('med', 'med', 'Q'), ab('smoke', 'smoke', 'F'), ab('mine', 'mine', 'G'), ab('drone', 'drone', '7'), ab('invis', 'invis', 'I'), ab('ldrone', 'ldrone', '8'), ab('twinr', 'twinr', '9'), ab('twintrap', 'twintrap', '0'), ab('hrocket', 'hrocket', 'R'), ab('beacon', 'beacon', 'B'), ab('revive', 'revive', 'V'), ab('sentry', 'sentry', 'T'), ab('blocks', 'blocks', 'Y'), ab('molotov', 'molotov', 'M'), ab('htw', 'htw', 'H'));
      const dive = h('button', { class: 'divebtn', data: { g: 'dive' } }, 'Погрузиться'); g.appendChild(dive); const bunk = h('button', { class: 'divebtn bkbtn', data: { g: 'bunker' } }, 'Спуститься'); g.appendChild(bunk);
      let shop = null; if (this.session.variant === 'moba') { shop = h('div', { class: 'mshop' }, h('b', null, 'Магазин базы'), h('button', { data: { g: 'mbuy_dmg' } }, 'Урон +10%'), h('button', { data: { g: 'mbuy_arm' } }, 'Броня +10%'), h('button', { data: { g: 'mbuy_spd' } }, 'Скорость +5%')); g.appendChild(shop); g.appendChild(h('button', { class: 'gbtn mshopt', data: { g: 'mshopt' }, title: 'Магазин базы' }, '🛒')); }
      g.appendChild(take); g.appendChild(items); const wl = h('div', { class: 'wlist' }); g.appendChild(wl);
      const rv = h('button', { class: 'divebtn rvbtn', data: { g: 'revive' } }, 'Воскресить'); g.appendChild(rv);
      const gvb = h('button', { class: 'gbtn givebtn', data: { g: 'givep' }, title: 'Инвентарь' }, 'Груз'); g.appendChild(gvb);
      const qcb = h('button', { class: 'gbtn qcbtn', data: { g: 'qchat' }, title: 'Быстрый чат (T)' }, '💬'); g.appendChild(qcb);
      const fgb = h('button', { class: 'gbtn fgbtn', data: { g: 'fgrp' }, title: 'Группа орудий (X)' }, 'ВСЕ'); g.appendChild(fgb);
      const gp = h('div', { class: 'wlist gpanel' }); g.appendChild(gp);
      const qc = h('div', { class: 'wlist qcpanel' }, h('b', null, 'Быстрый чат'), ...[['req_ammo', 'Нужны патроны'], ['req_med', 'Нужна аптечка'], ['req_armor', 'Нужна броня'], ['req_weapon', 'Нужно оружие'], ['req_help', 'Помогите!'], ['req_coming', 'Иду на помощь']].map(([k, t]) => h('button', { data: { g: k } }, t))); g.appendChild(qc);
      const shb = h('button', { class: 'shbtn', data: { g: 'shell' }, title: 'Сменить снаряд (N)' }, h('b', null, 'ББ'), h('small', null, '∞')); g.appendChild(shb);
      const rkb = h('button', { class: 'gbtn rkbtn', data: { g: 'rkt' }, title: 'Ракета (K), смена — L' }, h('b', null, 'Р'), h('small', null, '')); g.appendChild(rkb); const rkn = h('button', { class: 'gbtn rknext', data: { g: 'rk_next' } }, '⟳'); g.appendChild(rkn); const dtb = h('button', { class: 'gbtn detbtn', data: { g: 'det' }, title: 'Подрыв радиомин (J)' }, 'ДЕТ'); g.appendChild(dtb);
      const tp = h('div', { class: 'wlist traypanel' }); g.appendChild(tp); const tray = h('button', { class: 'gbtn traybtn', data: { g: 'tray' }, title: 'Остальные предметы' }, h('span', null, '🎒'), h('small', null, '')); g.appendChild(tray);
      const shm = h('button', { class: 'gbtn shmore', data: { g: 'shpan' }, title: 'Выбор снаряда' }, '▾'); g.appendChild(shm);
      const shp = h('div', { class: 'wlist shpanel' }); g.appendChild(shp);
      const htp = h('div', { class: 'htpanel' }, h('div', { class: 'hth' }, h('b', null, '🪤 Ловушки цели'), h('button', { class: 'hthelp', data: { g: 'hthelp' } }, '?'), h('button', { class: 'htx', data: { g: 'htw' } }, '✕')), h('div', { class: 'htg' }, ...HTRAPS.map(T => h('button', { class: 'htb', data: { g: 'ht_' + T.k }, style: { '--c': T.col } }, h('i', null, T.ic), h('span', null, T.name), h('b', null, '0'))))); g.appendChild(htp); // r36 «Охота»: trap wheel
      this.actEls = { take, items, dive, bunk, shop, wl, rv, gvb, qcb, fgb, gp, qc, shb, shm, shp, htp, rkb, rkn, dtb, tray, tp, itemList: [...items.children], trayOpen: false, last: {} };
    }
    const stop = (e) => { if (e.target.closest('[data-g]')) e.stopPropagation(); };
    g.addEventListener('pointerdown', stop); g.addEventListener('touchstart', stop, { passive: true });
    g.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g; if (k === 'tray') { const A = this.actEls; A.trayOpen = !A.trayOpen; A.last.hudKey = null; this.audio.play('click', 0.5); return; } if (this.actEls && this.actEls.trayOpen && b.classList.contains('intray')) { this.actEls.trayOpen = false; this.actEls.last.hudKey = null; } if (k === 'mshopt') { const S = this.actEls && this.actEls.shop; if (S) S.classList.toggle('mopen'); return; } if (k === 'pause') { this.audio.play('click'); this.pause(); } else if (k === 'orient') { this.audio.play('click'); const n = this.cycleOrient(); this.hud.banner('Ориентация: ' + n, null, '#fff', 1.2, false); } else if (k === 'setg') { this.audio.play('click'); const S = this.session; if (S && S.canPause) S.paused = true; this.input.reset(); this.ui.settingsBattle(() => { if (this.session) this.session.paused = false; this.applySettings(); this.computeLayout(); }); } else if (k === 'cam') { if (this.session && this.session.camLock >= 0) { this.hud.banner('КАМЕРА ЗАКРЕПЛЕНА', null, '#ffb35c', 0.8); return; } const S = this.meta.d.settings; S.camera = [1, 3, 0, 2][S.camera ?? 0] ?? 1; this.meta.save(); this.audio.play('click'); this.hud.banner(['СВЕРХУ', '3-Е ЛИЦО', 'ДРОН', '3-Е ЛИЦО · БЛИЗКО'][S.camera], null, '#7fd8ff', 0.8); this.camYaw = null; } else if (k === 'htw') { const P = this.actEls.htp; P.classList.toggle('on'); this.audio.play('click', 0.5); } else if (k === 'hthelp') { this.huntHelp(); } else if (/^ht_/.test(k)) { this.actEls.htp.classList.remove('on'); this.doAct(k); } else if (k === 'shpan') { const P = this.actEls.shp; P.style.display = P.style.display === 'flex' ? 'none' : 'flex'; this.actEls.last.shk = null; } else if (k === 'givep' || k === 'qchat') { const P = k === 'givep' ? this.actEls.gp : this.actEls.qc, on = P.style.display !== 'flex'; this.actEls.gp.style.display = this.actEls.qc.style.display = 'none'; P.style.display = on ? 'flex' : 'none'; this.actEls.last.gpk = null; this.audio.play('click', 0.5); } else { if (/^(req_|give_|drop_)/.test(k)) { this.actEls.qc.style.display = 'none'; } if (/^shell_/.test(k)) this.actEls.shp.style.display = 'none'; this.doAct(k); } });
    if (!this._trayPD) { this._trayPD = (e) => { const A = this.actEls; if (A && A.trayOpen && !(e.target.closest && e.target.closest('[data-g]'))) { A.trayOpen = false; A.last.hudKey = null; } }; this.wrap.addEventListener('pointerdown', this._trayPD, true); }
    this.wrap.appendChild(g); this.gameEl = g;
  }
  lifeOffer() { // r26: death-screen «Купить жизнь» (8 s window, coins, this match only)
    const P = 15, d = this.meta.d; if (this._lifeB) this._lifeB.remove(); const b = document.createElement('button'); b.className = 'btn y big lifebuy'; b.textContent = '❤ ' + 'Купить жизнь' + ' · ' + P + ' 🪙'; b.style.position = 'absolute'; b.style.left = '50%'; b.style.top = '62%'; b.style.transform = 'translateX(-50%)'; b.style.zIndex = '60';
    b.onclick = () => { if (d.coins < P) { this.ui.toast('Не хватает монет', 'coin'); return; } this.meta.spend('coins', P); this.meta.save(); this.actN = (this.actN || 0) + 1; this.actK = 'buylife'; b.remove(); }; this.wrap.appendChild(b); this._lifeB = b; setTimeout(() => { if (b.isConnected) b.remove(); }, 8000); }
  huntHelp() { const S = this.session; if (S && S.canPause) S.paused = true; this.input.reset(); // r36: short in-game help for «Охота» and the trap kit
    this.ui.modal([h('h3', null, '🎯 Охота · BUGA.BUM'), h('p', { class: 'hhelp' }, 'Цель — 1 танк против 5 охотников. У цели ' + HUNT.tLives + ' жизней, бесконечные снаряды, HP ×' + HUNT.hpMul + ', скорость +' + Math.round((HUNT.spdMul - 1) * 100) + '% и ловушки; урон у всех одинаковый. После каждой потерянной жизни цель возрождается в новом танке. У охотников по ' + HUNT.hLives + ' жизни. Цель побеждает, если продержится 10 минут или уничтожит всех охотников; охотники — если заберут все 5 жизней цели.'),
      h('div', { class: 'hhelp-l' }, ...HTRAPS.map(T => h('div', null, h('i', { style: { color: T.col } }, T.ic), h('b', null, T.name + ' ×' + T.n), h('span', null, T.info)))), h('p', { class: 'hhelp' }, 'Ловушки ставятся позади танка (перезарядка 2,5 с). Охотники видят ловушку только вблизи и могут её расстрелять.'), h('div', { class: 'btns' }, h('button', { class: 'btn y', data: { m: 'ok' } }, 'Понятно'))],
      () => { if (this.session) this.session.paused = false; }); }
  doAct(k) { if (this.state !== 'game' || this.overShown) return; this.actN = (this.actN || 0) + 1; this.actK = k; this.audio.play('click', 0.5); }
  // r29: one fixed HUD grid for every screen size/orientation — top row, minimap, left column, and a collision-checked arc of buttons around the fire stick
  placeHud() {
    const A = this.actEls, Lo = this.layout; if (!A || !Lo || !A.take.parentElement) return; const root = A.take.parentElement;
    const W = Lo.W, H = Lo.H, R = Lo.stickR, l = Lo.sl || 0, r = Lo.sr || 0, b = Lo.sb || 0, T = Lo.safeTop + 8, B = 46, land = !!Lo.land;
    const q = (s) => root.querySelector(s), vis = (e) => !!e && e.offsetWidth > 0;
    const cand = [A.shb, A.shm, A.rkb, A.rkn, A.dtb, ...A.itemList]; for (const e of [...cand, A.tray]) e.classList.remove('hudoff'); const arcEls = cand.filter(vis);
    const key = [W, H, R, l, r, b, T, Lo.moveHint.x, !!A.trayOpen, this.input.leftHanded, A.take.classList.contains('on'), A.dive.classList.contains('on'), A.bunk.classList.contains('on'), A.rv.classList.contains('on'), A.gvb.offsetWidth, A.shop ? A.shop.offsetWidth : 0, vis(A.take) ? A.take.offsetWidth : 0, ...arcEls.map(e => e.dataset.g)].join(',');
    if (A.last.hudKey === key && A.last.hudLo === Lo) { for (const e of A.last.hudOff || []) e.classList.add('hudoff'); return; } A.last.hudKey = key; A.last.hudLo = Lo;
    const put = (el, x, y, w, h) => { if (!el) return; const s = el.style; s.setProperty('left', Math.round(x) + 'px', 'important'); s.setProperty('top', Math.round(y) + 'px', 'important'); s.setProperty('right', 'auto', 'important'); s.setProperty('bottom', 'auto', 'important'); s.setProperty('margin', '0', 'important'); if (w) { s.setProperty('width', w + 'px', 'important'); s.setProperty('min-width', w + 'px', 'important'); } if (h) { s.setProperty('height', h + 'px', 'important'); s.setProperty('min-height', h + 'px', 'important'); } };
    const occ = [], hit = (x, y, w, h, m, dom) => occ.some(o => (!dom || !o.c) && (o.r ? Math.hypot(Math.max(x - o.cx, 0, o.cx - x - w), Math.max(y - o.cy, 0, o.cy - y - h)) < o.r + m : x < o.x + o.w + m && x + w + m > o.x && y < o.y + o.h + m && y + h + m > o.y)), add = (x, y, w, h, c) => occ.push({ x, y, w, h, c });
    // top row (right): pause, camera
    const px = W - r - 8 - B; put(q('[data-g=pause]'), px, T, B, B); add(px, T, B, B); const cam = q('.cambtn'); put(cam, px - B - 8, T, B, B); add(px - B - 8, T, B, B);
    add(l, Lo.safeTop, px - B - 16 - l, 44, 1); // top chips + score bar
    { const bw = Lo.hpW || Math.min(220, W * 0.5), hy = (Lo.hudBottom || H - 8) - 30; add(W / 2 - bw / 2 - 40, hy - 22, bw + 46, 48, 1); } // HP bar (+ oxygen/beacon line above)
    // r30 zones: top-left ⚙ ⟲ 💬 group · top-right pause/cam, minimap, cargo (+🛒) · right: ≤4 quick slots in an arc at the fire button + 🎒 tray · left: move stick + context buttons. Nothing in the central box (middle third × middle third).
    const cX0 = W / 3, cX1 = 2 * W / 3, cY0 = H / 3, cY1 = 2 * H / 3, inC = (x, y, w, h) => x < cX1 && x + w > cX0 && y < cY1 && y + h > cY0; Lo.centre = { x: cX0, y: cY0, w: cX1 - cX0, h: cY1 - cY0 };
    const ms = land ? 84 : 96, mx = W - r - 8 - ms, my = T + B + 8; Lo.mm = { x: mx, y: my, s: ms }; add(mx, my, ms, ms, 1);
    const gw = Math.max(B, A.gvb.offsetWidth || B), gy = land ? my : my + ms + 8, gx = land ? mx - 8 - gw : W - r - 8 - gw; put(A.gvb, gx, gy, 0, B); add(gx, gy, gw, B);
    const mst = q('.mshopt'); if (A.shop) { A.shop.classList.add('mcompact'); if (mst) { mst.classList.remove('hudoff'); put(mst, gx - 8 - B, gy, B, B); add(gx - 8 - B, gy, B, B); } A.shop.style.setProperty('transform', 'none', 'important'); A.shop.style.setProperty('flex-wrap', 'wrap'); A.shop.style.setProperty('max-width', Math.min(260, W - 2 * r - 20) + 'px'); A.shop.style.setProperty('left', 'auto', 'important'); A.shop.style.setProperty('right', (r + 8) + 'px', 'important'); A.shop.style.setProperty('top', ((land ? my + ms : gy + B) + 8) + 'px', 'important'); A.shop.style.setProperty('bottom', 'auto', 'important'); }
    // top-left row under the kills/lives chips: settings, orientation, quick chat, weapon group
    const lx = l + 10, ly = T + 92; put(q('.setbtn'), lx, ly, B, B); put(q('.oribtn'), lx + B + 8, ly, B, B); put(A.qcb, lx + 2 * (B + 8), ly, B, B); const fw = Math.max(B, A.fgb.offsetWidth || B); put(A.fgb, lx + 3 * (B + 8), ly, 0, B);
    add(l, Lo.safeTop, 172, ly - Lo.safeTop); const rowEnd = lx + 3 * (B + 8) + fw; add(lx, ly, rowEnd - lx, B); Lo.leftCol = lx; Lo.noteTop = ly + B + 8; /* r33: chat log under the settings row, top-left, in both orientations */ Lo.modTop = Lo.noteTop + 76;
    add(Lo.leftCol, Lo.noteTop, Math.min(W * 0.4, 230, (land ? (A.shop ? gx - 8 - B : gx) - 8 - Lo.leftCol : W)), 4 * 17, 1); Lo.noteW = Math.min(W * 0.4, 230, land ? (A.shop ? gx - 8 - B : gx) - 8 - Lo.leftCol : W); // notes / MOBA hint column (canvas)
    Lo.bannerY = land ? Lo.noteTop + 4 * 17 + 30 : Math.max(gy + B, Lo.noteTop + 4 * 17) + 34; Lo.bannerW = W - 24;
    // sticks + weapon chip above the fire stick
    const mv = Lo.moveHint, am = Lo.aimHint; occ.push({ x: mv.x - R, y: mv.y - R, w: 2 * R, h: 2 * R, r: R, cx: mv.x, cy: mv.y }, { x: am.x - R, y: am.y - R, w: 2 * R, h: 2 * R, r: R, cx: am.x, cy: am.y }); // sticks are round
    const left = this.input.leftHanded, sideOK = (x, w) => left ? x + w <= W / 2 : x >= W / 2;
    // context buttons (take / dive / bunker / revive) stack above the move stick, outside the centre box
    { const ctx = [A.take, A.dive, A.bunk, A.rv], von = (e) => e.classList.contains('on'); let y0 = mv.y - R - 10 - B; for (const el of ctx) { const wMax = Math.max(110, Math.min(W / 2 - 16, (land ? cX0 : W / 2) - l - 16)), w = el === A.take ? Math.min(wMax, 190) : Math.min(wMax, Math.max(110, el.offsetWidth || 120)); /* r35: compact take button */ el.style.setProperty('max-width', wMax + 'px', 'important'); el.style.setProperty('transform', 'none', 'important'); let x = left ? W - r - 6 - w : l + 6, y = y0; for (let k = 0; k < 12 && (hit(x, y, w, B, 4) || inC(x, y, w, B)); k++) y -= B + 6; if (y < (Lo.safeTop || 0) + 6) { /* r33: short screens — fall back to the bottom edge beside the move stick */ x = left ? mv.x - R - 12 - w : mv.x + R + 12; y = H - B - 8 - 0; for (let k = 0; k < 6 && (hit(x, y, w, B, 4)); k++) y -= B + 6; y = Math.max((Lo.safeTop || 0) + 6, y); } put(el, x, y, el === A.take ? w : 0, B); if (von(el)) { add(x, y, w, B); y0 = y - B - 6; } } }
    // quick slots: shell, rocket, pack rocket, medkit, first other perk — max 4, then the tray button
    const IT = [...A.itemList], byK = (k) => IT.find(e => e.dataset.g === k), pri = ['htw', 'molotov', 'hrocket', 'med', 'drone', 'invis', 'smoke', 'mine', 'sentry', 'ldrone', 'twinr', 'twintrap', 'beacon', 'blocks', 'revive'];
    const quick = [A.shb, A.rkb, ...pri.map(byK)].filter(vis).slice(0, 4), trayEls = cand.filter(e => vis(e) && !quick.includes(e)), tb = A.tray; tb.lastChild.textContent = trayEls.length ? String(trayEls.length) : ''; tb.classList.toggle('hudoff', !trayEls.length); tb.classList.toggle('on', !!A.trayOpen);
    const arc = trayEls.length ? [quick[0], tb, ...quick.slice(1)].filter(Boolean) : quick, sz = B, ax = am.x, ay = am.y;
    // tidy concentric arc: ring 1 hugs the fire stick (angles from the upper-left diagonal outwards), ring 2 only if ring 1 is full
    const off = [], sgn = left ? -1 : 1, slots = []; const a0 = Math.PI * 0.86, a1 = Math.PI * 1.62; for (let k = 0; k < 3; k++) { const rr = R + 8 + 27 + k * 54, n = Math.max(2, Math.floor(rr * (a1 - a0) / 52) + 1), A0 = []; for (let i = 0; i < n; i++) A0.push(a0 + (i / (n - 1)) * (a1 - a0)); A0.sort((p, q) => Math.abs(p - 1.25 * Math.PI) - Math.abs(q - 1.25 * Math.PI)); for (const t of A0) slots.push([ax + sgn * Math.cos(t) * rr, ay + Math.sin(t) * rr]); }
    let cTop = ay - R, cL = ax - R, cR = ax + R; for (const el of arc) { const s = el === A.shb ? 54 : sz; const c = slots.find(([cx, cy]) => { const x = cx - s / 2, y = cy - s / 2; return x >= l + 4 && y >= T && x + s <= W - r - 4 && y + s <= H - b - 4 && !hit(x, y, s, s, 4) && !inC(x, y, s, s); }); if (!c) { if (el !== tb && trayEls.length) { trayEls.push(el); tb.lastChild.textContent = String(trayEls.length); } else off.push(el); continue; } const x = c[0] - s / 2, y = c[1] - s / 2; put(el, x, y, s, s); add(x, y, s, s); cTop = Math.min(cTop, y); cL = Math.min(cL, x); cR = Math.max(cR, x + s); }
    // weapon chip (canvas) goes above the arc, or beside it if that is taken
    { const cw = 172, tx = Math.max(l + cw / 2 + 4, Math.min(W - r - cw / 2 - 4, (cL + cR) / 2)), ty = cTop - 34, C = []; for (let y = T + 12; y <= H - b - 34; y += 6) for (let x = l + cw / 2 + 4; x <= W - r - cw / 2 - 4; x += 6) C.push([Math.hypot(x - tx, (y - ty) * 1.5), x, y]); C.sort((p, q) => p[0] - q[0]); const f = C.find(([, x, y]) => !hit(x - cw / 2, y - 12, cw, 44, 2) && !inC(x - cw / 2, y - 12, cw, 44)), c = f ? [f[1], f[2]] : [tx, ty]; Lo.chip = { x: c[0], y: c[1] }; add(c[0] - cw / 2, c[1] - 12, cw, 44, 1); }
    // tray: ONE popup panel docked to the fire-side edge (between the top-right block and the fire stick), a neat grid that scrolls if needed; closes after use or a tap outside
    const tp = A.tp; for (const e of cand) e.classList.remove('intray');
    if (A.trayOpen && trayEls.length) { const top = Math.max(T + B + 8, land ? T + B + 8 : gy + B + 8), bot = am.y - R - 8, avail = Math.max(2 * B, bot - top), edge = left ? l + 6 : W - r - 6, maxCols = Math.max(1, Math.floor(((left ? cX0 - edge : edge - cX1) - 12) / 50)), rows = Math.max(1, Math.floor((avail - 12) / 50)), cols = Math.min(maxCols, Math.ceil(trayEls.length / rows), 4), pw = cols * 50 + 10;
      tp.style.setProperty('display', 'grid', 'important'); tp.style.setProperty('transform', 'none', 'important'); tp.style.setProperty('grid-template-columns', 'repeat(' + cols + ', 46px)', 'important'); tp.style.setProperty('max-height', Math.round(avail) + 'px', 'important'); tp.style.setProperty('width', pw + 'px', 'important'); put(tp, left ? edge : edge - pw, top, 0, 0); tp.style.setProperty('height', 'auto', 'important'); tp.style.setProperty('min-height', '0', 'important');
      for (const el of trayEls) { if (el.parentElement !== tp) tp.appendChild(el); const st = el.style; for (const k of ['left', 'top', 'right', 'bottom']) st.setProperty(k, 'auto', 'important'); st.setProperty('position', 'relative', 'important'); st.setProperty('width', '46px', 'important'); st.setProperty('height', '46px', 'important'); st.setProperty('min-width', '46px', 'important'); st.setProperty('min-height', '46px', 'important'); el.classList.add('intray'); } }
    else { tp.style.setProperty('display', 'none', 'important'); off.push(...trayEls); }
    for (const el of [...tp.children]) if (!(A.trayOpen && trayEls.includes(el))) { (el.classList.contains('abtn') ? A.items : root).appendChild(el); el.classList.remove('intray'); }
    A.last.hudOff = off; for (const e of off) e.classList.add('hudoff');
    const it = A.items.style; it.setProperty('position', 'absolute', 'important'); it.setProperty('left', '0', 'important'); it.setProperty('top', '0', 'important'); it.setProperty('right', 'auto', 'important'); it.setProperty('bottom', 'auto', 'important'); it.setProperty('width', '0', 'important'); it.setProperty('height', '0', 'important'); it.setProperty('transform', 'none', 'important');
    for (const e of A.itemList) if (!e.classList.contains('intray')) e.style.setProperty('position', 'absolute', 'important');
    for (const e of [A.shm, A.rkn, A.dtb]) if (e.parentElement === root) e.style.setProperty('position', 'absolute', 'important');
    this.hudOcc = occ;
  }

  updateActs(view, me) {
    const A = this.actEls; if (!A) return; const L = A.last; this.placeHud();
    let near = null; if (me && me.alive) { let bd = 18 * 18; for (const p of view.pickups) { const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2; if (d < bd) { bd = d; near = p; } } }
    const full = near && near.type === 'hrocket' && me.hrockets > 0;
    const label = near ? (near.type === 'wreck' ? 'Взять всё · ' + (near.items ? near.items.length : 0) : this.pickupName(near) + (full ? ' — Полный запас' : '')) : '';
    { const its = near && near.type === 'wreck' && near.items || null, key = its ? near.id + ':' + its.map(o => o.type + o.n).join(',') : ''; if (L.wl !== key) { L.wl = key; const box = A.wl; while (box.firstChild) box.removeChild(box.firstChild); box.style.display = its && its.length ? 'flex' : 'none';
      if (its) { box.appendChild(h('b', null, 'Трофеи' + (near.owner ? ' · ' + near.owner : ''))); its.forEach((o, i) => box.appendChild(h('button', { data: { g: 'takei_' + i } }, this.pickupName({ type: o.type, wid: o.wid, tier: o.tier }) + (o.n > 1 ? ' ×' + o.n : '')))); } } }
    if (L.take !== label) { L.take = label; A.take.classList.toggle('on', !!near); A.take.classList.toggle('full', !!full); A.take.lastChild.textContent = label; if (near) A.take.style.borderColor = (TIERS[(near.tier || 1) - 1] || TIERS[0]).color; }
    // pack rockets: usable only while an enemy is inside the lock radius
    let lk = null; if (me && me.alive && me.hrockets) { let bd = HROCKET_LOCK * HROCKET_LOCK; for (const o of view.tanks) { if (!o.alive || o.team === me.team || (o.inBush && !(o.rev || (o.revT > 0 && o.revTeam === me.team)))) continue; const d2 = (o.x - me.x) ** 2 + (o.y - me.y) ** 2; if (d2 < bd) { bd = d2; lk = o; } } }
    this.hrLock = lk ? lk.id : 0;
    if (A.shop) { let on = false; const q = me && me.alive && view.towers && view.towers.find(T => T.hq && T.team === me.team); if (q) on = (q.x - me.x) ** 2 + (q.y - me.y) ** 2 < 130 * 130; if (L.shop !== on) { L.shop = on; A.shop.style.display = on ? 'flex' : 'none'; } }
    if (A.bunk) { const v = this.session.view, M = v.map, can = !!(me && me.alive && v.under && M.get(Math.floor(me.x / 8), Math.floor(me.y / 8)) === 10), lab = me && me.layer ? 'Подняться' : 'Спуститься'; if (L.bunk !== can + lab) { L.bunk = can + lab; A.bunk.classList.toggle('on', can); A.bunk.textContent = lab; } }
    { const can = !!(me && me.alive && (me.sub || me.terr === 2)), lab = me && me.sub ? 'Всплыть · ' + Math.ceil(me.oxy ?? 30) + 'с' : 'Погрузиться'; if (L.dive !== can + lab) { L.dive = can + lab; A.dive.classList.toggle('on', can); A.dive.classList.toggle('up', !!(me && me.sub)); A.dive.textContent = lab; } }
    // r16 revive / give / fire group
    { let rw = null; if (me && me.alive && me.revives > 0 && view.wrecks) for (const k of view.wrecks) if (k.tid && k.team === me.team && this.isAllyMode(view) && (k.x - me.x) ** 2 + (k.y - me.y) ** 2 < 24 * 24) { rw = k; break; }
      const lab = me && me.rvg ? 'Ремонт ' + Math.round(((me.rvg && me.rvg.p) || 0) / 12 * 100) + '% · отмена' : 'Воскресить'; const on = !!(rw || (me && me.rvg)); if (L.rv !== on + lab) { L.rv = on + lab; A.rv.classList.toggle('on', on); A.rv.textContent = lab; } }
    { let al = null; if (me && me.alive && this.isAllyMode(view)) { let bd = 34 * 34; for (const o of view.tanks) { if (o === me || !o.alive || o.team !== me.team) continue; const d = (o.x - me.x) ** 2 + (o.y - me.y) ** 2; if (d < bd) { bd = d; al = o; } } }
      const inv = me ? [['weapon', me.weapon && me.weapon !== 'cannon' ? 1 : 0, 'Оружие'], ['ammo', me.shells || (me.ammo != null && me.weapon !== 'cannon' ? me.ammo : 0), 'Патроны'], ['armor', me.armorT ? 1 : 0, 'Броня'], ['med', me.meds, 'Аптечка'], ['hrocket', me.hrockets, 'Ракеты'],
        ['rkt', me.rkA && me.rkT ? me.rkA[me.rkT] || 0 : 0, me.rkT && ROCKETS[me.rkT] ? ROCKETS[me.rkT].name + ' — ' + ammoInfo(ROCKETS[me.rkT], true) : 'Ракеты'], ['shl', me.shA && me.shT ? me.shA[me.shT] || 0 : 0, me.shT && SHELLS[me.shT] ? SHELLS[me.shT].name + ' — ' + ammoInfo(SHELLS[me.shT]) : 'Снаряды'], ['smoke', me.smokes, 'Дым'], ['mine', me.mines, 'Мина'], ['radar', me.radar, 'Радар'], ['beacon', me.beacons, 'Маяк'], ['revive', me.revives, 'Ремкомплект воскр.'],
        ...Object.entries(MODS).filter(([, M]) => (me.mods || 0) & M.bit).map(([k, M]) => [k, 1, M.short || M.name])].filter(x => x[1] > 0) : [];
      // r19: weight indicator (also the inventory button) — available in every mode except classic
      const wt = me ? weightOf(me) : 0, lk = me ? loadK(me) : 0, ally = this.isAllyMode(view), showInv = !!(me && me.alive && view.mode !== 'classic');
      const gk = (al ? al.id : 0) + ':' + ((me && me.mounts) || []).map(m => m.w + m.ammo).join('/') + ':' + inv.map(x => x[0] + x[1]).join(',') + ':' + Math.round(wt); A.gvb.style.display = showInv ? '' : 'none'; A.gvb.classList.toggle('on', !!al); A.gvb.classList.toggle('heavy', lk > 0.5);
      if (L.gpk !== gk) { L.gpk = gk; const lab = al ? 'Передать' : 'Груз'; while (A.gvb.firstChild) A.gvb.removeChild(A.gvb.firstChild); A.gvb.appendChild(h('span', null, lab)); A.gvb.appendChild(h('small', { class: 'wt' }, ' ' + Math.round(wt) + '/' + W_MAX));
        const P = A.gp; while (P.firstChild) P.removeChild(P.firstChild); P.appendChild(h('b', null, al ? 'Передать: ' + al.name : 'Инвентарь'));
        P.appendChild(h('div', { class: 'wbar' }, h('i', { style: 'width:' + Math.round(Math.min(1, wt / W_MAX) * 100) + '%;background:' + (lk > 0.5 ? '#e85a4a' : lk > 0 ? '#ffc23d' : '#7ee07a') })));
        P.appendChild(h('small', { class: 'whint' }, lk > 0 ? 'Перегруз: −' + Math.round(lk * 30) + '% скорость' : 'Выбросьте лишнее — танк станет быстрее и точнее'));
        for (const [k, n, nm] of inv) { const amt = k === 'ammo' ? Math.min(n, 15) : k === 'rkt' || k === 'shl' || k === 'mine' || k === 'smoke' || k === 'med' ? n : 1; const row = h('div', { class: 'gprow' }, h('span', null, nm + (n > 1 ? ' ×' + n : '')));
          if (al && !k.startsWith('mod_') && k !== 'rkt' && k !== 'shl') { row.appendChild(h('button', { data: { g: 'give_' + k + '_' + amt } }, k === 'ammo' ? 'Дать ' + amt : 'Дать')); if (k === 'ammo' && n > amt) row.appendChild(h('button', { data: { g: 'give_ammo_' + n } }, 'Всё')); }
          if (k === 'weapon' && view.mode !== 'classic') row.appendChild(h('button', { class: 'mnt', data: { g: 'mountw' } }, 'Установить')); row.appendChild(h('button', { class: 'drop', data: { g: k.startsWith('mod_') ? 'drop_mod_' + k.slice(4) : 'drop_' + k + '_' + amt } }, 'Выбросить')); P.appendChild(row); }
        (me && me.mounts || []).forEach((m, i) => { if (!m.floor) return; P.appendChild(h('div', { class: 'gprow' }, h('span', null, 'Доп. орудие: ' + (m.mgi != null ? MGS[m.mgi].name + (m.auto ? ' · авто' : '') : (WEAPONS[m.w] || {}).name || m.w) + ' · ' + m.ammo), h('button', { class: 'drop', data: { g: 'unmount_' + i } }, 'Снять'))); });
        if (!inv.length) P.appendChild(h('small', { class: 'whint' }, 'Пусто')); void ally; } }
    { const i = me && me.alive && me.rkA && me.rkT ? me.rkT : 0, n = i ? me.rkA[i] : 0, key = i + ':' + n; if (L.rk !== key) { L.rk = key; A.rkb.style.display = A.rkn.style.display = n ? '' : 'none'; if (n) { A.rkb.title = ROCKETS[i].name + ' — ' + ammoInfo(ROCKETS[i], true); A.rkb.firstChild.textContent = ROCKETS[i].name.slice(0, 4); A.rkb.lastChild.textContent = '×' + n; A.rkb.style.borderColor = ROCKETS[i].col; } } }
    { const rm = !!(me && me.alive && view.mines && view.mines.some(m => m.owner === me.id && m.mk === 6)); if (L.det !== rm) { L.det = rm; A.dtb.style.display = rm ? '' : 'none'; } }
    { const has = !!(me && me.alive && me.shA), i = me && me.shT || 0, S = SHELLS[i], n = has ? (i ? me.shA[i] : '∞') : ''; A.shb.style.display = A.shm.style.display = has ? '' : 'none';
      if (has && L.sh !== i + ':' + n) { L.sh = i + ':' + n; A.shb.firstChild.textContent = S.short; A.shb.lastChild.textContent = n; A.shb.style.borderColor = S.col; A.shb.style.color = S.col; }
      const sk = has ? me.shA.join(',') + ':' + i : ''; if (L.shk !== sk) { L.shk = sk; const P = A.shp; while (P.firstChild) P.removeChild(P.firstChild); if (has) { P.appendChild(h('b', null, 'Снаряды')); SHELLS.forEach((s, j) => { if (j && !(me.shA[j] > 0)) return; const b = h('button', { data: { g: 'shell_' + j }, title: s.desc }, s.name + ' · ' + (j ? me.shA[j] : '∞'), h('small', { class: 'dinfo' }, ammoInfo(s))); b.style.borderColor = s.col; if (j === i) b.style.background = 'rgba(255,255,255,.18)'; P.appendChild(b); }); } } }
    { const has = !!(me && me.mounts && me.mounts.length), fg = me && me.fgrp || 0, lab = fg >= 3 ? ((me.mounts[fg - 3] || {}).mgi != null ? MGS[me.mounts[fg - 3].mgi].name : (WEAPONS[(me.mounts[fg - 3] || {}).w] || {}).name || 'ДОП') : ['ВСЕ', 'ОСН', 'ДОП'][fg]; A.fgb.style.display = has ? '' : 'none'; if (has && L.fg !== lab) { L.fg = lab; A.fgb.textContent = lab; } }
    if (A.htp) { const on = !!(me && me.alive && me.isTarget && me.hk), hk = on ? JSON.stringify(me.hk) : ''; if (L.htk !== hk) { L.htk = hk; for (const b of A.htp.querySelectorAll('.htb')) { const n = on ? me.hk[b.dataset.g.slice(3)] || 0 : 0; b.lastChild.textContent = n; b.classList.toggle('empty', !n); } } if (!on) A.htp.classList.remove('on'); }
    for (const b of A.itemList) { const k = b.dataset.g, n = me ? (k === 'twinr' || k === 'twintrap' ? me.twinN || 0 : k === 'invis' ? me.invisN || 0 : k === 'drone' ? me.dronesN || 0 : k === 'ldrone' ? me.ldronesN || 0 : k === 'molotov' ? me.molotovN || 0 : k === 'htw' ? (me.isTarget && me.hk ? Object.values(me.hk).reduce((x, y) => x + y, 0) : 0) : k === 'sentry' ? me.sentryN || 0 : k === 'blocks' ? me.blocksN || 0 : me[k + 's'] ?? me[k] ?? 0) : 0, key = k + n + (k === 'hrocket' ? (lk ? 'L' : 'N') : '');
      if (k === 'hrocket' && L[k] !== key) { L[k] = key; b.lastChild.textContent = '🚀 ' + n; b.classList.toggle('empty', !lk); b.classList.toggle('lock', !!lk); b.style.display = n ? '' : 'none'; continue; } if (L[k] !== key) { L[k] = key; b.lastChild.textContent = n; b.classList.toggle('empty', !n); b.style.display = n ? '' : 'none'; } }
  }
  isAllyMode(view) { const m = view.mode || this.session.mode; return m !== 'classic' && !view.ffa && this.session.variant !== 'ffa' && (m !== 'br' || (view.squad || this.session.squad || 1) > 1); }
  pickupName(p) {
    const tier = TIERS[(p.tier || 1) - 1] || TIERS[0];
    if (p.type === 'lx') { const L = LOOTX[p.lid]; return L ? (L.cat === 'wvar' ? 'Оружие: ' + L.name.split(' · ')[0] + ' ' + ((WEAPONS[L.name.split(' · ')[1]] || {}).name || '') : L.cat === 'shell' ? L.name + ' — ' + ammoInfo(SHELLS[L.i]) : L.cat === 'rocket' ? L.name + ' — ' + ammoInfo(ROCKETS[L.i], true) : L.info ? L.name + ' — ' + L.info : L.fx ? L.name + ' — ' + fxText(L.fx) : L.name) : 'Добыча'; }
    if (p.type === 'weapon') return (WEAPONS[p.wid] || WEAPONS.cannon).name + ' · ' + tier.name;
    if (p.type === 'armor') return ARMOR_NAMES[(p.tier || 1) - 1] + (p.ak ? ' · ' + ARMOR_KINDS[p.ak].name : '');
    return (PICKUPS[p.type] || {}).name || p.type;
  }
  endOverlay() { if (this.specEls) this.specEnd(); if (this.gameEl) { this.gameEl.remove(); this.gameEl = null; } clearInterval(this.spectIv); }
  closeModals() { for (const o of this.wrap.querySelectorAll('.ov')) { if (o.close) o.close(); else o.remove(); } this.pauseOv = null; }
  pause() {
    const s = this.session; if (!s || this.pauseOv) return; if (s.canPause) s.paused = true; this.input.reset();
    this.pauseOv = this.ui.pauseMenu({ restart: s.canPause && !s.online, shop: true, on: (a) => {
      if (a === 'arsenal') { this.pauseOv = null; this.ui.matchArsenal(s, () => { s.paused = false; }); return; }
      this.pauseOv = null; s.paused = false;
      if (a === 'restart') this.startLocal(s.variant || s.mode);
      if (a === 'quit') this.quitToMenu();
    } });
  }
  quitToMenu() {
    const s = this.session; if (s && s.online && s.leave) s.leave();
    this.ui.fade(() => { this.closeModals(); this.state = 'menu'; if (this.gls && this.gls.ok) this.gls.cv.style.display = 'none'; this.camRot = null; if (this.session) this.session.destroy(); this.session = null; this.endOverlay(); this.computeLayout(); this.renderer.setMap(this.attract.map, 'team'); this.ui.menu(); });
  }
  onKey(k) {
    if (this.state === 'game') { const m = { KeyE: 'take', KeyQ: 'med', Digit1: 'med', KeyF: 'smoke', Digit2: 'smoke', KeyG: 'mine', Digit7: 'drone', Digit8: 'ldrone', Digit9: 'twinr', Digit0: 'twintrap', KeyI: 'invis', Digit3: 'mine', KeyR: 'hrocket', Digit4: 'hrocket', KeyB: 'beacon', KeyT: 'sentry', KeyY: 'blocks', Digit5: 'beacon', KeyZ: 'dive', KeyH: 'bunker', KeyV: 'revive', KeyX: 'fgrp', KeyN: 'shell', KeyK: 'rkt', KeyL: 'rk_next', KeyJ: 'det' }[k]; if (m) this.doAct(m); if (k === 'KeyT') { const b = this.wrap.querySelector('.qcbtn'); if (b) b.click(); } if (k === 'KeyY') { const b = this.wrap.querySelector('.givebtn'); if (b) b.click(); } if (k === 'KeyC') { const b = this.wrap.querySelector('.cambtn'); if (b) b.click(); } }
    if (k === 'Escape' || k === 'KeyP') { if (this.state === 'game' && !this.overShown) { if (this.pauseOv) { this.pauseOv.close(); this.pauseOv = null; if (this.session) this.session.paused = false; } else this.pause(); } }
  }

  // ---------- per-frame ----------
  loop(ts) {
    { const gm = this.state === 'game'; if (this._orG !== gm) { this._orG = gm; this._orK = null; try { this.resize(); } catch (e) {} } }
    this.raf = requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000)); this.last = ts; // r29: slow devices keep real-time speed (≤6 sim steps per frame)
    try { if (this.state === 'game' && this.session) this.gameFrame(dt); else this.menuFrame(dt); } catch (e) { console.error(e); if (!this._errShown) { this._errShown = true; } }
  }
  menuFrame(dt) {
    const w = this.attract; this.attractAcc += dt; let n = 0; while (this.attractAcc >= STEP && n < 4) { w.step(STEP); this.attractAcc -= STEP; n++; this.handleEvents(w.events, w, null, true); }
    let f = w.byId.get(this.attractFollow); if (!f || !f.alive) { const alive = w.tanks.filter(t => t.alive); if (alive.length) { f = alive[(Math.random() * alive.length) | 0]; this.attractFollow = f.id; } }
    this.renderer.stepFx(dt);
    const L = { ...this.layout, vp: { x: 0, y: 0, w: this.W, h: this.H }, zoom: Math.max(1, Math.min(this.W, this.H) / 300) };
    this.renderer.frame(w, -1, { viewport: L.vp, zoom: L.zoom, dt, spectate: this.attractFollow });
  }
  composeInput(view, me) {
    const raw = this.input.read(); if (this.camRot != null) { const c = Math.cos(this.camRot), s = Math.sin(this.camRot), r = (x, y) => [x * c - y * s, x * s + y * c]; [raw.mx, raw.my] = r(raw.mx, raw.my); if (raw.aim) [raw.ax, raw.ay] = r(raw.ax, raw.ay); }
    const inp = { mx: raw.mx, my: raw.my, ax: 0, ay: 0, aim: false, fire: false };
    if (!me || !me.alive) { inp.an = this.actN || 0; inp.act = this.actK || null; return inp; }
    const L = this.layout, cam = this.renderer.cam;
    if (raw.mouse.used && raw.mouse.inside && !this.input.sticks.aim) {
      const sx = L.vp.x + L.vp.w / 2 + (me.x - cam.x) * cam.z, sy = L.vp.y + L.vp.h / 2 + (me.y - cam.y) * cam.z;
      const dx = raw.mouse.x - sx, dy = raw.mouse.y - sy; if (Math.hypot(dx, dy) > 6) { inp.aim = true; inp.ax = dx; inp.ay = dy; }
      inp.fire = raw.mouse.down;
    }
    if (raw.aim) { inp.aim = true; inp.ax = raw.ax; inp.ay = raw.ay; inp.fire = true; { let lv = this.meta.d.settings.aimAssist; lv = lv === true ? 2 : lv === false ? 0 : (lv | 0); if (this.session && this.session.online) lv = Math.min(lv, 1); /* online PvP: capped at «Слабая» for fairness */ if (lv) this.assist(view, me, inp, lv); else this.assistT = 0; } }
    if (this.input.tapShots > 0) { this.input.tapShots = 0; this.tapPending = 0.35; }
    if (this.tapPending > 0 || raw.auto) {
      const tg = this.autoTarget(view, me);
      if (tg) { inp.aim = true; inp.ax = tg.x - me.x; inp.ay = tg.y - me.y; } else if (!inp.aim) { inp.aim = true; inp.ax = Math.cos(me.ta); inp.ay = Math.sin(me.ta); }
      inp.fire = true;
      if (me.cd <= 0.02 && this.tapPending > 0) this.tapPending = 0.0001;
    }
    if (raw.fire && !inp.fire && !raw.mouse.used) inp.fire = true;
    inp.an = this.actN || 0; inp.act = this.actK || null;
    return inp;
  }
  layerView(view, me) { // r15 bunkers: draw only the layer the player is on
    if (!view.under) return view; const L = me ? me.layer | 0 : 0, f = (a) => a ? a.filter(o => (o.layer | 0) === L) : a, lv = Object.create(view);
    lv.map = L ? view.under : view.map; lv.tanks = f(view.tanks); lv.pickups = f(view.pickups); lv.bullets = f(view.bullets); lv.mines = f(view.mines); lv.wrecks = view.wrecks && view.wrecks.filter(w => w.layer == null || (w.layer | 0) === L); if (L) { lv.towers = null; lv.flags = null; } lv.underground = L; return lv; }
  autoTarget(view, me) {
    let best = null, bs = 1e9; const range = view.mode === 'classic' ? 300 : 240;
    for (const t of view.tanks) {
      if (!t.alive || t.team === me.team || t.spawnT > 0 || (t.layer | 0) !== (me.layer | 0)) continue; const dx = t.x - me.x, dy = t.y - me.y, d = Math.hypot(dx, dy); if (d > range) continue;
      if (t.inBush && d > (t.seeR || 48) && !(t.rev || (t.revT > 0 && me && t.revTeam === me.team))) continue;
      const ang = Math.abs(angD(me.ta, Math.atan2(dy, dx))); const score = d * (1 + ang * 0.8) * (view.map.los(me.x, me.y, t.x, t.y) ? 1 : 2.5);
      if (score < bs) { bs = score; best = t; }
    }
    if (best) { const w = WEAPONS[me.weapon] || WEAPONS.cannon, lead = Math.hypot(best.x - me.x, best.y - me.y) / w.speed; return { x: best.x + (best.vx || 0) * lead * 0.8, y: best.y + (best.vy || 0) * lead * 0.8 }; }
    return null;
  }
  // aim assist «помощь в стрельбе»: levels 1 Слабая / 2 Средняя / 3 Сильная. Only visible enemies (never allies, not in bushes/smoke, line of sight) inside a cone.
  assist(view, me, inp, lv) {
    const P = AIM_ASSIST[lv] || AIM_ASSIST[2]; const a = Math.atan2(inp.ay, inp.ax); let best = null, bd = P.cone;
    for (const t of view.tanks) { if (!t.alive || t.team === me.team || t.inBush || t.spawnT > 0) continue; const d = Math.hypot(t.x - me.x, t.y - me.y); if (d > P.range) continue; if (view.map && view.map.los && !view.map.los(me.x, me.y, t.x, t.y)) continue; const da = Math.abs(angD(a, Math.atan2(t.y - me.y, t.x - me.x))); if (da < bd) { bd = da; best = t; } }
    this.assistT = best ? best.id : 0; if (!best) return;
    const w = WEAPONS[me.weapon] || WEAPONS.cannon, d = Math.hypot(best.x - me.x, best.y - me.y), lead = w.beam ? 0 : d / (w.speed || 300) * P.lead;
    const ta = Math.atan2(best.y + (best.vy || 0) * lead - me.y, best.x + (best.vx || 0) * lead - me.x), na = a + angD(a, ta) * P.pull; inp.ax = Math.cos(na); inp.ay = Math.sin(na);
  }
  drawMarkers(g, view, cam, L) {
    const sc = (x, y) => [L.vp.x + L.vp.w / 2 + (x - cam.x) * cam.z, L.vp.y + L.vp.h / 2 + (y - cam.y) * cam.z], tm = performance.now() / 1000;
    const at = this.assistT && view.tanks.find(t => t.id === this.assistT);
    if (at && at.alive) { const [x, y] = sc(at.x, at.y), r = 13 * cam.z; g.save(); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.5; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(x, y, r, a - 0.3, a + 0.3); g.stroke(); } g.restore(); }
    const lt = this.hrLock && view.tanks.find(t => t.id === this.hrLock);
    if (lt && lt.alive) { const [x, y] = sc(lt.x, lt.y), r = (11 + Math.sin(tm * 8) * 1.5) * cam.z; g.save(); g.strokeStyle = '#ff4fa3'; g.lineWidth = 2; g.strokeRect(x - r, y - r, r * 2, r * 2); g.fillStyle = '#ff4fa3'; g.font = 'bold 11px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('ЗАХВАТ', x, y - r - 4); g.restore(); }
  }
  gameFrame(dt) {
    const s = this.session; let view = s.view; let me = view.tanks.find(t => t.id === s.meId);
    this.tapPending = Math.max(0, this.tapPending - dt);
    const inp = this.composeInput(view, me);
    if (s.p2) { this.input.split = true; const r2 = this.input.read2(), p2 = s.p2, i2 = { mx: r2.mx, my: r2.my, aim: r2.aim, ax: r2.ax, ay: r2.ay, fire: r2.fire };
      if (p2.alive && r2.auto && !r2.aim) { const tg = this.autoTarget(view, p2); if (tg) { i2.aim = true; i2.ax = tg.x - p2.x; i2.ay = tg.y - p2.y; } else { i2.aim = true; i2.ax = Math.cos(p2.ta); i2.ay = Math.sin(p2.ta); } i2.fire = true; }
      if (this.overShown || s.paused) { i2.mx = i2.my = 0; i2.fire = false; } s.inp2 = i2; } else this.input.split = false;
    if (this.overShown || (s.paused)) { inp.mx = inp.my = 0; inp.fire = false; }
    const evs = s.update(dt, inp);
    me = view.tanks.find(t => t.id === s.meId);
    this.handleEvents(evs, view, me, false);
    const view0 = view; view = this.layerView(view0, me);
    // countdown
    if (view.state === 'countdown') { const c = Math.ceil(view.countdown); if (c !== this.lastCount && c > 0) { this.lastCount = c; this.hud.banner(String(c), null, '#ffd23d', 0.9); this.audio.play('beep'); } }
    this.renderer.stepFx(dt); this.hud.step(dt); if (this.qAuto && autoQuality(this.renderer, dt)) this.resize();
    const L = this.layout;
    // r15 cameras: «Дрон» (top-down, zoom), «3-е лицо» (WebGL pseudo-3D chase cam). The first-person view was dropped.
    const S = this.meta.d.settings, R = this.renderer, cm = view.mode === 'classic' || s.p2 ? 0 : s.camLock >= 0 ? s.camLock : S.camera === 3 ? 1 : Math.min(2, S.camera ?? 0), live = me && me.alive; // r17: 0 Сверху (90° top-down), 1 3-е лицо (chase), 2 Дрон (tilted ~53°, north-up)
    const gls = this.gls, wantGL = gls.ok && (cm >= 1 || (S.post !== false && R.quality >= 0.6));
    if (live && cm === 1) { const tgt = me.a; if (this.camYaw == null) this.camYaw = tgt; let d = ((tgt - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; this.camYaw += d * Math.min(1, dt * 3.2); this.camRot = this.camYaw + Math.PI / 2; } else { this.camRot = null; if (!live) this.camYaw = null; }
    let fr; const dist = R.quality >= 0.95 ? 300 : R.quality >= 0.7 ? 240 : 190;
    try { this.audio.engine(live && !this.paused ? Math.min(1, Math.hypot(me.vx || 0, me.vy || 0) / Math.max(30, me.speed || 70)) : -1, me ? voiceOf(me).eng : null, 'me');
      // r25: nearest audible enemy engine (its own model voice), so tanks can be recognised by ear
      let ne = null, nd = 1e9; if (live && !this.paused) for (const o of view.tanks) if (o.alive && o.id !== me.id && !o.inBush) { const d = Math.hypot(o.x - me.x, o.y - me.y); if (d < nd) { nd = d; ne = o; } }
      if (ne && nd < 160) this.audio.engine(Math.min(1, Math.hypot(ne.vx || 0, ne.vy || 0) / Math.max(30, ne.speed || 70)), voiceOf(ne).eng, 'en', 0.55 * (1 - nd / 160)); else this.audio.engine(-1, null, 'en');
      { let dd = 1e9; if (live && !this.paused) for (const d of view.drones || []) dd = Math.min(dd, Math.hypot(d.x - me.x, d.y - me.y)); this.audio.rotor(dd < 220 ? 1 - dd / 220 : -1); } // r25: drone rotor hum
      // r25: reload clunk when our cannon is ready again
      if (me && this._rldW && (me.cd || 0) <= 0 && live) { this._rldW = 0; if (fam0(me.weapon)) this.audio.play('reload', 0.8); } } catch (_) {}
    R.mesh3d = !!(wantGL && gls.ok && (cm > 0 ? live : S.mesh3d !== false && R.quality >= 0.6)); // r21: the top view also uses the real 3D meshes
    if (cm === 1 && live) { const zz = Math.min(L.vp.w, L.vp.h) / (dist * 1.25); fr = R.frame(view, s.meId, { viewport: L.vp, zoom: zz, dt, spectate: this.spectate, center: [me.x + Math.cos(this.camYaw) * dist * 0.45, me.y + Math.sin(this.camYaw) * dist * 0.45] });
      if (!wantGL) { const t = this._rot || (this._rot = document.createElement('canvas')); if (t.width !== R.cv.width || t.height !== R.cv.height) { t.width = R.cv.width; t.height = R.cv.height; } const tg = t.getContext('2d'); tg.clearRect(0, 0, t.width, t.height); tg.drawImage(R.cv, 0, 0);
        const g0 = R.ctx, cx = (L.vp.x + L.vp.w / 2 + (me.x - fr.cam.x) * fr.cam.z) * R.dpr, cy = (L.vp.y + L.vp.h / 2 + (me.y - fr.cam.y) * fr.cam.z) * R.dpr; g0.setTransform(1, 0, 0, 1, 0, 0); g0.fillStyle = '#0d0f0b'; g0.fillRect(0, 0, t.width, t.height);
        g0.translate((L.vp.x + L.vp.w / 2) * R.dpr, (L.vp.y + L.vp.h * 0.68) * R.dpr); g0.rotate(-this.camRot); g0.scale(1.6, 1.6); g0.drawImage(t, -cx, -cy); g0.setTransform(1, 0, 0, 1, 0, 0); } }
    else if (cm === 2 && live && wantGL) fr = R.frame(view, s.meId, { viewport: L.vp, zoom: Math.min(L.vp.w, L.vp.h) / (dist * 1.25), dt, spectate: this.spectate, center: [me.x, me.y - dist * 0.25] });
    else fr = R.frame(view, s.meId, { viewport: L.vp, zoom: L.zoom * (S.zoom || 1) * (this.specZoom || 1), dt, spectate: this.spectate, p2: s.p2, center: this.specCenter || undefined });
    let usedGL = false; if (wantGL) { usedGL = gls.render(R.cv, { mode: live ? ['flat', '3p', 'drone'][cm] : 'flat', near: S.camera === 3 && cm === 1, quality: R.quality, time: R.t, under: !!view.underground, atmo: R.atmo, cam: fr.cam, vp: L.vp, dpr: R.dpr, me, yaw: this.camYaw || 0, map: view.map, tanks: view.tanks, sentries: (view.sentries || []).concat((view.drones || []).map(d => ({ ...d, dr: 1 })), (view.traps || []).map(T => ({ ...T, tr: 1 })), (view.tanks || []).filter(t => t.alive && t.twinN > 0).map(t => ({ x: t.x, y: t.y, a: t.a, n: t.twinN, tr: 2 }))), dist, meshes: R.mesh3d }); }
    if (usedGL) { const g0 = R.ctx; g0.setTransform(1, 0, 0, 1, 0, 0); g0.clearRect(0, 0, R.cv.width, R.cv.height); }
    if (gls.ok && gls.cv.style.display !== (usedGL ? 'block' : 'none')) gls.cv.style.display = usedGL ? 'block' : 'none';
    const g = this.renderer.ctx; g.setTransform(this.renderer.dpr, 0, 0, this.renderer.dpr, 0, 0);
    // r22: name + HP bar + «hp/max» above EVERY visible tank (me, allies, enemies, bots) in all cameras; screen-space so it stays readable in 3D; hidden tanks (bush/swamp/underwater) were never drawn this frame → no plate
    { R.screenPlates = true; const cam = fr.cam, g3 = usedGL && (cm === 1 || cm === 2) && live && gls.M3; g.save(); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; const many = view.tanks.length > 40;
      for (const t of view.tanks) { if (!t.alive || t._seenF !== R.frameN || t.spawnT > 0) continue; if (view.mode === 'classic' && t.team === 1 && t.maxHp <= 40 && !(me && t.id === me.id)) continue;
        let x, y, k; if (g3) { const q = gls.project(t.x, t.y, 14); if (!q) continue; x = q[0]; y = q[1]; k = Math.max(0.7, Math.min(1.25, 150 / q[2])); } else { x = L.vp.x + L.vp.w / 2 + (t.x - cam.x) * cam.z; y = L.vp.y + L.vp.h / 2 + (t.y - cam.y) * cam.z - 17 * cam.z; k = Math.max(0.75, Math.min(1.15, cam.z / 2.6)); }
        if (x < L.vp.x - 40 || x > L.vp.x + L.vp.w + 40 || y < L.vp.y - 20 || y > L.vp.y + L.vp.h + 20) continue;
        const isMe = me && t.id === me.id, ally = me && t.team === me.team && view.mode !== 'classic', d = me ? Math.hypot(t.x - me.x, t.y - me.y) : 0, far = !isMe && many && d > 260;
        const tc = (R.teamCol && R.teamCol(view, t)) || (isMe ? '#ffffff' : ally ? '#6fb6ff' : '#ff6a5a'), hk = Math.max(0, Math.min(1, t.hp / (t.maxHp || 1))), w = Math.round(44 * k), h = Math.max(4, Math.round(6 * k));
        g.globalAlpha = far ? 0.55 : 0.92; g.fillStyle = 'rgba(8,10,12,0.72)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2); g.strokeStyle = tc; g.lineWidth = 1; g.strokeRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3);
        g.fillStyle = hk > 0.6 ? '#4fdc6e' : hk > 0.3 ? '#ffc93d' : '#ff4d4d'; g.fillRect(x - w / 2, y, w * hk, h);
        if (t.armorT > 0 && t.armorHp > 0) { g.fillStyle = '#9fd0ff'; g.fillRect(x - w / 2, y - 3, w * Math.min(1, t.armorHp / (armorMax ? armorMax(t.armorT) : 100)), 1.5); }
        if (far) drawFlag(g, t.cc || ccOfName(t.name), Math.round(x - 5 * k), Math.round(y - 9 * k), Math.round(10 * k), Math.round(7 * k)); // r28: distant tanks keep a small flag
        if (!far) { const fs = Math.max(7, Math.round(7.5 * k)); g.font = '700 ' + fs + 'px system-ui, sans-serif'; const hpT = Math.max(0, Math.ceil(t.hp)) + '/' + Math.round(t.maxHp); g.lineWidth = 2.2; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(hpT, x, y + h - 0.5); g.fillStyle = '#fff'; g.fillText(hpT, x, y + h - 0.5);
          const nm = (view.mode === 'br' && view.squad > 1 && !isMe ? teamTag(t.team) + ' ' : '') + (t.name || '') + (t.myth ? ' ✦' : '') + (t.tlv ? ' · ' + t.tlv : ''); g.font = '600 ' + Math.max(8, Math.round(10 * k)) + 'px system-ui, sans-serif'; g.lineWidth = 3.2; g.strokeStyle = 'rgba(0,0,0,0.92)'; g.strokeText(nm, x, y - 4); g.fillStyle = liteCol(tc); g.fillText(nm, x, y - 4); { /* r28: country flag right of the name, every tank, every camera */ const fw = Math.round(13 * k), fh = Math.round(9 * k), nw2 = g.measureText(nm).width; drawFlag(g, t.cc || ccOfName(t.name), Math.round(x + nw2 / 2 + 3 * k), Math.round(y - 4 - fh + 1), fw, fh); }
          if (view.mode !== 'classic' && t.prk != null) { /* r27: rank insignia in every camera (2D + 3D) — chevrons / bars / stars */ const r = t.prk | 0, nw = g.measureText(nm).width, ix = x - nw / 2 - 9 * k, iy = y - 8 * k, c = r >= 14 ? '#ffd23d' : r >= 7 ? '#e8e8f0' : '#d9a44a'; g.fillStyle = '#1b2330'; g.fillRect(ix - 6 * k, iy - 6 * k, 12 * k, 12 * k); g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(ix - 6 * k, iy - 6 * k, 12 * k, 12 * k); g.fillStyle = c;
            const n = r >= 14 ? Math.min(3, r - 13) : r >= 7 ? Math.min(3, r - 6) : Math.min(3, Math.max(1, r)); for (let q = 0; q < n; q++) { if (r >= 14) { g.beginPath(); g.arc(ix - (n - 1) * 3 * k + q * 6 * k, iy, 2 * k, 0, 7); g.fill(); } else if (r >= 7) g.fillRect(ix - 4 * k, iy - 4 * k + q * 3 * k, 8 * k, 1.6 * k); else { g.beginPath(); g.moveTo(ix - 4 * k, iy - 3 * k + q * 3 * k); g.lineTo(ix, iy - 0.5 * k + q * 3 * k); g.lineTo(ix + 4 * k, iy - 3 * k + q * 3 * k); g.lineWidth = 1.3 * k; g.stroke(); } } }
          if (t.gm && t.gm.length && (!far)) { /* r27: mounted gameplay mods — colour chip per mod, border = tier, dots = level */ const cw = 6 * k, gx = x - (t.gm.length * (cw + 2)) / 2; t.gm.forEach((m, q) => { const Mi = GMODS[m[0]]; if (!Mi) return; const cx = gx + q * (cw + 2); g.fillStyle = Mi.col; g.fillRect(cx, y + h + 3, cw, cw); g.strokeStyle = m[1] >= 5 ? '#ff3b6b' : m[1] >= 4 ? '#ffb347' : '#ffffff'; g.lineWidth = 1; g.strokeRect(cx - 0.5, y + h + 2.5, cw + 1, cw + 1); g.fillStyle = '#000'; for (let l = 0; l < m[2]; l++) g.fillRect(cx + 1 + l * 1.7 * k, y + h + 3 + cw - 1.6, 1.1, 1.1); }); }
          if (t.shBHp > 0) { g.strokeStyle = 'rgba(90,184,255,' + (0.35 + 0.4 * t.shBHp / (t.shBMax || 1)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(x, y + 22 * k, 22 * k, 0, 7); g.stroke(); } } }
      g.restore(); }
    const w = me ? (WEAPONS[me.weapon] || WEAPONS.cannon) : WEAPONS.cannon;
    const reloadK = me ? 1 - Math.max(0, me.cd) / (w.reload || 1) : 1;
    if (!cm || !live) try { this.drawMarkers(g, view, fr.cam, L); } catch (e) {}
    this.hud.draw(g, view, me, L, fr.cam, { input: this.input, touch: this.touch, spec: !!this.specEls, reloadK: Math.max(0, Math.min(1, reloadK)) });
    if (s.p2) { const W = L.W, H = L.H, q = s.p2; g.save(); g.strokeStyle = 'rgba(255,255,255,0.16)'; g.setLineDash([6, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); g.setLineDash([]);
      g.translate(W / 2, 96); g.rotate(Math.PI); const bw = 150, k = Math.max(0, q.hp / q.maxHp); g.fillStyle = 'rgba(10,14,20,0.62)'; g.fillRect(-bw / 2 - 4, -12, bw + 8, 24); g.fillStyle = k > 0.35 ? '#5be36a' : '#ff5d5d'; g.fillRect(-bw / 2, -8, bw * k, 16);
      g.fillStyle = '#fff'; g.font = '12px "Russo One", system-ui, "Noto Sans Georgian", "Noto Sans Armenian", "Sylfaen", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q.alive ? 'Игрок 2 · ' + Math.ceil(q.hp) : 'Игрок 2 · возрождение ' + Math.ceil(q.respawnT || 0), 0, 0.5); g.restore(); }
    if ((view.mode === 'team' || view.ffa) && me && !me.alive && me.respawnT > 0) this.centerText(g, 'Возрождение через ' + Math.ceil(me.respawnT), '#fff');
    if (s.online && s.netNote) this.centerText(g, s.netNote, '#ffd23d', 0.75);
    this.updateActs(view, me);
    this.checkFlow(dt, view, me);
  }
  centerText(g, text, color, yk = 0.42) { g.save(); g.font = '20px "Russo One", system-ui, "Noto Sans Georgian", "Noto Sans Armenian", "Sylfaen", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC"'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(text, this.W / 2, this.H * yk); g.fillStyle = color; g.fillText(text, this.W / 2, this.H * yk); g.restore(); }
  handleEvents(evs, view, me, quiet) {
    const R = this.renderer, cam = R.cam, meId = me ? me.id : -1;
    const near = (x, y) => { const d = Math.hypot(x - cam.x, y - cam.y); return Math.max(0, 1 - d / 420); };
    this.sp = (x, y) => { const rot = this.camRot != null ? this.camRot - Math.PI / 2 : -Math.PI / 2, dx = x - cam.x, dy = y - cam.y, d = Math.hypot(dx, dy); return { pan: d < 1 ? 0 : (dx * Math.cos(rot + Math.PI / 2) + dy * Math.sin(rot + Math.PI / 2)) / Math.max(120, d), d: Math.min(1, d / 420) }; };
    for (const e of evs) {
      switch (e.k) {
        case 'shot': { if (e.o === meId && !quiet) { const nw = performance.now(); if (nw - (this._vibF || 0) > 140) { this._vibF = nw; this.vibrate(e.w === 'mg' ? 4 : 10); } } const v = near(e.x, e.y); if (v > 0) { R.muzzle(e.x, e.y, e.a, e.w); const st = view.tanks.find(o => o.id === e.o), fam = (WEAPONS[e.w] || {}).fam || e.w, big = fam === 'cannon' || fam === 'twin' || e.w === 'heavy'; if (big && st) R.blast(e.x, e.y, e.a, st.x, st.y, near(st.x, st.y) > 0.6);
            if (!quiet) { const vo = st ? voiceOf(st) : null, vx = fam === 'mg' ? { mg: st ? mgClass(st.mgi) : 0, me: e.o === meId } : vo ? { ...vo.gun, me: e.o === meId } : null; this.audio.play('shot_' + fam, (e.o === meId ? 1 : 0.55) * v, this.sp(e.x, e.y), vx); } }
          if (e.o === meId) { R.shake = Math.max(R.shake, e.w === 'rail' ? 3 : fam0(e.w) ? 2.2 : 0.6); this._rldW = 1; } break; }
        case 'splash': { const v = near(e.x, e.y); if (v > 0) { R.splash(e.x, e.y, e.s || 0.5); if (!quiet) this.audio.play('splash', v * (0.5 + 0.5 * (e.s || 0.5)), this.sp(e.x, e.y)); } break; }
        case 'dshot': { const nv = near(e.x, e.y); if (nv > 0) { R.tracer ? R.tracer(e.x, e.y, e.tx, e.ty, e.leg ? '#ffd27a' : '#bfe6ff') : R.addParticle({ k: 'spark', x: e.tx, y: e.ty, vx: 0, vy: 0, life: 0.15, t: 0, r: 1.5 }); if (this.audio.throttle('dsh', 60)) this.audio.play('shot_mg', 0.35 * nv, null, { c: 2 }); } break; }
        case 'dust': if (near(e.x, e.y) > 0) for (let i = 0; i < 5; i++) R.addParticle({ k: 'smoke', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.6, t: 0, r: 4 + Math.random() * 4, c: '150,130,95' }); break; // r37: shot into a hill crest
        case 'zap': { const v = near(e.x, e.y); if (v > 0 && !quiet) this.audio.play('zap', v * 0.8, this.sp(e.x, e.y), e.z); if (v > 0) R.addParticle({ k: 'light', x: e.x, y: e.y, life: 0.12, t: 0, r: 36, c: e.z === 3 ? '255,60,70' : e.z === 2 ? '70,150,255' : '220,230,255' }); break; } // r36 lightning
        case 'molo': { const v = near(e.x, e.y); if (v > 0 && !quiet) this.audio.play(e.s === 'boom' ? 'molo_boom' : 'molo_throw', v, this.sp(e.x, e.y)); if (e.s === 'boom' && v > 0) { R.addParticle({ k: 'light', x: e.x, y: e.y, life: 0.25, t: 0, r: 30, c: '255,230,170' }); for (let i = 0; i < 10; i++) R.addParticle({ k: 'spark', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.3, t: 0, c: 'rgba(200,255,230,1)' }); } break; }
        case 'htrap': { const v = near(e.x, e.y), K = ['mine', 'emp', 'smoke', 'oil', 'spike', 'snare', 'decoy', 'turret', 'bomb', 'wall', 'flare', 'tele'].indexOf(e.tk); if (v > 0 && !quiet && e.s !== 'place') this.audio.play('trap', v, this.sp(e.x, e.y), K); if (e.s === 'place' && e.id === meId) { this.audio.play('trap', 0.5, null, K); this.hud.note('🪤 ' + ((HTRAPS[K] || {}).name || 'Ловушка')); } if (e.s === 'boom' && v > 0) { if (e.tk === 'mine' || e.tk === 'bomb') R.boom(e.x, e.y, 1); else R.addParticle({ k: 'light', x: e.x, y: e.y, life: 0.3, t: 0, r: 26, c: '255,230,170' }); } if (e.s === 'kill' && v > 0) { R.addParticle({ k: 'light', x: e.x, y: e.y, life: 0.2, t: 0, r: 18, c: '255,230,170' }); if (!quiet) this.audio.play('brick', v * 0.6, this.sp(e.x, e.y)); if (me && me.team !== 0) this.hud.note('Ловушка уничтожена'); } break; }
        case 'blind': if (e.id === meId) { this.hud.banner('ОСЛЕПЛЁН!', null, '#fff27a', 1.2); this.audio.play('trap', 0.8, null, 10); } break;
        case 'htank': { const tt = view.tanks.find(o => o.id === e.id); if (!quiet) this.audio.play('htank', 0.7, this.sp(e.x, e.y), 0.8 + ((e.model || 0) % 5) * 0.12); if (near(e.x, e.y) > 0) R.addParticle({ k: 'light', x: e.x, y: e.y, life: 0.4, t: 0, r: 40, c: '255,230,170' }); if (tt) this.hud.banner(e.id === meId ? 'НОВЫЙ ТАНК ЦЕЛИ' : 'ЦЕЛЬ СМЕНИЛА ТАНК', MODEL_NAME(e.model), '#ffd23d', 1.6); break; }
        case 'wake': { if (near(e.x, e.y) > 0) R.wake(e.x, e.y, e.a); break; }
        case 'hit': if (near(e.x, e.y) > 0) { R.hit(e.x, e.y, e.s, e.w); if (!quiet) this.audio.play(e.s === 2 || e.s === 3 ? 'hit_metal' : 'hit_tank', near(e.x, e.y) * 0.8, this.sp(e.x, e.y)); } break;
        case 'crumble': if (near(e.x, e.y) > 0) { R.crumbleFx(e); if (!quiet) { this.audio.play('crumble', near(e.x, e.y) * (e.kd === 0 ? 1 : 0.6), this.sp(e.x, e.y), e.kd); } if (e.kd === 0 && near(e.x, e.y) > 0.6) R.shake = Math.max(R.shake || 0, 3); } break; // r37 house/fence/tree collapse
        case 'brick': if (near(e.x, e.y) > 0) { R.brickFx(e.x, e.y, e.steel); if (!quiet) this.audio.play('brick', near(e.x, e.y) * 0.8, this.sp(e.x, e.y)); } break;
        case 'crate': { const v = near(e.x, e.y); if (v > 0) { R.crateFx(e.x, e.y); if (!quiet) this.audio.play('crate', v, this.sp(e.x, e.y)); } if (me && Math.hypot(e.x - me.x, e.y - me.y) < 120 && this.stats) this.stats.crates++; break; }
        case 'boom': { const v = near(e.x, e.y); if (me && me.alive && e.conc && Math.hypot(e.x - me.x, e.y - me.y) < e.conc) { R.shake = Math.max(R.shake, 14); this.vibrate(40); } if (v > 0) { R.boom(e.x, e.y, e.s, e.tank, e.w); R.shake = Math.max(R.shake, (e.s > 2 ? 10 : 6) * v); if (!quiet) this.audio.play(e.tank || e.s > 1.2 ? 'boom' : e.w === 'rocket' || e.w === 'hrocket' ? 'boom_rocket' : 'boom_small', v, this.sp(e.x, e.y)); } if (e.s > 2 && !quiet) R.flashT = 0.15; break; }
        case 'life': if (e.id === meId) { if (e.ask) this.lifeOffer(); else this.hud.note(e.out ? 'Жизни закончились' : e.buy ? '❤ Жизнь куплена' : '❤ Осталось жизней: ' + e.n, '#ff6b8a'); } break;
        case 'dmg': { const tt = view.tanks.find(o => o.id === e.id); if (tt && e.hx != null && near(e.hx, e.hy) > 0) R.tankHit(tt, e.hx, e.hy, e.dt, e.v > 40 ? 1 : 0); }
          if (quiet) break;
          if (e.o === meId && e.id !== meId) { R.popup(e.x + (Math.random() - 0.5) * 6, e.y, String(e.v) + (e.dt === 'crit' ? '!' : ''), DMG_COLOR[e.dt] || '#ffe27a', true); if (R.hitFlash) R.hitFlash(e.hx ?? e.x, e.hy ?? e.y, e.v); /* r26: bigger numbers + hit flash */ this.hud.hitT = 0.18; if (this.stats) this.stats.damage += e.v; }
          else if (e.id === meId) { R.popup(e.x, e.y, '-' + e.v, e.dt && e.dt !== 'kin' ? DMG_COLOR[e.dt] : '#ff6b6b'); R.hurtT = 0.35; this.audio.play('hurt', 0.7); this.vibrate(25); const at = view.tanks.find(t => t.id === e.o); if (at) this.hud.damageFrom(Math.atan2(at.y - me.y, at.x - me.x)); }
          break;
        case 'kill': { const vt = view.tanks.find(o => o.id === e.vid); if (vt && near(vt.x, vt.y) > 0) R.wreck(vt); }
          if (quiet) break;
          this.hud.addFeed(e, meId);
          if (e.kid === meId && e.vid !== meId) { this.stats.kills++; this.audio.play('kill'); this.vibrate(15); const k = this.stats.kills; this.hud.banner(k >= 2 && view.mode !== 'classic' ? ['', '', 'ДВОЙНОЕ!', 'ТРОЙНОЕ!', 'МЕГАУНИЧТОЖЕНИЕ!'][Math.min(4, this.streak(k))] || 'УНИЧТОЖЕН' : 'УНИЧТОЖЕН', e.victim, '#ff6b6b', 1.3, false); }
          if (e.vid === meId) { this.vibrate(80); this.audio.play('lose', 0.6); if (view.mode !== 'classic') this.hud.banner('ВЫ УНИЧТОЖЕНЫ', e.killer !== '—' ? 'Вас уничтожил: ' + e.killer : null, '#ff5d5d', 2, true); }
          break;
        case 'give': if (!quiet) { const nm = (PICKUPS[e.type] || {}).name || ({ weapon: 'оружие', ammo: 'патроны', armor: 'броню', med: 'аптечку', hrocket: 'ракеты', smoke: 'дымовую шашку', mine: 'мину', beacon: 'маяк', revive: 'ремкомплект воскрешения' })[e.type] || e.type;
          const nm2 = ({ weapon: 'оружие', ammo: 'патроны', armor: 'броню', med: 'аптечку', hrocket: 'ракеты', smoke: 'дымовую шашку', mine: 'мину', beacon: 'маяк', revive: 'ремкомплект воскрешения' })[e.type] || nm;
          if (e.to === meId) { this.hud.note('Игрок ' + e.name + ' передал вам ' + nm2 + (e.n > 1 ? ' ×' + e.n : ''), '#6cff9a'); this.audio.play('pick'); try { navigator.vibrate && navigator.vibrate(20); } catch (_) {} }
          else if (e.id === meId) this.hud.note(e.drop ? 'Брошено: ' + nm2 : 'Передано ' + e.rname + ': ' + nm2, '#9fd8ff'); } break;
        case 'botupg': if (!quiet) { R.pickupFx(e.x, e.y, e.col || '#fff'); if (R.popup) try { R.popup(e.x, e.y - 18, '⬆ ' + e.g, e.col || '#fff'); } catch (_) {} } break;
        case 'aps': if (!quiet) { R.pickupFx(e.x, e.y, '#4ff0ff'); if (e.id === meId) this.hud.note('Активная защита: ракета перехвачена', '#4ff0ff'); } break;
        case 'chat': if (!quiet) { const me2 = this.session.view.tanks.find(t => t.id === meId), al = me2 && e.team === me2.team && this.isAllyMode(this.session.view); if (al || (!e.req && !this.isAllyMode(this.session.view))) { if (e.id !== meId) this.hud.note(e.name + ': ' + e.txt, al ? '#8fe3ff' : '#c8c8c8', true); if (al && e.ping) (this.hud.pings || (this.hud.pings = [])).push({ x: e.x, y: e.y, t: performance.now(), txt: e.txt }); } } break;
        case 'revive': if (!quiet) { if (e.s === 'start' && e.id === meId) this.hud.banner('РЕМОНТ', 'Не отъезжайте от остова · 12 с', '#6cff9a', 1.2); else if (e.s === 'cancel' && e.id === meId) this.hud.note('Ремонт прерван — комплект сохранён, прогресс потерян', '#ffb347'); else if (e.s === 'done') { if (e.tid === meId) this.hud.banner('ВЫ ВОСКРЕШЕНЫ!', null, '#6cff9a', 1.4); else if (e.id === meId) this.hud.banner('СОЮЗНИК ВОСКРЕШЁН', null, '#6cff9a', 1.2); R.pickupFx(e.x, e.y, '#6cff9a'); } } break;
        case 'pick': if (!quiet && e.id === meId) { const info = PICKUPS[e.type] || {}; R.pickupFx(e.x, e.y, info.color || '#fff'); this.audio.play(e.type === 'weapon' ? 'weapon' : 'pick'); /* r35: one merged short pickup line (name · gear · stat deltas), top-left, 1.6 s */ const parts = [e.type === 'weapon' || e.type === 'armor' ? this.pickupName(e) : info.name]; let col = e.tier > 1 ? TIERS[e.tier - 1].color : info.color || '#fff'; if (e.type === 'lx' && LOOTX[e.lid] && LOOTX[e.lid].cat === 'gear') { const G = LOOTX[e.lid]; parts.push(G.name + ' · Ур. ' + G.lv + (/вид/.test(G.info) ? ' · новый вид' : '')); if (G.r >= 4) col = '#ffb347'; } if (e.d && Object.keys(e.d).length) { const NM = { arm: 'Броня', hp: 'Прочность', rng: 'Дальность', acc: 'Ускорение', spd: 'Скорость', rel: 'Перезарядка', dmg: 'Урон', acc2: 'Точность', turn: 'Поворот' }; parts.push(Object.entries(e.d).map(([k, v]) => NM[k] + ' ' + (v > 0 ? '+' : '') + v + (k === 'hp' ? '' : '%')).join(' · ')); } this.hud.note(parts.filter(Boolean).join(' · '), col, 'pick'); this.stats.pickups++; if (e.type === 'lx' && LOOTX[e.lid] && (LOOTX[e.lid].cat === 'tur' || LOOTX[e.lid].cat === 'mgt')) { const d = this.meta.d, k = LOOTX[e.lid].cat === 'tur' ? 'turOwn' : 'mgOwn', L2 = d[k] || (d[k] = []); if (!L2.includes(LOOTX[e.lid].i)) { L2.push(LOOTX[e.lid].i); this.meta.save(); } } } break;
        case 'pickFail': if (!quiet && e.id === meId) { this.hud.note({ armor: 'Броня не лучше', ammo: 'Патронов хватает', smoke: 'Максимум', mine: 'Максимум', med: 'Максимум', hrocket: 'Полный запас', med_s: 'HP полное', med_l: 'HP полное', repair: 'HP полное', med_team: 'Некого лечить' }[e.type] || 'Нельзя', '#ff9a8a', 'pick'); this.audio.play('click', 0.4); } break;
        case 'use': if (!quiet && e.id === meId) { this.audio.play(e.it === 'med' ? 'pick' : 'click'); this.hud.note({ med: '+Ремкомплект', smoke: 'Дымовая завеса', mine: 'Мина установлена', drone: 'Боевой дрон вызван · 15 с', ldrone: 'Легендарный дрон · 15 с + аптечка', twintrap: 'Ракетная ловушка установлена' }[e.it], '#fff'); } else if (!quiet && e.it === 'smoke') this.audio.play('click', near(e.x, e.y) * 0.5); break;
        case 'ram': if (!quiet && near(e.x, e.y) > 0) { for (let k = 0; k < 8 + e.s * 10; k++) R.addParticle({ k: 'spark', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.3, t: 0, c: Math.random() < 0.5 ? '#ffd27a' : '#fff3c4' });
          this.audio.play('ram', 0.6 + e.s * 0.6); if (e.a === meId || e.b === meId) { R.shake = Math.max(R.shake || 0, 3 + e.s * 5); if (e.f) R.popup(e.x, e.y - 16, 'Таран!', '#ffb347', e.s > 0.5); try { navigator.vibrate && navigator.vibrate(30); } catch (_) {} } } break;
        case 'surface': if (!quiet && near(e.x, e.y) > 0) { for (let k = 0; k < 14; k++) R.addParticle({ k: 'spark', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 60, life: 0.5, t: 0, c: '#8fb06a' }); R.addParticle({ k: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.8, t: 0, r: 6, g: 18, c: '170,210,150', w: 1.4 }); this.audio.play('boom_small', 0.4); } if (e.id === meId && !quiet) this.hud.note('Всплытие!', '#8fd46a'); break;
        case 'bunker': if (e.id === meId && !quiet) { this.hud.banner(e.l ? 'ПОДЗЕМЕЛЬЕ' : 'НА ПОВЕРХНОСТИ', e.l ? 'Тоннели ведут к выходам по всей карте' : null, e.l ? '#ffb347' : '#8fd46a', 1.6); this.audio.play('click'); this.vibrate && this.vibrate(30); } break;
        case 'dive': if (e.id === meId && !quiet) { this.hud.note('Под водой: вас не видно (до 30 с)', '#8fd46a'); this.audio.play('click'); } break;
        case 'beacon': if (near(e.x, e.y) > 0) for (let k = 0; k < 3; k++) R.addParticle({ k: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, life: 1.2 + k * 0.4, t: 0, r: 4, g: 96, c: '255,77,122', w: 1.5 }); if (e.id === meId && !quiet) this.hud.note('Маяк активен: скрытые враги видны 15 с', '#ff4d7a'); break;
        case 'tower': if (!quiet) { const mine = me0team(this) === e.team; this.hud.note(e.hq ? (mine ? 'Наш штаб уничтожен!' : 'Вражеский штаб уничтожен!') : (mine ? 'Мы потеряли башню' : 'Башня врага разрушена! +300 💰'), mine ? '#ff6b6b' : '#7cff9a'); this.vibrate(mine ? 120 : 60); } break;
        case 'sudden': if (!quiet) this.hud.banner('ВНЕЗАПНАЯ СМЕРТЬ', 'Все башни уязвимы · штаб получает ×3 урона', '#ff8a65', 3); break;
        case 'mbuy': if (e.id === meId && !quiet) { this.hud.note('Улучшение куплено: ' + ({ dmg: 'урон', arm: 'броня', spd: 'скорость' })[e.it] + ' ур.' + e.lv, '#ffd54f'); this.vibrate(30); } break;
        case 'revealed': if (e.id === meId && !quiet) { this.hud.note('Вас обнаружили!', '#ff4d4d'); this.vibrate(80); this.audio.play('click'); } break;
        case 'note': if (e.id === meId && !quiet) this.hud.note(e.txt, '#ffd23d'); break;
        case 'rico': if (near(e.x, e.y) > 0) { R.ricochet(e.x, e.y, e.a); if (!quiet) this.audio.play('shot_ricochet', near(e.x, e.y), this.sp(e.x, e.y)); } break;
        case 'part': { const pt = view.tanks.find(o => o.id === e.id); if (pt && near(pt.x, pt.y) > 0) R.partOff(pt, e.p); } if (!quiet && e.id === meId) { this.hud.note(PART_NAMES[PARTS[e.p]] + ': повреждено! Найдите деталь или ремкомплект', '#ff9a8a'); this.vibrate(60); } break;
        case 'noLock': if (!quiet && e.id === meId) { this.hud.note('Нет цели', '#ff9a8a'); this.audio.play('click', 0.4); } break;
        case 'noammo': if (!quiet && e.id === meId) { this.hud.note(e.w === 'base' ? 'Нет снарядов — найдите «Патроны»' : 'Нет патронов — основное оружие', '#ffb43d'); } break;
        case 'wave': if (!quiet) { this.hud.banner('ВОЛНА ' + e.n, view.special === 'zombie' ? 'Зомби приближаются!' : 'Враги становятся сильнее', '#ff9f3d', 1.8); this.audio.play('zone'); } break;
        case 'flag': if (!quiet) { const myT = me ? me.team : 0, ours = e.team === myT, who = e.id === meId;
          const txt = e.s === 'take' ? (who ? 'Флаг у вас! Везите на базу' : ours ? 'Враг украл наш флаг!' : 'Наши взяли флаг врага') : e.s === 'cap' ? (e.team === myT ? 'ФЛАГ ЗАХВАЧЕН!' : 'Враг захватил флаг') : e.s === 'drop' ? (ours ? 'Наш флаг брошен — верните его' : 'Флаг врага брошен') : (ours ? 'Наш флаг возвращён' : 'Флаг врага вернулся на базу');
          if (e.s === 'cap') { this.hud.banner(txt, (view.score || [0, 0]).join(' : '), e.team === myT ? '#5dff8a' : '#ff5d5d', 1.8); this.audio.play(e.team === myT ? 'win' : 'lose', 0.5); } else { this.hud.note(txt, ours && e.s !== 'ret' ? '#ff6b6b' : '#8fd3ff'); this.audio.play('pick', 0.5); } } break;
        case 'lap': if (!quiet && e.id === meId) { this.hud.banner(e.n === view.laps ? 'ПОСЛЕДНИЙ КРУГ' : 'КРУГ ' + e.n, null, '#ffd23d', 1.4); this.audio.play('go', 0.6); } break;
        case 'raceFin': if (!quiet && e.id === meId) { const p = view.raceRanking().findIndex(t => t.id === meId) + 1; this.hud.banner('ФИНИШ!', 'Место: ' + p, '#5dff8a', 2); this.audio.play('win', 0.6); } break;
        case 'armorBreak': if (!quiet && e.id === meId) { this.hud.note('Броня разбита!', '#ff6b6b'); this.vibrate(30); } break;
        case 'spawn': if (!quiet && view.mode === 'classic') this.audio.play('spawn', 0.4); break;
        case 'zone': if (!quiet) { this.hud.banner('ЗОНА СУЖАЕТСЯ!', 'Двигайся к безопасной области', '#e6a3ff', 2.2, false); this.audio.play('zone'); } break;
        case 'go': if (!quiet) { if (view.special === 'hunt' && me) { const T = !!me.isTarget; this.hud.banner(T ? 'ТЫ — ЦЕЛЬ!' : 'ТЫ — ОХОТНИК!', T ? 'Выживи 10 мин · 5 жизней · ловушки — кнопка 🪤' : 'Отними у цели 5 жизней · у тебя 3', T ? '#ffd23d' : '#ff6a5a', 3); } else this.hud.banner('В БОЙ!', null, '#5dff8a', 1.1); this.audio.play('go'); } break;
        case 'baseDown': if (!quiet) { this.hud.banner('БАЗА УНИЧТОЖЕНА', null, '#ff5d5d', 2.5); } break;
        case 'bonusSpawn': if (!quiet) this.audio.play('pick', 0.5); break;
      }
    }
  }
  streak(k) { const now = performance.now(); this._ks = this._ks || []; this._ks.push(now); this._ks = this._ks.filter(t => now - t < 6000); return this._ks.length; }

  // ---------- match flow ----------
  checkFlow(dt, view, me) {
    if (this.overShown) return; const s = this.session;
    if (view.mode === 'br' && !view.ffa && me && !me.alive && !view.result) { this.deadT += dt; if (this.deadT > 1.6) this.showDeathBR(view, me); return; }
    if (view.mode === 'classic' && view.result) {
      this.deadT += dt; if (this.deadT < (view.result.delay || 1) + 0.6) return;
      if (view.result.win) return this.levelDone(view, me);
      return this.showResults(view, me);
    }
    if (view.result) { this.deadT += dt; if (this.deadT > 1.8) this.showResults(view, me); }
    // dynamic music: intensity from nearby enemies, low HP and the closing zone; separate final-circle track in BR
    this._muT = (this._muT || 0) - dt; if (this._muT <= 0 && me) { this._muT = 0.5; let n = 0; for (const o of view.tanks) if (o.alive && o.team !== me.team && (o.x - me.x) ** 2 + (o.y - me.y) ** 2 < 200 * 200) n++;
      const z = view.zone; let zi = 0; if (z && view.mode === 'br' && !view.ffa) zi = z.state === 'shrink' ? 0.5 : z.state === 'final' ? 0.8 : 0;
      this.audio.setIntensity(Math.min(1, n * 0.22 + (me.alive && me.hp < me.maxHp * 0.35 ? 0.4 : 0) + zi));
      if (view.mode === 'br' && !view.ffa && z && (z.state === 'final' || z.phase >= 5) && !view.result) this.audio.playMusic('final'); }
  }
  showDeathBR(view, me) {
    this.overShown = true; if (this.meta.d.inv && Object.keys(this.meta.d.inv).length) { this.meta.d.inv = {}; this.meta.save(); } this.input.reset(); const s = this.session;
    const canRevive = !s.online && !this.revived && this.Ads.canRewarded() && view.aliveCount > 3;
    this.ui.modal([h('div', { class: 'big-title lose' }, '#' + me.place), h('p', null, 'из ' + view.tanks.length + ' · уничтожений: ' + me.kills), h('div', { class: 'btns' }, canRevive ? h('button', { class: 'btn g big', data: { m: 'revive' } }, icon('ad', 20), 'Возродиться (реклама)') : null, h('button', { class: 'btn y big', data: { m: 'results' } }, 'Итоги боя'), h('button', { class: 'btn big', data: { m: 'watch' } }, 'Наблюдать'))], (a) => {
      if (a === 'revive') { this.Ads.showRewarded('revive').then(ok => { if (ok) this.revive(view, me); else this.showResults(view, me); }); return; }
      if (a === 'results') this.showResults(view, me);
      if (a === 'watch') { this.spectateMode(view, me); }
    }, { dismiss: false });
  }
  revive(view, me) {
    this.revived = true; this.overShown = false; this.deadT = 0;
    const z = view.zone; const a = Math.random() * 6.28, r = Math.random() * Math.max(10, z.r * 0.6);
    let x = z.cx + Math.cos(a) * r, y = z.cy + Math.sin(a) * r; for (let i = 0; i < 50 && view.map.tankBlockedAt(x, y, 10); i++) { x = z.cx + (Math.random() - 0.5) * z.r; y = z.cy + (Math.random() - 0.5) * z.r; }
    me.x = x; me.y = y; me.alive = true; me.hp = me.maxHp; me.inv = 3; me.place = 0; view.aliveCount++; this.hud.banner('ВОЗРОЖДЕНИЕ!', 'Второй шанс', '#5dff8a', 1.8);
    this.renderer._camInit = false; this.audio.play('levelup');
  }
  // r27 spectator mode: switch player, follow / drone / top-down / free camera, live scoreboard + bracket. No own tank → cannot affect play.
  specStart() { const view = this.session.view; this.overShown = false; this.input.enabled = false; this.specCam = 0; const ids = () => view.tanks.filter(t => t.alive).map(t => t.id); this.spectate = ids()[0] || 0;
    const bar = h('div', { class: 'specbar' }), sb = h('div', { class: 'specsb' }), mk = (t, f) => h('button', { class: 'btn', onclick: f }, t);
    const camN = ['Следить', 'Дрон', 'Сверху', 'Свободная'];
    const camB = mk('🎥 ' + camN[0], () => { this.specCam = (this.specCam + 1) % 4; camB.textContent = '🎥 ' + camN[this.specCam]; this.specZoom = [1, 0.7, 0.35, 0.8][this.specCam]; if (this.specCam === 3) { const t = view.tanks.find(x => x.id === this.spectate); this.specCenter = t ? [t.x, t.y] : [view.map.pw / 2, view.map.ph / 2]; } else this.specCenter = this.specCam === 2 ? [view.map.pw / 2, view.map.ph / 2] : null; });
    bar.append(h('b', null, '👁 ЗРИТЕЛЬ'), mk('◀', () => { const L = ids(), i = L.indexOf(this.spectate); this.spectate = L[(i - 1 + L.length) % L.length] || this.spectate; }), mk('▶', () => { const L = ids(), i = L.indexOf(this.spectate); this.spectate = L[(i + 1) % L.length] || this.spectate; }), camB, mk('Сетка', () => this.ui.modal([h('h3', null, 'Турнирная сетка'), h('div', { class: 'tbracket' }, (this.tour ? this.tour.round : []).map(R => h('div', { class: 'tcol' }, R.map(p => h('div', { class: 'tourp' + (p.me ? ' me' : '') }, p.flag + ' ' + p.name))))), this.ui.confirmBtns(['', 'ok', 'Закрыть'])], () => {})), mk('Выйти', () => { this.session.world.finish({ winnerTeam: Math.random() < 0.5 ? 0 : 1 }); }));
    let drag = null; const el = this.gameEl || this.cv; this._specPD = (e) => { if (this.specCam === 3) drag = [e.clientX, e.clientY]; }; this._specPM = (e) => { if (drag && this.specCenter) { const z = (this.layout && this.layout.zoom) || 2; this.specCenter[0] -= (e.clientX - drag[0]) / (z * 0.8); this.specCenter[1] -= (e.clientY - drag[1]) / (z * 0.8); drag = [e.clientX, e.clientY]; } }; this._specPU = () => { drag = null; };
    this.cv.addEventListener('pointerdown', this._specPD); window.addEventListener('pointermove', this._specPM); window.addEventListener('pointerup', this._specPU);
    this.specIv2 = setInterval(() => { while (sb.firstChild) sb.firstChild.remove(); for (const t of view.tanks.slice().sort((a, b) => b.kills - a.kills)) sb.appendChild(h('div', { class: t.id === this.spectate ? 'on' : '' }, flagOf(t.name) + ' ' + t.name + ' · ' + t.kills + ' · ♥' + (t.lives ?? 3) + ' · ' + Math.max(0, Math.ceil(t.hp)) + ' HP')); const t = view.tanks.find(x => x.id === this.spectate); if (!t || !t.alive) { const L = ids(); if (L.length) this.spectate = L[0]; } }, 400);
    this.specEls = [bar, sb]; (this.gameEl || document.body).append(bar, sb); }
  specEnd() { clearInterval(this.specIv2); (this.specEls || []).forEach(e => e.remove()); this.specEls = null; this.specZoom = 1; this.specCenter = null; if (this._specPD) { this.cv.removeEventListener('pointerdown', this._specPD); window.removeEventListener('pointermove', this._specPM); window.removeEventListener('pointerup', this._specPU); this._specPD = null; } this.input.enabled = true; }
  spectateMode(view, me) {
    this.overShown = true; if (this.meta.d.inv && Object.keys(this.meta.d.inv).length) { this.meta.d.inv = {}; this.meta.save(); } this.input.enabled = false;
    const pick = () => { const alive = view.tanks.filter(t => t.alive); if (alive.length) this.spectate = alive.sort((a, b) => b.kills - a.kills)[0].id; };
    pick(); this.spectIv = setInterval(() => { const t = view.tanks.find(x => x.id === this.spectate); if (!t || !t.alive) pick(); if (view.result) { clearInterval(this.spectIv); setTimeout(() => this.showResults(view, me), 1200); } }, 500);
    const b = document.createElement('button'); b.className = 'btn y'; b.style.cssText = 'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:6'; b.textContent = 'Итоги боя'; b.onclick = () => { clearInterval(this.spectIv); this.showResults(view, me); }; this.gameEl && this.gameEl.appendChild(b);
  }
  levelDone(view, me) {
    this.overShown = true; if (this.meta.d.inv && Object.keys(this.meta.d.inv).length) { this.meta.d.inv = {}; this.meta.save(); } this.audio.play('win'); this.stats.classicLevels++;
    const k = view.killsByType || {}; const rows = [['Лёгкий', 'b', 100], ['Быстрый', 'f', 200], ['Огневой', 'p', 300], ['Броневик', 'a', 400]].map(r => h('div', { class: 'row', style: 'justify-content:space-between;font-size:14px;margin:4px 0' }, h('span', null, r[0]), h('span', null, (k[r[1]] || 0) + ' × ' + r[2])));
    this.ui.modal([h('div', { class: 'big-title' }, 'УРОВЕНЬ ' + (view.level + 1)), h('h3', null, 'пройден!'), h('div', { class: 'panel', style: 'margin:10px 0;text-align:left' }, rows), h('p', null, 'Счёт: ' + view.score), h('div', { class: 'btns' }, h('button', { class: 'btn y big', data: { m: 'next' } }, 'Следующий уровень'), h('button', { class: 'btn big', data: { m: 'end' } }, 'Завершить'))], (a) => {
      if (a === 'next') { const lives = view.lives, score = view.score, stars = me ? me.stars : 0; this.meta.d.stats.classicBest = Math.max(this.meta.d.stats.classicBest || 0, view.level + 1); this.meta.save(); const keepStats = this.stats; this.ui.fade(() => { this.session = new LocalSession(this, 'classic', { level: view.level + 1, lives, score, stars }); const st = keepStats; this.beginSession(); this.stats.classicLevels = st.classicLevels; this.stats.kills += st.kills; this.stats.damage += st.damage; }); }
      else this.showResults(view, me, true);
    }, { dismiss: false });
  }
  showResults(view, me, classicWin) {
    if (this._resultsShown === view) return; this._resultsShown = view;
    if (this.session && this.session.extra && this.session.extra.spec) { clearInterval(this.spectIv); this.specEnd(); const T = this.tour, r = view.result || {}; if (T && T.spec) T.spec.win = r.winnerTeam === 0; this.overShown = true; this.ui.fade(() => { if (this.session) this.session.destroy(); this.session = null; this.ui.tourBracket(); }); return; } // r27 spectator: no stats, back to the bracket
    this.overShown = true; if (this.meta.d.inv && Object.keys(this.meta.d.inv).length) { this.meta.d.inv = {}; this.meta.save(); } this.input.reset(); clearInterval(this.spectIv);
    const s = this.session, mode = view.mode; let title, sub, win = false, place = 0;
    if (mode === 'br' && view.ffa) { const rk = view.ffaRanking(); place = rk.findIndex(t => me && t.id === me.id) + 1 || rk.length; win = place === 1; title = win ? 'ПОБЕДА!' : '#' + place; sub = 'Каждый за себя · ' + (me ? me.kills : 0) + ' уничтожений · ' + view.diff.name; }
    else if (mode === 'br') { const sq = view.squad || 1, tot = sq > 1 ? view.squadCount : view.tanks.length; place = me ? (me.alive ? 1 : me.place) : tot; win = place === 1; title = win ? 'ПОБЕДА!' : '#' + place; sub = (win ? (sq > 1 ? 'Ваш отряд — последний на арене' : 'Последний танк на арене') : (sq > 1 ? 'место из ' + tot + ' отрядов' : 'место из ' + tot)) + ' · ' + view.diff.name; }
    else if (mode === 'team' && (view.special === 'survival' || view.special === 'zombie')) { place = 0; win = (view.wave || 0) >= 5; title = 'ВОЛНА ' + (view.wave || 0); sub = (s.p2 ? 'Кооператив' : view.special === 'zombie' ? 'Зомби-танки' : 'Выживание') + ' · уничтожено ' + view.score[0] + ' · ' + view.diff.name; }
    else if (mode === 'team' && view.special === 'race') { const rk = view.raceRanking(); place = rk.findIndex(t => me && t.id === me.id) + 1 || rk.length; win = place === 1; title = win ? 'ПОБЕДА В ГОНКЕ!' : place + ' МЕСТО'; sub = 'Танковые гонки · ' + rk.slice(0, 3).map((t, i) => (i + 1) + '. ' + t.name).join('  '); }
    else if (mode === 'team' && view.special === 'boss') { win = view.result && view.result.winnerTeam === 0; title = win ? 'БОСС ПОВЕРЖЕН!' : 'ВРЕМЯ ВЫШЛО'; sub = 'Рейд на босса · ' + view.diff.name; }
    else if (mode === 'team') { const wt = view.result ? view.result.winnerTeam : -1; win = me && wt === me.team; title = wt === -1 ? 'НИЧЬЯ' : win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'; sub = (view.score || [0, 0]).join(' : '); }
    else { win = !!classicWin; title = classicWin ? 'ОТЛИЧНО!' : 'ИГРА ОКОНЧЕНА'; sub = 'Пройдено уровней: ' + this.stats.classicLevels + ' · счёт ' + (view.score || 0); }
    this.audio.play(win ? 'win' : 'lose'); this.audio.stinger(win ? 'win' : 'lose');
    try { botMatch(this.meta.d, view, mode); } catch (e) {} if (s.extra && s.extra.tour) this.tourWin = win; // r27: bots earn/lose rank points by the same rules
    const r = this.meta.applyMatch({ mode, variant: s.variant, kills: this.stats.kills, damage: this.stats.damage, place, total: mode === 'br' && view.squad > 1 ? view.squadCount : view.tanks.length, rew: view.diff ? view.diff.rew : 1, win, classicLevels: mode === 'classic' ? this.stats.classicLevels : 0, pickups: this.stats.pickups, crates: this.stats.crates, online: !!s.online });
    { const bx = this.meta.d.boxes || (this.meta.d.boxes = { c: 1, r: 0, e: 0, l: 0 }); if (win) bx.c++; if (win && mode === 'br') bx.r++; if (place && place <= 3 && Math.random() < 0.15) bx.e++; this.meta.save(); }
    // r26: a crate after EVERY match — odds shown on screen. Common 75% / legendary 25%; inside: 50% coins, 50% a part/mod for the NEXT battle (one-battle use)
    const crate = (() => { const d = this.meta.d, leg = Math.random() < 0.25; if (Math.random() < 0.5) { const c = leg ? 30 + Math.floor(Math.random() * 31) : 10 + Math.floor(Math.random() * 16); this.meta.addCoins(c); return { leg, txt: '+' + c + ' 🪙' }; }
      const pool = []; for (let i = 0; i < LOOTX.length; i++) { const L = LOOTX[i]; if (leg ? L.r === 4 : L.r <= 2) pool.push(i); } const lid = pool[Math.floor(Math.random() * pool.length)]; (d.tmp || (d.tmp = [])).push({ lid, n: 1, name: LOOTX[lid].name, crate: 1, fresh: 1 }); this.meta.save(); return { leg, txt: LOOTX[lid].name + ' · держится, пока побеждаешь' }; })();
    const crateEl = h('div', { class: 'panel crate', style: 'text-align:center;margin:8px 0;padding:8px;border:2px solid ' + (crate.leg ? '#ffb02e' : '#9aa6b2') }, h('div', { class: 'crbox', style: 'font-size:40px;transition:transform .6s cubic-bezier(.3,1.8,.5,1);transform:scale(.3) rotate(-25deg)' }, crate.leg ? '🎁' : '📦'),
      h('b', { style: 'color:' + (crate.leg ? '#ffb02e' : '#dfe6ee') }, crate.leg ? 'Легендарный ящик' : 'Обычный ящик'), h('div', { class: 'crtxt', style: 'opacity:0;transition:opacity .5s .6s' }, crate.txt), h('small', { class: 'note' }, 'Шансы: обычный 75% · легендарный 25% · внутри 50% монеты / 50% деталь или мод на следующий бой'));
    setTimeout(() => { const bx = crateEl.querySelector('.crbox'), tx = crateEl.querySelector('.crtxt'); if (bx) bx.style.setProperty('transform', 'scale(1) rotate(0deg)'); if (tx) tx.style.setProperty('opacity', '1'); this.audio.play('levelup'); }, 350);
    if (mode === 'classic') { this.meta.d.stats.classicBest = Math.max(this.meta.d.stats.classicBest || 0, this.stats.classicLevels); this.meta.save(); }
    const canX2 = this.Ads.canRewarded();
    const st3 = (v, t) => h('div', null, v, h('small', null, t));
    const ov = this.ui.modal([h('div', { class: 'big-title ' + (win ? '' : 'lose') }, title), h('p', null, sub), h('div', { class: 'stats3' }, st3(this.stats.kills, 'уничтожено'), st3(Math.round(this.stats.damage), 'урон'), st3(fmtT(view.time), 'время')),
      h('div', { class: 'rew' }, h('span', null, icon('coin', 26), h('b', { data: { cnt: r.coins } }, '0')), h('span', { style: 'color:#8dffb0' }, '+', h('b', { data: { cnt: r.xp } }, '0'), ' XP')), h('div', { class: 'rankbox', style: 'margin:6px 0' }, h('p', { class: 'note', style: 'color:#ffd23d' }, '★ ' + r.rk1 + ' · Танк ур. ' + r.tl1 + (r.tl1 > r.tl0 ? ' ▲ (+' + (r.tl1 - r.tl0) + ')' : '')),
        r.promo ? h('div', { class: 'rkpromo', style: 'font-size:22px;color:#ffd23d;font-weight:800;animation:pulse 0.8s 3' }, '▲ НОВОЕ ЗВАНИЕ!') : r.demo ? h('div', { class: 'rkdemo', style: 'font-size:20px;color:#ff6b6b;font-weight:800;animation:pulse 0.8s 2' }, '▼ Звание понижено') : null,
        h('div', { style: 'font-weight:700;color:' + (r.rpD >= 0 ? '#8dffb0' : '#ff6b6b') }, 'Прогресс звания ' + (r.rpD >= 0 ? '+' : '−') + Math.abs(r.rpD)),
        h('div', { style: 'height:10px;background:#0006;border-radius:5px;overflow:hidden;margin:4px 20px' }, h('div', { style: 'height:100%;width:' + (r.rpct ?? 0) + '%;background:linear-gradient(90deg,#ffb02e,#ffd23d)' })),
        h('small', { class: 'note' }, (r.rpct ?? 0) + '% → ' + (r.rnext || '—'))),
      crateEl, r.crKept ? h('p', { class: 'note', style: 'color:#8dffb0' }, '🔥 Серия побед: предметы сохранены (' + r.crKept + ')') : null, r.crLost ? h('p', { class: 'note', style: 'color:#ff6b6b' }, '✖ Предметы из ящиков потеряны (' + r.crLost + ')') : null,
      h('div', { class: 'btns' }, canX2 ? h('button', { class: 'btn g big', data: { m: 'x2' } }, icon('ad', 20), 'Смотреть рекламу: x2 монеты') : null, h('button', { class: 'btn y big', data: { m: 'again' } }, s.online ? 'Новый матч' : 'Ещё раз'), h('button', { class: 'btn big', data: { m: 'menu' } }, 'В меню'))], (a, b) => {
      if (a === 'x2') { this.Ads.showRewarded('x2_coins').then(ok => { if (ok) { this.meta.addCoins(r.coins); this.audio.play('coin'); this.ui.toast('+' + r.coins + ' монет (x2)', 'coin'); b.remove(); const c = ov.querySelector('[data-cnt="' + r.coins + '"]'); if (c) c.textContent = r.coins * 2; } }); return false; }
      const go = () => { if (a === 'again') { if (s.online && s.requeue) { s.requeue(); this.quitToMenuThen(() => this.net.quickMatch(view.variant || mode)); } else this.startLocal(s.variant || mode); } else this.quitToMenu(); };
      this.Ads.maybeInterstitial('after_match').then(go);
    }, { dismiss: false });
    // count-up animation
    for (const el of ov.querySelectorAll('[data-cnt]')) { const target = +el.dataset.cnt; const t0 = performance.now(); const tick = () => { const k = Math.min(1, (performance.now() - t0) / 900); el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); else this.audio.play('coin', 0.6); }; setTimeout(tick, 300); }
    setTimeout(() => { for (const u of r.ups) { this.audio.play('levelup'); this.ui.toast('Новый уровень ' + u.level + '! +' + u.coins + ' монет, +' + u.gems + ' кристаллов', 'star'); } for (const a of r.ach) this.ui.achToast(a); for (const m of r.missionsDone) this.ui.toast('Задание выполнено: ' + m.text, 'check'); }, 1300);
  }
  quitToMenuThen(fn) { this.quitToMenu(); setTimeout(fn, 400); }

  debugApi() {
    const app = this;
    return { LOOTX,
      app, info() { const s = app.session; const v = s && s.view; const me = v && v.tanks.find(t => t.id === s.meId); return { state: app.state, mode: s && s.mode, alive: v && v.aliveCount, me: me && { x: me.x, y: me.y, hp: me.hp, alive: me.alive, kills: me.kills, weapon: me.weapon }, result: v && v.result, tanks: v && v.tanks.length, coins: app.meta.d.coins, level: app.meta.d.level, particles: app.renderer.particles.length }; },
      start(mode, pre) { app.startLocal(mode, pre ? {} : { noPre: 1 }); }, menu() { app.quitToMenu(); },
      stepMany(n) { const s = app.session; for (let i = 0; i < n; i++) { s.world.step(STEP); app.handleEvents(s.world.events, s.world, s.world.tanks.find(t => t.id === s.meId), true); } },
      killMe() { const s = app.session; const me = s.world.byId.get(s.meId); s.world.damage(me, 9999, 0, 'zone', me.x, me.y); },
      winClassic() { const w = app.session.world; for (const t of w.tanks) if (t.team === 1 && t.alive) w.kill(t, w.byId.get(app.session.meId)); w.queue.length = 0; w.enemyKilled = w.enemyTotal; w.finish({ win: true }, 0.5); },
      endTeam() { const w = app.session.world; w.score[0] = w.target; w.finish({ winnerTeam: 0 }); },
    };
  }
}
function angD(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function fmtT(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

export function initPricopbum(root, opts) { const app = new App(root, opts); try { if (typeof window !== 'undefined') window.__pbApp = app; } catch (e) {} return () => app.destroy(); }
if (typeof window !== 'undefined') window.initPricopbum = initPricopbum;

function me0team(app) { return app.me ? app.me.team : 0; }
// r29: name text colour = team colour lifted toward white (same size), so blue/red names stay readable on any ground
function liteCol(c) { const m = /^#([0-9a-f]{6})$/i.exec(c || ''); if (!m) return c; const n = parseInt(m[1], 16), f = (v) => Math.round(v + (255 - v) * 0.45); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
