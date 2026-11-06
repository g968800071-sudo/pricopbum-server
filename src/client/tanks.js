// r15: tank model selection (108 procedural models) and the «Конструктор BR» builder + pre-match setup.
import { h, fill } from './dom.js';
import { icon } from './icons.js';
import { Renderer } from './render.js';
import { DIFFS } from '../sim/defs.js';
import { MODELS, CLASSES, RARITIES, BUDGET, C_HULL, C_TUR, C_WPN, C_TRK, C_ENG, C_ARM, C_PAINT, C_DEC, DEFAULT_BUILD, buildCost, buildStats, buildValid, C_MOUNT, HULL_MOUNTS, EXTRA_DPS_CAP } from '../sim/models.js';
import { WEAPONS } from '../sim/defs.js';
import { eur } from './catalog.js';
import { TURRETS, MGS, RAR_COL, turInfo, mgInfo } from '../sim/arms.js';

const CBR_SQUADS = [1, 2, 3, 4, 5, 20];
export function ownsModel(d, m) { const u = m.unlock; if (u.t === 'free' || (d.models || []).includes(m.id)) return true; if (u.t === 'level') return d.level >= u.lv; if (u.t === 'mission') return (d.stats.kills || 0) >= u.goal; return false; }
function statBars(st) {
  const row = (n, v, inv) => { const k = inv ? 2 - v : v, pct = Math.round(50 + (k - 1) / 0.15 * 50); return h('div', { class: 'stat' }, h('b', null, n), h('div', { class: 'sb' }, h('i', { style: { width: Math.max(4, Math.min(100, pct)) + '%', background: k > 1.02 ? '#5dff8a' : k < 0.98 ? '#ff9a5d' : '#ffd23d' } })), h('span', { class: 'sv' }, (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%')); };
  return [row('Прочность', st.hp), row('Скорость', st.spd), row('Броня', st.arm), row('Перезарядка', st.rel, true)];
}
// r19: what the next part (▶) changes, shown before installing
function partDelta(b, i, n) { const nb = b.slice(); nb[i] = (b[i] + 1) % n; let s0, s1; try { s0 = buildStats(b); s1 = buildStats(nb); } catch (e) { return null; }
  const o = []; for (const [k, nm, inv] of [['hp', 'Прочность'], ['spd', 'Скорость'], ['arm', 'Броня'], ['rel', 'Перезарядка', 1]]) { const d = Math.round((s1[k] - s0[k]) * 100); if (d) o.push(nm + ' ' + (d > 0 ? '+' : '−') + Math.abs(d) + '%'); }
  return h('small', { class: 'pdelta' }, o.length ? '▶ ' + o.join(' · ') : '▶ =');
}
// 3D-like turntable preview: squashed Y + slow rotation + light sweep
function turntable(ui, cv, getTank) {
  cancelAnimationFrame(ui.previewRaf); const R = new Renderer(cv), t0 = performance.now();
  const loop = () => { if (!cv.isConnected) return; const w = cv.clientWidth || 300, hh = cv.clientHeight || 150, dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    const g = cv.getContext('2d'), T = (performance.now() - t0) / 1000; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(w / 2, hh * 0.62, 70, 18, 0, 0, Math.PI * 2); g.fill();
    const sc = Math.min(w, hh) / 30; g.translate(w / 2, hh * 0.55); g.scale(sc, sc * 0.66);
    const t = getTank(); t.a = T * 0.7; t.ta = T * 0.7 + Math.sin(T * 1.1) * 0.6; t.tread = T * 20; t.recoil = Math.max(0, 1 - ((T % 2.4) * 4));
    try { R.drawTank(g, t, 'br', true, T); } catch (e) {}
    ui.previewRaf = requestAnimationFrame(loop); };
  loop();
}
const baseTank = (o) => ({ x: 0, y: 0, a: 0, ta: 0, team: 0, alive: true, hp: 100, maxHp: 100, tread: 0, recoil: 0, hitT: 0, inv: 0, shield: 0, speedT: 0, powerT: 0, id: 1, skin: 'olive', weapon: 'cannon', ...o });
const thumbCache = new Map();
function thumb(m) { // cached sprite per model (drawn once)
  let c = thumbCache.get(m.id); if (c) return c; c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'), R = new Renderer(c);
  g.translate(48, 52); g.scale(3.1, 3.1 * 0.8); try { R.drawTank(g, baseTank({ model: m.id, a: -0.6, ta: -0.4, weapon: m.ci === 3 ? 'rocket' : m.ci === 4 ? 'mortar' : 'cannon' }), 'br', false, 0); } catch (e) {}
  thumbCache.set(m.id, c); return c;
}
const tankEur = (u) => eur(parseInt(String(u.price), 10) || 199); // r35: legacy ₽ list price → недоступно tier
const wOf = (m) => m.ci === 3 ? 'rocket' : m.ci === 4 ? 'mortar' : null;

export function installTankScreens(UI) {
  // ---------- model selection (before a match and in the garage) ----------
  UI.prototype.tankSelect = function (onGo) {
    const ui = this, d = this.m.d; d.models = d.models || []; let filt = ui._tfilt || 'all', sel = d.model ?? 0;
    const render = () => {
      const M = MODELS[sel], own = ownsModel(d, M), C = CLASSES[M.ci], RAR = RARITIES[M.rar];
      const chips = h('div', { class: 'chips' }, [['all', 'Все']].concat(CLASSES.map(c => [c.id, c.name])).map(([id, n]) => h('button', { class: 'chip' + (filt === id ? ' on' : ''), data: { t: 'f', v: id } }, n)));
      const list = MODELS.filter(m => filt === 'all' || m.cls === filt);
      const grid = h('div', { class: 'tgrid' }, list.map(m => { const o = ownsModel(d, m); const cell = h('button', { class: 'tcell' + (m.id === sel ? ' sel' : '') + (o ? '' : ' lock') + (m.id === (d.model ?? 0) ? ' eq' : ''), data: { t: 's', v: String(m.id) }, style: { borderColor: RARITIES[m.rar].color } });
        cell.appendChild(thumb(m)); cell.appendChild(h('span', { class: 'tn' }, m.name.replace(/[«»]/g, ''))); if (!o) cell.appendChild(h('i', { class: 'tl' }, '🔒')); return cell; }));
      const u = M.unlock; let action;
      if (own) action = M.id === (d.model ?? 0) ? h('button', { class: 'btn g big', data: { t: 'go' } }, onGo ? 'В БОЙ' : 'Выбран') : h('button', { class: 'btn y big', data: { t: 'eq' } }, onGo ? 'Выбрать и в бой' : 'Выбрать'); if (own) action = h('div', null, action, h('button', { class: 'btn big', style: 'margin-top:6px', data: { t: 'dis' } }, '🔧 Разобрать на детали → Мастерская'), M.rar >= 3 ? h('button', { class: 'btn ' + (M.rar === 4 ? 'b' : 'y') + ' big', style: 'margin-top:6px', data: { t: 'mods' } }, '⬆ Модернизация (' + (M.rar === 4 ? 'недоступно' : '🪙') + ' · навсегда)') : null);
      else if (u.t === 'coins') action = h('button', { class: 'btn y big', data: { t: 'buy' } }, icon('coin', 16), String(u.price));
      else if (u.t === 'gems') action = h('button', { class: 'btn b big', data: { t: 'buy' } }, icon('gem', 16), String(u.price));
      else if (u.t === 'box') action = h('button', { class: 'btn b big', data: { t: 'iap' } }, tankEur(u), h('span', { class: 'demo-tag' }, 'или Легендарный ящик'));
      else if (u.t === 'iap') action = h('button', { class: 'btn b big', data: { t: 'iap' } }, tankEur(u));
      else if (u.t === 'level') action = h('button', { class: 'btn big', disabled: true }, 'Откроется на ' + u.lv + ' уровне');
      else action = h('button', { class: 'btn big', disabled: true }, u.desc + ' (' + (d.stats.kills || 0) + '/' + u.goal + ')');
      const kids = [h('div', { class: 'menu-bg' }), this.hdr(onGo ? 'Выбор танка' : 'Танки', this.curs(false)),
        h('div', { class: 'tleft' }, h('div', { class: 'prev tprev' }, h('canvas', { id: 'pcb-tprev' }), h('div', { class: 'tinfo' }, h('b', { style: { color: RAR.color } }, M.name), h('small', null, C.name + ' · ' + RAR.name))),
        h('div', { class: 'panel', style: 'margin-top:6px;padding:6px 12px' }, statBars(M)), h('div', { class: 'tact' }, action)),
        h('div', { class: 'tright' }, chips, h('div', { class: 'scroll' }, h('div', { class: 'note', style: 'margin:2px 4px 6px' }, MODELS.length + ' моделей · ' + MODELS.filter(m => ownsModel(d, m)).length + ' открыто · разница характеристик в пределах ±15%'), grid))];
      const keep = ui.screen === 'tanks'; const s = keep ? ui.el.querySelector('.scr') : ui.show('tanks', kids); if (keep) { const sc = s.querySelector('.scroll'), y = sc ? sc.scrollTop : 0; fill(s, kids); const n = s.querySelector('.scroll'); if (n) n.scrollTop = y; }
      turntable(ui, s.querySelector('#pcb-tprev'), () => (ui._tt && ui._tt.model === sel ? ui._tt : (ui._tt = baseTank({ model: sel, weapon: wOf(MODELS[sel]) || d.weapon || 'cannon' }))));
      s.onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; ui.app.audio.play('click'); const k = b.dataset.t;
        if (k === 'f') { filt = ui._tfilt = b.dataset.v; render(); }
        else if (k === 's') { sel = +b.dataset.v; render(); }
        else if (k === 'dis') { /* r25: disassemble the model into constructor parts (hull, turret, gun, tracks, engine, armour, paint, camo, decal, mounts) → new build slot, open the workshop */ const M2 = MODELS[sel]; const b = DEFAULT_BUILD.slice(); b[0] = M2.hull % C_HULL.length; b[1] = M2.tur % C_TUR.length; b[3] = M2.trk % C_TRK.length; b[4] = (M2.ci + M2.id) % C_ENG.length; b[5] = M2.kit % C_ARM.length; b[6] = (M2.id * 5) % C_PAINT.length; b[7] = M2.camo ? 1 : 0; b[8] = M2.dec % C_DEC.length;
          let nb = b; if (!buildValid(nb)) { nb = b.slice(); nb[4] = 0; nb[5] = 0; } if (!buildValid(nb)) nb = DEFAULT_BUILD.slice(); d.builds = d.builds || []; if (d.builds.length >= 6) d.builds.pop(); d.builds.push(nb); d.buildSel = d.builds.length - 1; ui.m.save(); ui.toast('Танк ' + M2.name + ' разобран — детали в Мастерской', 'check'); ui.cbrSetup(); }
        else if (k === 'eq') { d.model = sel; ui.m.save(); if (onGo) onGo(); else render(); }
        else if (k === 'go') { if (onGo) onGo(); }
        else if (k === 'mods') ui.tankMods(sel, render);
        else if (k === 'buy' || k === 'iap') ui.tankBuySheet(sel, render); };
    };
    render();
  };

  // r35: purchase sheet for a locked tank — always opens (coins / gems / real money), buttons fit the landscape screen
  UI.prototype.tankBuySheet = function (id, after) {
    const ui = this, d = this.m.d, M = MODELS[id], u = M.unlock, R = RARITIES[M.rar], real = u.t === 'iap' || u.t === 'box', cur = u.t === 'gems' ? 'gems' : 'coins';
    const have = cur === 'gems' ? d.gems : d.coins, enough = !real && have >= u.price;
    const img = thumb(M).cloneNode(); img.getContext('2d').drawImage(thumb(M), 0, 0); img.className = 'tbuyimg';
    const done = () => { if (!d.models.includes(id)) d.models.push(id); d.model = id; ui.m.save(); ui.app.audio.play('weapon'); ui.toast('Открыт танк ' + M.name, 'check'); try { ui.refreshCurrency(); } catch (e) {} if (after) after(); };
    const kids = [img, h('h3', { style: { color: R.color } }, M.name), h('p', { style: 'margin:2px 0' }, CLASSES[M.ci].name + ' · ' + R.name)];
    if (real) {
      kids.push(h('div', { class: 'big-title', style: 'font-size:26px' }, tankEur(u) + ' · навсегда'));
      if (u.t === 'box') kids.push(h('p', { class: 'note' }, 'Или выпадает из Легендарного ящика.'));
      kids.push(ui.confirmBtns(['b', 'pay', 'Купить за ' + tankEur(u)], ...(u.t === 'box' ? [['', 'boxes', 'Открыть ящики']] : []), ['', 'no', 'Отмена']));
    } else {
      kids.push(h('div', { class: 'big-title', style: 'font-size:26px' }, icon(cur === 'gems' ? 'gem' : 'coin', 22), ' ' + u.price), h('p', { class: 'note' }, 'У тебя: ' + have + (enough ? '' : ' · не хватает ' + (u.price - have))));
      kids.push(enough ? ui.confirmBtns([cur === 'gems' ? 'b' : 'y', 'buy', 'Купить за ' + u.price], ['', 'no', 'Отмена']) : ui.confirmBtns(['y', 'shop', 'В магазин'], ['', 'no', 'Отмена']));
    }
    const ov = ui.modal(kids, (a) => {
      if (a === 'buy') { if (ui.m.spend(cur, u.price)) done(); else ui.noMoney(cur); }
      else if (a === 'shop') ui.shop();
      else if (a === 'boxes') ui.boxes();
      else if (a === 'pay') ui.demoPurchase({ title: 'Танк ' + M.name, price: tankEur(u), desc: 'Навсегда · только внешний вид и класс, характеристики в пределах ±15%', iap: u.iap }, (ok) => { if (ok) done(); });
    });
    ov.classList.add('tbuy'); return ov;
  };

  // ---------- «Конструктор BR» ----------
  UI.prototype.cbrSetup = function () {
    const ui = this, d = this.m.d; if (!Array.isArray(d.builds) || !d.builds.length) d.builds = [DEFAULT_BUILD.slice(), [0, 2, 1, 3, 2, 0, 5, 1, 4], [4, 3, 7, 2, 0, 1, 2, 0, 2]].map(b => buildValid(b) ? b : DEFAULT_BUILD.slice());
    while (d.builds.length < 3) d.builds.push(DEFAULT_BUILD.slice()); d.buildSel = Math.min(d.buildSel || 0, d.builds.length - 1); d.cbrOpp = d.cbrOpp || 'bots'; d.cbrSquad = d.cbrSquad || 1;
    const PARTS = [['Корпус', C_HULL.map(x => x.n + ' · ' + x.c)], ['Башня', C_TUR.map(x => x.n + ' · ' + x.c)], ['Орудие', C_WPN.map(x => WEAPONS[x[0]].name + ' · ' + x[1])], ['Гусеницы', C_TRK.map(x => x.n + ' · ' + x.c)],
      ['Двигатель', C_ENG.map(x => x.n + ' · ' + x.c)], ['Броня', C_ARM.map(x => x.n + ' · ' + x.c)], ['Окраска', C_PAINT.map(x => x.n)], ['Камуфляж', ['Нет', 'Есть']], ['Эмблема', C_DEC]];
    const render = () => {
      const b = d.builds[d.buildSel], cost = buildCost(b), ok = cost <= BUDGET, st = buildStats(b);
      const slots = h('div', { class: 'chips' }, d.builds.map((_, i) => h('button', { class: 'chip' + (i === d.buildSel ? ' on' : ''), data: { t: 'slot', v: String(i) } }, 'Сборка ' + (i + 1))), d.builds.length < 6 ? h('button', { class: 'chip', data: { t: 'add' } }, '+ Новая') : null);
      const rows = PARTS.map(([n, opts], i) => h('div', { class: 'crow' }, h('b', null, n), h('button', { class: 'cbt', data: { t: 'dec', v: String(i) } }, '◀'), h('span', { class: 'cv' }, opts[b[i]]), h('button', { class: 'cbt', data: { t: 'inc', v: String(i) } }, '▶'), i < 6 ? partDelta(b, i, opts.length) : null));
      const budget = h('div', { class: 'budget' + (ok ? '' : ' over') }, h('b', null, 'Очки сборки: ' + cost + ' / ' + BUDGET), h('div', { class: 'sb' }, h('i', { style: { width: Math.min(100, cost / BUDGET * 100) + '%' } })));
      const nb = b.length === 9 ? b.concat([0, 0, 0]) : b, msx = [nb[9], nb[10], nb[11]].filter(v => v > 0); let wkk = 1; for (const v of msx) wkk *= 1 - C_MOUNT[v].wt;
      const mpen = h('div', { class: 'note', style: { margin: '4px 10px' } }, 'Доп. орудий: ' + msx.length + ' / ' + (HULL_MOUNTS[nb[0]] - 1) + (msx.length ? ' · штраф к скорости и разгону: −' + Math.round((1 - wkk) * 100) + '% · урон каждого доп. ствола: ' + Math.round(Math.min(0.5, EXTRA_DPS_CAP / msx.length) * 100) + '% (суммарно ≤ +' + Math.round(EXTRA_DPS_CAP * 100) + '%)' : ' · без штрафа'));
      const opp = h('div', { class: 'optsbar' }, h('button', { class: 'opt', data: { t: 'opp' } }, h('small', null, 'Соперники'), d.cbrOpp === 'online' ? 'Против игроков (онлайн)' : 'Против ботов'),
        h('button', { class: 'opt', data: { t: 'sq' } }, h('small', null, 'Команда'), d.cbrSquad === 1 ? 'Соло' : d.cbrSquad === 20 ? 'Отряды по 20' : 'Отряд ' + d.cbrSquad),
        d.cbrOpp === 'bots' ? h('button', { class: 'opt d' + DIFFS[d.diff ?? 1].id, data: { t: 'diff' } }, h('small', null, 'Сложность ботов'), DIFFS[d.diff ?? 1].name) : null);
      const kids = [h('div', { class: 'menu-bg' }), this.hdr('Конструктор BR', this.curs(false)), slots,
        h('div', { class: 'prev' }, h('canvas', { id: 'pcb-cprev' })), mpen,
        h('div', { class: 'panel', style: 'margin-top:6px;padding:6px 12px' }, budget, statBars(st), h('div', { class: 'note' }, 'Оружие: ' + WEAPONS[st.weapon].name + (st.ak >= 0 ? ' · стартовая броня: ' + C_ARM[b[5]].n.toLowerCase() : ''))),
        h('div', { class: 'scroll' }, rows, (() => { const own = d.turOwn || [], cur = d.turSel ?? null, T = cur != null ? TURRETS[cur] : null; // r20: found turrets (battle loot) can be installed here
          return h('div', { class: 'panel arsenal', style: 'margin:6px 0;padding:6px 10px' }, h('div', { class: 'crow' }, h('b', null, 'Боевая башня'), h('button', { class: 'cbt', data: { t: 'tur', v: '-1' } }, '◀'), h('span', { class: 'cv', style: T ? { color: RAR_COL[T.r] } : null }, T ? T.name : 'Стандартная'), h('button', { class: 'cbt', data: { t: 'tur', v: '1' } }, '▶')),
            h('div', { class: 'pdelta' }, T ? turInfo(T) : own.length ? 'Найдено башен: ' + own.length + ' / 50' : 'Башни находятся в бою (добыча) · 50 видов'),
            (d.mgOwn || []).length ? h('div', { class: 'pdelta' }, 'Пулемёты найдены: ' + d.mgOwn.length + ' / 50 · ' + d.mgOwn.slice(-3).map(i => MGS[i].name).join(', ')) : null); })(), opp, h('p', { class: 'note', style: 'margin:6px 4px' }, '~20 минут, зона, лут и повреждения модулей — как в обычной королевской битве. Боты собирают свои танки по тем же правилам. Онлайн сервер проверяет сборку и добирает ботов в пустые места.')),
        h('button', { class: 'play', data: { t: 'go' }, disabled: !ok }, icon('play', 26), ok ? 'В БОЙ' : 'Превышен бюджет')];
      const keep = ui.screen === 'cbr'; const s = keep ? ui.el.querySelector('.scr') : ui.show('cbr', kids); if (keep) { const sc = s.querySelector('.scroll'), y = sc ? sc.scrollTop : 0; fill(s, kids); const n = s.querySelector('.scroll'); if (n) n.scrollTop = y; }
      turntable(ui, s.querySelector('#pcb-cprev'), () => { const bb = d.builds[d.buildSel]; const k = bb.join(','); if (!ui._ct || ui._ctk !== k) { ui._ctk = k; ui._ct = baseTank({ build: bb.slice(), model: -1, weapon: buildStats(bb).weapon }); } return ui._ct; });
      s.onclick = (e) => { const el = e.target.closest('[data-t]'); if (!el) return; ui.app.audio.play('click'); const k = el.dataset.t, v = +el.dataset.v, bb = d.builds[d.buildSel];
        if (k === 'tur') { const own = [null, ...(d.turOwn || []).slice().sort((a, b) => a - b)], j = own.indexOf(d.turSel ?? null); d.turSel = own[(j + v + own.length) % own.length]; ui.m.save(); render(); return; }
        const N = [C_HULL.length, C_TUR.length, C_WPN.length, C_TRK.length, C_ENG.length, C_ARM.length, C_PAINT.length, 2, C_DEC.length];
        if (k === 'inc' || k === 'dec') { bb[v] = (bb[v] + (k === 'inc' ? 1 : N[v] - 1)) % N[v]; ui.m.save(); render(); }
        else if (k === 'slot') { d.buildSel = v; ui.m.save(); render(); }
        else if (k === 'add') { d.builds.push(DEFAULT_BUILD.slice()); d.buildSel = d.builds.length - 1; ui.m.save(); render(); }
        else if (k === 'opp') { d.cbrOpp = d.cbrOpp === 'bots' ? 'online' : 'bots'; ui.m.save(); render(); }
        else if (k === 'sq') { d.cbrSquad = CBR_SQUADS[(CBR_SQUADS.indexOf(d.cbrSquad) + 1) % CBR_SQUADS.length]; ui.m.save(); render(); }
        else if (k === 'diff') { d.diff = ((d.diff ?? 1) + 1) % DIFFS.length; ui.m.save(); render(); }
        else if (k === 'go') { if (!buildValid(bb)) return ui.toast('Сборка превышает бюджет', 'info'); const variant = d.cbrSquad === 1 ? 'cbr' : 'cbr' + d.cbrSquad;
          if (d.cbrOpp === 'online') { if (!ui.app.net || !ui.app.net.tr) { ui.toast('Сначала подключитесь к серверу', 'info'); ui.online(); return; } ui.app.net.quickMatch(variant); }
          else ui.app.startLocal(variant); } };
    };
    render();
  };
}
