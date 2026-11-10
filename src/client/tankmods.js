// r37 «Модернизация танка»: permanent mods per tank model.
// Legendary → coins, forever. Mythic → real money only (недоступно sheet on web; in the app without Play «скоро будут доступны»).
// Common / rare / epic → no permanent coin upgrades. Bots: same income per battle (+ win bonus), spend on the same mods.
import { h } from './dom.js';
import { MODELS, RARITIES } from '../sim/models.js';
import { TMODS, TM_MAX, TM_COIN, TM_EUR } from '../sim/tmods.js';
export const eurS = (v) => v.toFixed(2).replace('.', ',') + ' недоступно';
export function tmodOf(d, id) { const M = MODELS[id]; if (!M || M.rar < 3) return null; const a = (d.tmod || {})[String(id)]; return a && a.some(v => v) ? a.slice() : null; }
// bot economy: bots earn exactly what the player earned (the same per-battle coins + win bonus) and buy the cheapest next level
export function botEcoEarn(d, coins) { const E = d.botEco || (d.botEco = { c: 0, lv: [0, 0, 0, 0, 0] }); E.c += Math.max(0, coins | 0); for (let g = 0; g < 50; g++) { let bi = -1; for (let i = 0; i < TMODS.length; i++) if (E.lv[i] < TM_MAX && (bi < 0 || E.lv[i] < E.lv[bi])) bi = i; if (bi < 0 || E.c < TM_COIN[E.lv[bi]]) break; E.c -= TM_COIN[E.lv[bi]]; E.lv[bi]++; } }
export function botModsOpts(d) { const E = d.botEco || { lv: [0, 0, 0, 0, 0] }; let myMax = 0; for (const k in d.tmod || {}) { const M = MODELS[+k]; if (M && M.rar === 4) for (const v of d.tmod[k]) myMax = Math.max(myMax, v); }
  return { botMods: E.lv.slice(), botMythMods: E.lv.map(v => Math.min(v, myMax)) }; } // mythic bots never exceed the mythic levels a human paid for
export function installTankMods(P) {
  P.tankMods = function (id, back) { const d = this.m.d, M = MODELS[id]; if (!M) return; const R = RARITIES[M.rar], L = (d.tmod || (d.tmod = {}))[String(id)] || [0, 0, 0, 0, 0];
    const can = M.rar >= 3, myth = M.rar === 4, E = d.botEco || { lv: [0, 0, 0, 0, 0] };
    const rows = TMODS.map((T, i) => { const l = L[i] | 0, max = l >= TM_MAX; return h('div', { class: 'card tmrow', data: { tm: String(i) } }, h('div', { class: 'tmic' }, T.ic), h('div', { class: 'grow' }, h('div', { class: 'ttl' }, T.n + ' · ур. ' + l + '/' + TM_MAX), h('div', { class: 'ds' }, T.d + (l ? ' · сейчас +' + Math.round(T.per * l * 1000) / 10 + '%' : '')), h('div', { class: 'tmpips' }, Array.from({ length: TM_MAX }, (_, k) => h('i', { class: k < l ? 'on' : '' })))),
        !can ? h('span', { class: 'ds' }, '—') : max ? h('b', null, 'МАКС') : myth ? h('button', { class: 'btn b', data: { tb: String(i) } }, eurS(TM_EUR[l]) + ' · навсегда') : h('button', { class: 'btn y', data: { tb: String(i) } }, '🪙 ' + TM_COIN[l] + ' · навсегда')); });
    const s = this.show('tmods', [h('div', { class: 'menu-bg' }), this.hdr('Модернизация: ' + M.name, this.curs(false)), h('div', { class: 'scroll' },
      h('div', { class: 'panel' }, h('b', { style: { color: R.color } }, M.name + ' · ' + R.name), h('p', { class: 'note' }, can ? (myth ? 'Мифический танк: модернизация только за реальные деньги, навсегда.' : 'Легендарный танк: модернизация за обычные монеты (зарабатываются в каждом бою, бонус за победу) — навсегда.') : 'Обычные, редкие и эпические танки не модернизируются навсегда. Модернизация есть только у легендарных (за монеты) и мифических (за реальные деньги).'),
        h('p', { class: 'note' }, 'Честно: боты зарабатывают столько же монет и тоже улучшают свои легендарные танки. Уровень ботов сейчас: ' + E.lv.join('/') + '. Мифические боты — не выше ваших оплаченных уровней.')),
      rows, h('div', { class: 'btns' }, h('button', { class: 'btn big', data: { tb: 'back' } }, '← Назад')))]);
    s.onclick = (e) => { const b = e.target.closest('[data-tb]'); if (!b) return; this.app.audio.play('click'); if (b.dataset.tb === 'back') return back ? back() : this.garage ? this.garage() : this.menu(); const i = +b.dataset.tb, l = L[i] | 0; if (l >= TM_MAX || !can) return;
      const ok = () => { L[i] = l + 1; d.tmod[String(id)] = L; this.m.save(); this.app.audio.play('levelup'); this.toast(TMODS[i].n + ': уровень ' + (l + 1) + ' (навсегда)', 'star'); try { this.refreshCurrency(); } catch (e) {} this.tankMods(id, back); };
      if (myth) this.demoPurchase({ title: TMODS[i].n + ' ур. ' + (l + 1) + ' · ' + M.name, price: 'Оплата не подключена', desc: 'Мифическая модернизация не выдаётся.', iap: 'tmod_m' + (l + 1) }, () => {});
      else if (d.acct && typeof window !== 'undefined' && window.__pbBuyTmod) window.__pbBuyTmod(this, id, i, TM_COIN[l], ok);
      else this.confirmSpend(TMODS[i].n + ' ур. ' + (l + 1) + ' · навсегда', TM_COIN[l], ok); };
  };
}
