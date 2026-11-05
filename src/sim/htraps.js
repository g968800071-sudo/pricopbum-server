// r36 «Охота» — the target's trap kit. Same damage rules as everything else (damage goes through world.damage/explode,
// credited to the target). Hunters only see a trap within HT_SEE px and can shoot it (1 hit, decoy 3 hits).
import { CELL, T_EMPTY, T_ICE, TANK_R } from './defs.js';
export const HT_SEE = 56, HT_CD = 2.5;
export const HTRAPS = [
  { k: 'mine',   n: 5, ic: '💣', name: 'Мина',              col: '#ff5a3c', r: 16, info: 'Взрыв 40 урона при наезде охотника' },
  { k: 'emp',    n: 2, ic: '⚡', name: 'ЭМИ-ловушка',       col: '#5cc8ff', r: 22, info: 'Отключает оружие охотников рядом на 3 с' },
  { k: 'smoke',  n: 3, ic: '🌫', name: 'Дымовая завеса',    col: '#c9d1d9', r: 0,  info: 'Сразу ставит облако дыма — разорви линию огня' },
  { k: 'oil',    n: 3, ic: '🛢', name: 'Масляное пятно',    col: '#8a6bff', r: 0,  info: 'Пол становится скользким на 20 с — охотников заносит' },
  { k: 'spike',  n: 3, ic: '📌', name: 'Шипы',              col: '#ffb02e', r: 18, info: 'Замедляют охотника на 4 с и наносят 10 урона' },
  { k: 'snare',  n: 2, ic: '🧲', name: 'Магнитный капкан',  col: '#ff4dd8', r: 16, info: 'Обездвиживает охотника на 2 с' },
  { k: 'decoy',  n: 2, ic: '👻', name: 'Голограмма',        col: '#7dffb0', r: 0,  info: 'Ложный танк — отвлекает охотников, 3 попадания' },
  { k: 'turret', n: 1, ic: '🔫', name: 'Автотурель',        col: '#4ff0ff', r: 0,  info: 'Стреляет по охотникам сама' },
  { k: 'bomb',   n: 2, ic: '🎁', name: 'Ящик-ловушка',      col: '#d9a441', r: 15, info: 'Похож на ящик с добычей — взрыв 45 урона' },
  { k: 'wall',   n: 2, ic: '🧱', name: 'Стена',             col: '#c9c4b8', r: 0,  info: 'Бетонные блоки перед танком' },
  { k: 'flare',  n: 2, ic: '✨', name: 'Вспышка',           col: '#fff27a', r: 0,  info: 'Ослепляет охотников, которые тебя видят, на 2,5 с' },
  { k: 'tele',   n: 1, ic: '🌀', name: 'Маяк-телепорт',     col: '#b07dff', r: 0,  info: '1-е нажатие — маяк, 2-е — прыжок к нему' },
];
export const HT = Object.fromEntries(HTRAPS.map(x => [x.k, x]));
export function htKit() { const o = {}; for (const x of HTRAPS) o[x.k] = x.n; return o; }

// place / use one kit item. Returns true when used.
export function htUse(w, t, k) {
  const D = HT[k]; if (!D || !t.hk || !(t.hk[k] > 0) || !t.alive) return false; if ((t.htCd || 0) > w.time && k !== 'tele') return false;
  const T = w.htraps || (w.htraps = []), bx = t.x - Math.cos(t.a || 0) * 16, by = t.y - Math.sin(t.a || 0) * 16; // drop behind the tank
  const ev = (x, y) => w.ev({ k: 'htrap', s: 'place', tk: k, x, y, id: t.id });
  switch (k) {
    case 'smoke': w.smokes.push({ id: w.id(), x: t.x, y: t.y, r: 52, t: 10, max: 10 }); break;
    case 'oil': { const c0 = Math.floor(bx / CELL), r0 = Math.floor(by / CELL), cells = []; for (let r = -3; r <= 3; r++) for (let c = -3; c <= 3; c++) if (c * c + r * r <= 10 && w.map.get(c0 + c, r0 + r) === T_EMPTY) { w.map.set(c0 + c, r0 + r, T_ICE); cells.push([c0 + c, r0 + r]); } (w.htOil || (w.htOil = [])).push({ cells, until: w.time + 20 }); break; }
    case 'turret': t.sentryN = (t.sentryN || 0) + 1; w.doAction(t, 'sentry'); break;
    case 'wall': t.blocksN = (t.blocksN || 0) + 1; w.doAction(t, 'blocks'); break;
    case 'flare': for (const h of w.tanks) if (h.alive && h.team !== t.team && (h.x - t.x) ** 2 + (h.y - t.y) ** 2 < 220 * 220 && w.map.los(h.x, h.y, t.x, t.y)) { h.blindT = 2.5; if (h.ai) { h.ai.react = Math.max(h.ai.react || 0, 1.4); h.ai.err = (Math.random() - 0.5) * 1.6; h.ai.errT = 2.5; } w.ev({ k: 'blind', id: h.id, x: h.x, y: h.y }); } break;
    case 'tele': { const b = T.find(q => q.k === 'tele' && q.owner === t.id); if (b) { const pos = { x: b.x, y: b.y }; T.splice(T.indexOf(b), 1); w.ev({ k: 'htrap', s: 'boom', tk: 'tele', x: t.x, y: t.y }); t.x = pos.x; t.y = pos.y; t.vx = t.vy = 0; t.inv = Math.max(t.inv || 0, 0.8); t.hk.tele--; ev(t.x, t.y); return true; }
      T.push({ id: w.id(), k, x: t.x, y: t.y, owner: t.id, team: t.team, hp: 1, arm: 0, t0: w.time }); ev(t.x, t.y); t.htCd = w.time + 0.6; return true; } // beacon placed: the charge is spent on the jump
    case 'decoy': T.push({ id: w.id(), k, x: bx, y: by, a: t.a, model: t.model, owner: t.id, team: t.team, hp: 3, arm: 0, t0: w.time, life: 40 }); break;
    default: T.push({ id: w.id(), k, x: bx, y: by, owner: t.id, team: t.team, hp: 1, arm: 0.8, t0: w.time, life: 240 });
  }
  t.hk[k]--; t.htCd = w.time + HT_CD; ev(bx, by); return true;
}

export function htStep(w, dt) {
  if (w.htOil) for (let i = w.htOil.length - 1; i >= 0; i--) { const O = w.htOil[i]; if (w.time < O.until) continue; for (const [c, r] of O.cells) if (w.map.get(c, r) === T_ICE) w.map.set(c, r, T_EMPTY); w.htOil.splice(i, 1); }
  for (const h of w.tanks) if (h.blindT > 0) h.blindT -= dt;
  const T = w.htraps; if (!T || !T.length) return;
  for (let i = T.length - 1; i >= 0; i--) { const q = T[i]; if (q.arm > 0) { q.arm -= dt; continue; } if (q.life != null && w.time - q.t0 > q.life) { T.splice(i, 1); continue; }
    const D = HT[q.k]; if (!D.r) continue; const own = w.byId.get(q.owner);
    for (const h of w.tanks) { if (!h.alive || h.team === q.team || (h.x - q.x) ** 2 + (h.y - q.y) ** 2 > (D.r + TANK_R * 0.4) ** 2) continue;
      if (q.k === 'mine') w.explode(q.x, q.y, 30, 40, q.owner, 'mine', q.team);
      else if (q.k === 'bomb') w.explode(q.x, q.y, 34, 45, q.owner, 'mine', q.team);
      else if (q.k === 'emp') { for (const o of w.tanks) if (o.alive && o.team !== q.team && (o.x - q.x) ** 2 + (o.y - q.y) ** 2 < 44 * 44) o.empT = Math.max(o.empT || 0, 3); }
      else if (q.k === 'spike') { h.slowT = Math.max(h.slowT || 0, 4); w.damage(h, 10, q.owner, 'mine', q.x, q.y); }
      else if (q.k === 'snare') { h.snareT = 2; h.vx = h.vy = 0; }
      w.ev({ k: 'htrap', s: 'boom', tk: q.k, x: q.x, y: q.y, id: h.id }); if (own && own.ai) own.ai.htHit = { x: q.x, y: q.y, t: w.time }; T.splice(i, 1); break; }
  }
}
// bullets from hunters destroy traps they hit
export function htBullet(w, b) { const T = w.htraps; if (!T || !T.length) return false; for (let i = 0; i < T.length; i++) { const q = T[i]; if (q.team === b.team || q.k === 'tele' && false) continue; const rr = q.k === 'decoy' ? 100 : 36; if ((b.x - q.x) ** 2 + (b.y - q.y) ** 2 < rr) { if (--q.hp <= 0) { T.splice(i, 1); w.ev({ k: 'htrap', s: 'kill', tk: q.k, x: q.x, y: q.y }); } else w.ev({ k: 'hit', x: b.x, y: b.y, s: 0 }); return true; } } return false; }
