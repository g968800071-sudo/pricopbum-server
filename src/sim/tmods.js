// r37 permanent tank modifications («Модернизация танка»). Only LEGENDARY models (coins, forever) and MYTHIC models
// (real money only, forever). Common/rare/epic models have no permanent coin upgrades. Same rules for bots: they earn the
// same coins per battle (+ win bonus) and spend them on the same mods (see client/tankmods.js botEco).
export const TM_MAX = 5;
export const TMODS = [
  { k: 'arm', n: 'Броня корпуса', ic: '🛡️', per: 0.03, d: '+3% прочности за уровень' },
  { k: 'eng', n: 'Двигатель', ic: '⚙️', per: 0.025, d: '+2,5% скорости за уровень' },
  { k: 'gun', n: 'Орудие', ic: '💥', per: 0.03, d: '+3% урона за уровень' },
  { k: 'rel', n: 'Автомат заряжания', ic: '⏱️', per: 0.03, d: '−3% перезарядки за уровень' },
  { k: 'scr', n: 'Экраны', ic: '🧱', per: 0.03, d: '+3% защиты от попаданий за уровень' },
];
export const TM_COIN = [100, 250, 550, 1100, 2200]; // legendary: steep per level — a win gives ~20–40, an ad 15; full tank = 21 000 coins (long, steady grind)
export const TM_EUR = [2.99, 4.99, 7.99, 12.99, 19.99]; // mythic: real money per next level
export function normTmod(a) { if (!Array.isArray(a)) return null; const o = TMODS.map((_, i) => Math.max(0, Math.min(TM_MAX, a[i] | 0))); return o.some(v => v) ? o : null; }
export function applyTmod(t, L) { if (!L) return; t.maxHp = t.hp = Math.round(t.maxHp * (1 + TMODS[0].per * L[0])); t.speed *= 1 + TMODS[1].per * L[1]; t.dmgMul = (t.dmgMul || 1) * (1 + TMODS[2].per * L[2]); t.relMul = (t.relMul || 1) * (1 - TMODS[3].per * L[3]); t.armMul = (t.armMul || 1) * (1 + TMODS[4].per * L[4]); t.tmod = L; }
