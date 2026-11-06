// r25: military ranks by player level + per-tank level from XP played in that tank (small, capped bonuses)
export const RANKS = ['Рядовой', 'Ефрейтор', 'Младший сержант', 'Сержант', 'Старший сержант', 'Старшина', 'Прапорщик', 'Младший лейтенант', 'Лейтенант', 'Старший лейтенант', 'Капитан', 'Майор', 'Подполковник', 'Полковник', 'Генерал-майор', 'Генерал-лейтенант', 'Генерал-полковник', 'Генерал армии', 'Маршал'];
// r26 ranked ladder: rank points (RP) go up on wins / top places / kills and DOWN on losses (demotion possible); each rank also needs career kills.
// Thresholds are steep and HIDDEN from the player (UI shows only a % bar); the final rank (Маршал) needs 100 000 destroyed tanks and shows «???» until reached.
const RK_K = [0, 0, 10, 25, 50, 150, 300, 500, 1000, 1500, 2500, 5000, 7500, 10000, 25000, 35000, 50000, 75000, 100000];
const RK_P = RANKS.map((_, i) => Math.round(40 * i ** 2.3));
export function rankInfo(d) { const rp = Math.max(0, (d && d.rp) || 0), k = (d && d.stats && d.stats.kills) || 0; let i = 0; while (i + 1 < RANKS.length && rp >= RK_P[i + 1] && k >= RK_K[i + 1]) i++;
  if (i + 1 >= RANKS.length) return { i, name: RANKS[i], sub: 3, pct: 100, next: null };
  const fp = (rp - RK_P[i]) / (RK_P[i + 1] - RK_P[i]), fk = RK_K[i + 1] > RK_K[i] ? (k - RK_K[i]) / (RK_K[i + 1] - RK_K[i]) : 1, f = Math.max(0, Math.min(0.999, Math.min(fp, fk)));
  return { i, name: RANKS[i], sub: 1 + Math.floor(f * 3), pct: Math.floor(f * 100), next: i + 2 >= RANKS.length ? '???' : RANKS[i + 1] }; }
export const rankOf = (x) => typeof x === 'object' && x ? rankInfo(x).name : RANKS[Math.min(RANKS.length - 1, Math.floor(((x || 1) - 1) / 3))];
export function rpDelta(r) { const kills = r.kills || 0; let win = !!r.win; if (r.mode === 'br' && r.place && r.total) win = r.place <= Math.max(1, Math.ceil(r.total * 0.1)); const top = r.mode === 'br' && r.place && r.place <= 3;
  return (win ? 25 : -15) + Math.min(20, kills * 2) + (top ? 10 : 0); }
// r27: persistent bot ladder — every bot nickname keeps its own rank points + career kills, updated with rpDelta exactly like the player
export function botMatch(d, view, mode) { if (!view || !view.tanks || mode === 'classic') return; const B = d.botRp || (d.botRp = {}); const tot = view.tanks.length; const top = Math.max(...view.tanks.map(t => t.kills || 0));
  for (const t of view.tanks) { if (!t.name || t.human || !t.ai && t.cid) continue; const e = B[t.name] || (B[t.name] = { rp: RK_P[Math.max(0, Math.min(RANKS.length - 2, (t.prk | 0) - 1))] || 0, k: RK_K[Math.max(0, Math.min(RANKS.length - 2, (t.prk | 0) - 1))] || 0 });
    const win = mode === 'br' ? false : view.winTeam != null ? t.team === view.winTeam : (t.kills || 0) === top && top > 0; e.rp = Math.max(0, e.rp + rpDelta({ mode, kills: t.kills || 0, win, place: t.place, total: tot })); e.k += t.kills || 0; }
  const ks = Object.keys(B); if (ks.length > 400) for (const k of ks.slice(0, ks.length - 400)) delete B[k]; }
export function botRanks(d) { const B = d.botRp || {}, o = {}; for (const n in B) o[n] = rankInfo({ rp: B[n].rp, stats: { kills: B[n].k } }).i; return o; }
export const TANK_LV_MAX = 20;
export const tankLv = (xp) => Math.min(TANK_LV_MAX, 1 + Math.floor(Math.sqrt((xp || 0) / 50)));
// +0.5% reload, accuracy and armour per level above 1 → max +9.5% at level 20 (capped so it never breaks balance)
export const tankLvFx = (lv) => { const k = Math.min(TANK_LV_MAX - 1, Math.max(0, lv - 1)) * 0.005; return k ? { rel: +(1 - k).toFixed(4), spread: +(1 - k).toFixed(4), arm: +(1 + k).toFixed(4) } : null; };
// Progression, economy, daily rewards, missions, achievements. Saved in localStorage.
import { botEcoEarn } from './tankmods.js';
import { matchCoins } from '../sim/progress.js';
import { WEAPON_PRICE, UPGRADE_COST, UPGRADES, SKINS, WEAPON_LIST } from '../sim/defs.js';
const KEY = 'pricopbum_save';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };

function killCoins(k) { let c = 0; for (let i = 0; i < k; i++) c += 1 + ((i * 7 + 3) % 3); return c; } // 1–3 coins per kill
export const DAILY = [ { coins: 2 }, { coins: 3 }, { gems: 1 }, { coins: 4 }, { coins: 5 }, { gems: 2 }, { coins: 10, gems: 3 } ];
const MISSION_POOL = [
  { id: 'kills', text: 'Уничтожь {n} танков', n: [8, 15, 25], reward: [4, 7, 11] },
  { id: 'br_top10', text: 'Попади в топ-10 в Королевской битве {n} раз', n: [1, 2], reward: [6, 11] },
  { id: 'team_win', text: 'Выиграй командный бой {n} раз', n: [1, 2], reward: [6, 11] },
  { id: 'classic_lv', text: 'Пройди {n} уровня в Классике', n: [1, 2, 3], reward: [4, 8, 12] },
  { id: 'pickups', text: 'Подбери {n} бонусов', n: [5, 10], reward: [4, 6] },
  { id: 'damage', text: 'Нанеси {n} урона', n: [1500, 3000, 6000], reward: [4, 8, 13] },
  { id: 'matches', text: 'Сыграй {n} боя', n: [2, 3, 5], reward: [3, 5, 8] },
  { id: 'crates', text: 'Разбей {n} ящиков', n: [5, 12], reward: [4, 7] },
];
export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Первая кровь', desc: 'Уничтожь первый танк', stat: 'kills', goal: 1, gems: 5 },
  { id: 'hunter', name: 'Охотник', desc: 'Уничтожь 100 танков', stat: 'kills', goal: 100, gems: 15 },
  { id: 'destroyer', name: 'Истребитель', desc: 'Уничтожь 500 танков', stat: 'kills', goal: 500, gems: 40 },
  { id: 'royal', name: 'Король арены', desc: 'Победи в Королевской битве', stat: 'brWins', goal: 1, gems: 25 },
  { id: 'champion', name: 'Чемпион', desc: 'Победи в Королевской битве 5 раз', stat: 'brWins', goal: 5, gems: 60 },
  { id: 'teamplayer', name: 'Командный игрок', desc: 'Выиграй 10 командных боёв', stat: 'teamWins', goal: 10, gems: 30 },
  { id: 'defender', name: 'Защитник', desc: 'Пройди 6 уровней Классики', stat: 'classicLevels', goal: 6, gems: 30 },
  { id: 'rich', name: 'Богач', desc: 'Заработай 10 000 монет', stat: 'coinsEarned', goal: 10000, gems: 30 },
  { id: 'armory', name: 'Оружейник', desc: 'Открой все виды оружия', stat: 'weaponsOwned', goal: 5, gems: 30 },
  { id: 'mechanic', name: 'Механик', desc: 'Прокачай любой параметр до максимума', stat: 'maxUpgrade', goal: 5, gems: 20 },
  { id: 'fashion', name: 'Модник', desc: 'Собери 5 раскрасок', stat: 'skinsOwned', goal: 5, gems: 20 },
  { id: 'veteran', name: 'Ветеран', desc: 'Сыграй 50 боёв', stat: 'matches', goal: 50, gems: 30 },
  { id: 'sniper', name: 'Снайпер', desc: 'Сделай 5 уничтожений за один бой', stat: 'bestKills', goal: 5, gems: 15 },
  { id: 'survivor', name: 'Выживший', desc: 'Попади в топ-3 в Королевской битве', stat: 'brTop3', goal: 1, gems: 15 },
];

export function xpNeed(level) { return 100 + (level - 1) * 70; }

export class Meta {
  constructor() { this.load(); }
  defaults() {
    return { v: 2, name: 'Игрок', coins: 20, gems: 5, xp: 0, level: 1, weapon: 'cannon', weapons: ['cannon'], skin: 'olive', skins: ['olive'],
      up: { dmg: 0, reload: 0, armor: 0, engine: 0 }, removeAds: false, starter: false,
      stats: { kills: 0, brWins: 0, teamWins: 0, classicLevels: 0, coinsEarned: 0, matches: 0, bestKills: 0, brTop3: 0, deaths: 0, damage: 0, classicBest: 0 },
      ach: {}, daily: { last: null, streak: 0 }, missions: { day: null, list: [] }, settings: { sfx: true, music: true, vibro: true, quality: 3, leftHanded: false, aimAssist: 2 },
      ads: { matchesSince: 0, lastInterstitial: 0, rewardedToday: 0, rewardedDay: null }, classicLevel: 0, server: '', tutorial: false, first: Date.now() };
  }
  load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    const def = this.defaults(); this.d = Object.assign(def, d || {});
    for (const k of ['stats', 'settings', 'up', 'daily', 'ads', 'missions']) this.d[k] = Object.assign(def[k], (d && d[k]) || {});
    this.restoreIap(); this.refreshMissions();
    try { if (typeof window !== 'undefined') window.__pbMeta = this; } catch (e) {}
  }
  // r25: permanent purchases are also mirrored in their own key, so they survive a profile reset; server-ready snapshot via exportSave()
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); localStorage.setItem(KEY + '_iap', JSON.stringify({ myth: this.d.myth || [], removeAds: !!this.d.removeAds, starter: !!this.d.starter, prem: !!(this.d.bp && this.d.bp.prem), skins: this.d.skins || [] })); if (typeof window !== 'undefined') window.__pbMeta = this; } catch (e) {} }
  restoreIap() { try { const P = JSON.parse(localStorage.getItem(KEY + '_iap') || 'null'); if (!P) return; const d = this.d; d.myth = [...new Set([...(d.myth || []), ...(P.myth || [])])]; if (P.removeAds) d.removeAds = true; if (P.starter) d.starter = true; if (P.prem) (d.bp || (d.bp = { xp: 0, fc: [], pc: [], prem: false })).prem = true; d.skins = [...new Set([...(d.skins || []), ...(P.skins || [])])]; } catch (e) {} }
  exportSave() { return { v: this.d.v, t: Date.now(), profile: this.d }; }
  reset() { this.d = this.defaults(); this.restoreIap(); this.refreshMissions(); this.save(); }
  get lv() { return { ...this.d.up }; }
  // ----- economy -----
  addCoins(n, earned = true) { this.d.coins += n; if (earned && n > 0) this.d.stats.coinsEarned += n; this.save(); }
  addGems(n) { this.d.gems += n; this.save(); }
  spend(cur, n) { if (this.d[cur] < n) return false; this.d[cur] -= n; this.save(); return true; }
  addXp(n, mintCoins = true) {
    const ups = []; this.d.xp += n; const bp = this.d.bp || (this.d.bp = { xp: 0, fc: [], pc: [], prem: false }); bp.xp += n;
    while (this.d.xp >= xpNeed(this.d.level)) { this.d.xp -= xpNeed(this.d.level); this.d.level++; const r = { coins: mintCoins ? 5 + Math.floor(this.d.level / 2) : 0, gems: this.d.level % 5 === 0 ? 3 : 0 }; if (mintCoins) this.d.coins += r.coins; this.d.gems += r.gems; ups.push({ level: this.d.level, ...r }); }
    this.save(); return ups;
  }
  // r20: garage weapons and upgrades bought with coins are ONE-MATCH («на 1 бой»); previously owned ones stay
  mbx() { return this.d.mb || (this.d.mb = { lx: [], pk: [], kit: 0, up: {}, weapon: null, spent: 0 }); }
  buyWeapon(id) { if (this.d.weapons.includes(id)) return true; if (!this.spend('coins', 10)) return false; const mb = this.mbx(); mb.weapon = id; mb.spent += 10; this.save(); return true; }
  upgradeCost(k) { const l = this.d.up[k] + ((this.d.mb && this.d.mb.up[k]) || 0); return l >= UPGRADES[k].max ? null : 5; }
  upgrade(k) { const c = this.upgradeCost(k); if (c == null || !this.spend('coins', c)) return false; const mb = this.mbx(); mb.up[k] = (mb.up[k] || 0) + 1; mb.spent += c; this.d.stats.maxUpgrade = Math.max(...Object.values(this.d.up)); this.save(); return true; }
  buySkin(id) { const s = SKINS[id]; if (this.d.skins.includes(id)) return true; if (s.cur === 'iap') return false; if (!this.spend(s.cur, s.price)) return false; this.d.skins.push(id); this.d.stats.skinsOwned = this.d.skins.length; this.save(); return true; }
  grantSkin(id) { if (!this.d.skins.includes(id)) this.d.skins.push(id); this.d.stats.skinsOwned = this.d.skins.length; this.save(); }
  // ----- daily -----
  dailyStatus() {
    const t = today(), last = this.d.daily.last; if (last === t) return { available: false, day: this.d.daily.streak };
    let streak = this.d.daily.streak; if (!last || dayNum(t) - dayNum(last) > 1) streak = 0;
    return { available: true, day: streak % 7, streak };
  }
  claimDaily(mult = 1) {
    const st = this.dailyStatus(); if (!st.available) return null; const r = DAILY[st.day];
    this.d.daily.last = today(); this.d.daily.streak = st.day + 1;
    { const bx = this.d.boxes || (this.d.boxes = { c: 1, r: 0, e: 0, l: 0 }); bx.c++; if (st.day === 6) bx.l = (bx.l || 0) + 1; } if (r.coins) this.addCoins(r.coins * mult); if (r.gems) this.addGems(r.gems * mult); this.save(); return { ...r, day: st.day, mult };
  }
  // ----- missions -----
  refreshMissions() {
    const t = today(); if (this.d.missions.day === t && this.d.missions.list.length) return;
    const pool = MISSION_POOL.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    this.d.missions = { day: t, list: pool.map(p => { const k = Math.floor(Math.random() * p.n.length); return { id: p.id, text: p.text.replace('{n}', p.n[k]), goal: p.n[k], reward: p.reward[k], p: 0, claimed: false }; }) };
    this.save();
  }
  progress(id, n) { let done = []; for (const m of this.d.missions.list) if (m.id === id && !m.claimed) { const was = m.p >= m.goal; m.p = Math.min(m.goal, m.p + n); if (!was && m.p >= m.goal) done.push(m); } return done; }
  claimMission(i) { const m = this.d.missions.list[i]; if (!m || m.claimed || m.p < m.goal) return 0; m.claimed = true; this.addCoins(m.reward); return m.reward; }
  // ----- achievements -----
  checkAch() {
    const st = this.d.stats, out = []; st.weaponsOwned = this.d.weapons.length; st.skinsOwned = this.d.skins.length; st.maxUpgrade = Math.max(...Object.values(this.d.up));
    for (const a of ACHIEVEMENTS) if (!this.d.ach[a.id] && (st[a.stat] || 0) >= a.goal) { this.d.ach[a.id] = Date.now(); this.d.gems += a.gems; out.push(a); }
    this.save(); return out;
  }
  // ----- match result -----
  applyMatch(r) {
    // r: { mode, kills, damage, place, total, win, classicLevels, pickups, crates }
    const st = this.d.stats; st.matches++; st.kills += r.kills; st.damage += Math.round(r.damage); st.bestKills = Math.max(st.bestKills, r.kills);
    let coins = 0, xp = 0;
    if (r.mode === 'br') {
      coins = killCoins(r.kills) + (r.place <= 10 ? 2 : 0) + (r.place <= 3 ? 4 : 0) + (r.place === 1 ? 10 : 0);
      xp = 30 + r.kills * 12 + Math.round((r.total - r.place) * 1.2) + (r.place === 1 ? 100 : 0);
      if (r.place === 1) st.brWins++; if (r.place <= 3) st.brTop3++;
    } else if (r.mode === 'team') { coins = killCoins(r.kills) + (r.win ? (r.variant === 'moba' ? 8 : 4) : 0); xp = (r.win ? 80 : 40) + r.kills * 8; if (r.win) st.teamWins++; }
    else { coins = killCoins(r.kills) + r.classicLevels * 3; xp = 20 + r.kills * 6 + r.classicLevels * 50; st.classicLevels += r.classicLevels; }
    coins += 3 + (r.win || r.place === 1 ? 18 : 0); // r37: small coins every battle + win bonus (win ≈ 20–40) (spent on permanent legendary mods)
    const serverCoins = r.online ? matchCoins(r) : 0;
    // Online matches pay the server ledger only. Device coins and device rank stay where they were.
    if (r.online) { xp = Math.round(xp * 1.2); coins = 0; }
    if (r.rew && r.rew !== 1 && !r.online) { coins = Math.round(coins * r.rew); xp = Math.round(xp * r.rew); }
    const missionsDone = [];
    missionsDone.push(...this.progress('kills', r.kills), ...this.progress('damage', Math.round(r.damage)), ...this.progress('matches', 1), ...this.progress('pickups', r.pickups || 0), ...this.progress('crates', r.crates || 0));
    if (r.mode === 'br' && r.place <= 10) missionsDone.push(...this.progress('br_top10', 1));
    if (r.mode === 'team' && r.win) missionsDone.push(...this.progress('team_win', 1));
    if (r.mode === 'classic' && r.classicLevels) missionsDone.push(...this.progress('classic_lv', r.classicLevels));
    this.d.ads.matchesSince++;
    const tx = this.d.tankXp || (this.d.tankXp = {}), mk = String(this.d.model ?? 0), tl0 = tankLv(tx[mk]); tx[mk] = (tx[mk] || 0) + xp; const tl1 = tankLv(tx[mk]); const RI0 = rankInfo(this.d), rk0 = RI0.name; const rpD = rpDelta(r); if (!r.online) this.d.rp = Math.max(0, (this.d.rp || 0) + rpD);
    // r25: battle-limited items (pass rewards / coin purchases) count down one battle
    let crLost = 0, crKept = 0; if (this.d.tmp) { const W = !!r.win || (r.mode === 'br' && r.place && r.total && r.place <= Math.max(1, Math.ceil(r.total * 0.1))); for (const it of this.d.tmp) { if (it.crate) { if (W && !it.fresh) crKept++; else if (!it.fresh) { it.n = 0; crLost++; } it.fresh = 0; } else it.n--; } this.d.tmp = this.d.tmp.filter(it => it.n > 0); } // r26: crate items stay while you keep winning, vanish on the first loss
    const deviceCoins = this.d.coins | 0;
    botEcoEarn(this.d, coins); this.addCoins(coins); const ups = this.addXp(xp, !r.online); const ach = this.checkAch();
    if (r.online && (this.d.coins | 0) !== deviceCoins) this.d.coins = deviceCoins;
    const RI1 = rankInfo(this.d); return { coins, serverCoins, deviceCoins: this.d.coins | 0, online: !!r.online, xp, ups, ach, missionsDone, tl0, tl1, rk0, rk1: RI1.name, rpD: r.online ? rpD : rpD, crLost, crKept, promo: !r.online && RI1.i > RI0.i, demo: !r.online && RI1.i < RI0.i, rpct: RI1.pct, rnext: RI1.next, ri: RI1.i };
  }
}
