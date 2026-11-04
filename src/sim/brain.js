// r16 utility-AI "brain" layered over the reactive bot controller in ai.js.
// Every heavy think a bot scores its goals (fight, hunt a remembered enemy, loot, heal, revive an ally,
// cover an ally, rotate to the zone, ambush, roam) with weights from its personality, then ai.js keeps
// doing the low-level work (steering, aiming, dodging, unsticking) toward whatever the brain picked.
const TAU = Math.PI * 2;
export const PERSONAS = {
  aggressive: { aggro: 1.0, keep: 0,   loot: 0.6, retreat: 0.18, flank: 0.2, support: 0.2, ambush: 0.05, chat: 1.2 },
  sniper:     { aggro: 0.45, keep: 150, loot: 0.7, retreat: 0.35, flank: 0,   support: 0.3, ambush: 0.5,  chat: 0.6 },
  flanker:    { aggro: 0.8, keep: 60,  loot: 0.7, retreat: 0.3,  flank: 1,   support: 0.3, ambush: 0.25, chat: 0.8 },
  medic:      { aggro: 0.5, keep: 90,  loot: 0.8, retreat: 0.4,  flank: 0.1, support: 1,   ambush: 0.1,  chat: 1 },
  looter:     { aggro: 0.55, keep: 70, loot: 1.6, retreat: 0.35, flank: 0.2, support: 0.3, ambush: 0.15, chat: 0.8 },
  coward:     { aggro: 0.3, keep: 120, loot: 0.9, retreat: 0.6,  flank: 0,   support: 0.2, ambush: 0.4,  chat: 1.4 },
};
const PN = Object.keys(PERSONAS);
const CHAT = { upg: ['Апгрейд! 🔧', 'Поставил новый модуль 😎', 'Теперь я сильнее 💪', 'Новая броня, подходи 😤'], emo: ['😂', '👍', '🔥', '😎', 'GG 🏆', '😡', '👋'], help: ['Помогите!', 'Нужна помощь!', 'Меня зажали!'], retreat: ['Отступаем!', 'Назад!', 'Отхожу'], gg: ['gg', 'gg wp', 'изи', 'ez'], rev: ['Поднимаю тебя!', 'Держись, чиню!'], spot: ['Вижу врага!', 'Контакт!', 'Тут один'], thx: ['спс', 'Спасибо!'] };
export const personaOf = (id) => PN[((id * 2654435761) >>> 0) % PN.length];
export function initBrain(w, t, ai) {
  if (ai.pers) return; const h = (t.id * 2654435761) >>> 0;
  ai.pers = t.pers || PN[h % PN.length]; const P = PERSONAS[ai.pers]; ai.P = P;
  ai.aggro = Math.min(1, Math.max(0.2, P.aggro * (0.8 + ((h >>> 8) % 100) / 250)));
  ai.mem = null; ai.goal = 'roam'; ai.chatT = 5 + (h % 20); ai.hes = 0;
}
export function chat(w, t, kind, force) { const ai = t.ai; if (!ai || (!force && ai.chatT > 0)) return; if ((w._chatT || 0) > w.time) return; const L = CHAT[kind]; if (!L) return;
  if (!force && Math.random() > 0.35 * (ai.P ? ai.P.chat : 1)) { ai.chatT = 6; return; } ai.chatT = 25 + Math.random() * 30; w._chatT = w.time + 3;
  w.ev({ k: 'chat', id: t.id, team: t.team, name: t.name, txt: L[Math.floor(Math.random() * L.length)] }); }
const ally = (w, a, b) => a !== b && a.team === b.team && !w.ffa && w.mode !== 'classic' && (w.mode !== 'br' || w.squad > 1);
// heavy think: memory, shared intel, goal choice. best = visible target chosen by ai.js (may be null)
export function brainThink(w, t, ai, best) {
  initBrain(w, t, ai); const P = ai.P, now = w.time; ai.chatT -= 0.25;
  const intel = w._intel || (w._intel = {});
  if (best) { ai.mem = { x: best.x, y: best.y, t: now, id: best.id }; if (!w.ffa) { const I = intel[t.team]; if (!I || now - I.t > 2) { if (!I || now - I.t > 12) chat(w, t, 'spot'); } intel[t.team] = { x: best.x, y: best.y, t: now, id: best.id, by: t.id, layer: best.layer | 0 }; } }
  else { // hearing: shots fired nearby (within 300) reveal a rough position
    if (!ai.mem || now - ai.mem.t > 3) for (const o of w.tanks) { if (!o.alive || o === t || (!w.ffa && o.team === t.team) || (o.layer | 0) !== (t.layer | 0)) continue; if (now - (o.lastFire || -99) < 0.6 && (o.x - t.x) ** 2 + (o.y - t.y) ** 2 < 300 * 300) { ai.mem = { x: o.x + (Math.random() - 0.5) * 40, y: o.y + (Math.random() - 0.5) * 40, t: now, id: o.id, heard: 1 }; break; } }
    const I = !w.ffa && intel[t.team]; if (I && I.by !== t.id && (I.layer | 0) === (t.layer | 0) && now - I.t < 4 && (!ai.mem || I.t > ai.mem.t) && (I.x - t.x) ** 2 + (I.y - t.y) ** 2 < 420 * 420) ai.mem = { x: I.x, y: I.y, t: I.t, id: I.id, shared: 1 };
  }
  if (ai.lootP) { if (ai.lootPid !== ai.lootP.id) { ai.lootPid = ai.lootP.id; ai.lootT0 = now; } else if (now - ai.lootT0 > 9) { (ai.ign || (ai.ign = new Set())).add(ai.lootP.id); ai.lootP = null; ai.wx = null; } }
  if (ai.med) { if (ai.medPid !== ai.med.id) { ai.medPid = ai.med.id; ai.medT0 = now; } else if (now - ai.medT0 > 10) { (ai.ign || (ai.ign = new Set())).add(ai.med.id); ai.med = null; ai.wx = null; } }
  const giveUp = 5 + ai.skill * 6 + P.aggro * 4; if (ai.mem && now - ai.mem.t > giveUp) ai.mem = null;
  // revive: holder of the kit looks for a downed ally's wreck
  ai.revW = null; if (t.revives > 0 && w.wrecks) { let bd = (best ? 140 : 520) ** 2; for (const k of w.wrecks) { if (!k.tid || (k.layer | 0) !== (t.layer | 0)) continue; const o = w.byId.get(k.tid); if (!o || o.alive || !ally(w, t, o)) continue; const d = (k.x - t.x) ** 2 + (k.y - t.y) ** 2; if (d < bd) { bd = d; ai.revW = k; } } }
  // cover a hurt ally: shoot whoever is hitting them
  ai.coverAlly = null; if (!best && !w.ffa && P.support > 0.15) for (const o of w.tanks) { if (!o.alive || !ally(w, t, o) || o.hp > o.maxHp * 0.45 || now - (o.lastAtkT || -9) > 2.5) continue; if ((o.x - t.x) ** 2 + (o.y - t.y) ** 2 > 260 * 260) continue; const a = w.byId.get(o.lastAtk); if (a && a.alive && a.team !== t.team && (a.layer | 0) === (t.layer | 0)) { ai.coverAlly = a; break; } }
  const hp = t.hp / t.maxHp;
  const hasAlly = !w.ffa && w.tanks.some(o => o.alive && ally(w, t, o) && (o.x - t.x) ** 2 + (o.y - t.y) ** 2 < 400 * 400);
  if (best && hp < 0.3 && now - (t.lastAtkT || -9) < 1.5) { if (hasAlly && now - (ai.reqT || -99) > 30) { ai.reqT = now; w.doAction(t, 'req_help'); } else chat(w, t, w.ffa ? 'retreat' : 'help'); }
  if (ai.thx) { ai.thx = 0; chat(w, t, 'thx'); }
  // ask allies for what we lack (same quick-chat a player uses)
  if (hasAlly && now - (ai.reqT || -99) > 45) { const k = hp < 0.35 && !t.meds ? 'med' : t.shells === 0 ? 'ammo' : (t.pbroke & 2) && t.weapon === 'cannon' ? 'weapon' : !t.armorT && hp < 0.5 && Math.random() < 0.08 ? 'armor' : null; if (k) { ai.reqT = now; w.doAction(t, 'req_' + k); } }
  // answer requests / help hurt allies: give spare items
  ai.giveTo = null; if (hasAlly && !best) { const cand = [];
    for (const q of w.reqs || []) { if (now - q.t > 12) continue; const o = w.byId.get(q.id); if (!o || !o.alive || !ally(w, t, o)) continue; const need = q.kind === 'med' ? !o.meds : q.kind === 'ammo' ? (o.shells ?? 99) < 10 : q.kind === 'weapon' ? o.weapon === 'cannon' : q.kind === 'armor' ? !o.armorT : true; if (need) cand.push([o, q.kind]); }
    for (const o of w.tanks) { if (!o.alive || !ally(w, t, o) || (o.x - t.x) ** 2 + (o.y - t.y) ** 2 > 220 * 220) continue; if (o.hp < o.maxHp * 0.35 && !o.meds) cand.push([o, 'med']); if (o.shells === 0) cand.push([o, 'ammo']); if ((o.pbroke & 2) && o.weapon === 'cannon') cand.push([o, 'weapon']); }
    for (const [o, k] of cand) { if ((o.layer | 0) !== (t.layer | 0)) continue; let n = 1, ok = false;
      if (k === 'med') ok = (t.meds || 0) >= (P.support > 0.5 ? 1 : 2) && hp > 0.5; else if (k === 'ammo') { ok = (t.shells || 0) > 25; n = 15; } else if (k === 'armor') ok = t.armorT > 0 && hp > 0.75 && P.support > 0.5; else if (k === 'weapon') ok = t.weapon !== 'cannon' && (P.support > 0.5 || ai.pers === 'looter');
      else if (k === 'help') { if ((o.x - t.x) ** 2 + (o.y - t.y) ** 2 < 450 * 450 && P.retreat < 0.5) { ai.mem = { x: o.x, y: o.y, t: now, id: 0, help: 1 }; if (!ai.helpT || now - ai.helpT > 25) { ai.helpT = now; w.doAction(t, 'req_coming'); } } continue; }
      if (ok) { ai.giveTo = { id: o.id, kind: k, n }; break; } } }
  // utility scores
  const S = { fight: best ? 1 + P.aggro : 0, hunt: !best && ai.mem ? 0.7 + P.aggro * 0.6 : 0, revive: ai.revW ? 2.2 + P.support : 0, cover: ai.coverAlly ? 1.1 + P.support * 0.8 : 0,
    retreat: best && hp < P.retreat ? 2.5 : 0, give: ai.giveTo ? 1.5 + P.support : 0, heal: ai.med ? 1.4 + (1 - hp) : 0, loot: ai.lootP && !best ? 0.5 * P.loot : 0, roam: 0.3 };
  if (S.revive && best && Math.hypot(best.x - t.x, best.y - t.y) < 90) S.revive *= 0.4;
  let g = 'roam', gs = -1; for (const k in S) if (S[k] > gs) { gs = S[k]; g = k; }
  if (g !== ai.goal && g === 'retreat') chat(w, t, 'retreat');
  ai.goal = g; if (g === 'cover' && ai.coverAlly) return ai.coverAlly; // becomes the fight target
  // hesitation / occasional mistake for weaker bots
  if (Math.random() < (1 - ai.skill) * 0.03) ai.hes = 0.3 + Math.random() * 0.7;
  // beacon: use it when hunting something we can't see
  if (g === 'hunt' && t.beacons && !w.ffa && Math.random() < 0.05) w.doAction(t, 'beacon');
  return null;
}
// movement override after the reactive layer; returns null (keep) or {moveA, speedK, aimA, fire}
export function brainMove(w, t, ai, tg, dt) {
  if (!ai.P) return null; const g = ai.goal;
  if (ai.hes > 0) { ai.hes -= dt; return { moveA: null, hold: 1 }; }
  if (t.rvg) return { moveA: null, hold: 1, fire: false }; // channelling a revive
  if (g === 'revive' && ai.revW) { const k = ai.revW, d = Math.hypot(k.x - t.x, k.y - t.y); if (d < 20) { w.doAction(t, 'revive'); if (t.rvg) chat(w, t, 'rev', true); return { moveA: null, hold: 1 }; } return { moveA: Math.atan2(k.y - t.y, k.x - t.x), speedK: 1 }; }
  if (g === 'give' && ai.giveTo) { const o = w.byId.get(ai.giveTo.id); if (!o || !o.alive) { ai.giveTo = null; return null; } const d = Math.hypot(o.x - t.x, o.y - t.y); if (d < 28) { w.doAction(t, 'give_' + ai.giveTo.kind + '_' + ai.giveTo.n); ai.giveTo = null; ai.goal = 'roam'; return { moveA: null, hold: 1 }; } return { moveA: Math.atan2(o.y - t.y, o.x - t.x), speedK: 1 }; }
  if (g === 'retreat' && tg) { const a = Math.atan2(t.y - tg.y, t.x - tg.x) + (ai.side || 1) * 0.35; if (t.smokes && Math.random() < 0.02) w.doAction(t, 'smoke'); return { moveA: a, speedK: 1, aimA: Math.atan2(tg.y - t.y, tg.x - t.x) }; }
  if (g === 'hunt' && !tg && ai.mem && !t.layer) { const m = ai.mem, d = Math.hypot(m.x - t.x, m.y - t.y); if (d < 24) { ai.mem = null; return null; }
    const pre = ai.skill > 0.65 ? Math.atan2(m.y - t.y, m.x - t.x) : null; // pre-aim toward the last known position / corner
    return { moveA: Math.atan2(m.y - t.y, m.x - t.x), speedK: 0.85, aimA: pre }; }
  if (tg && g === 'fight') { const d = Math.hypot(tg.x - t.x, tg.y - t.y), a = Math.atan2(tg.y - t.y, tg.x - t.x);
    if (ai.P.keep && d < ai.P.keep * 0.75) return { moveA: a + Math.PI + (ai.side || 1) * 0.4, speedK: 0.8 };
    if (ai.P.flank > 0.5 && d > 70 && d < 220) return { moveA: a + (ai.side || 1) * 1.15, speedK: 1 }; }
  return null;
}
