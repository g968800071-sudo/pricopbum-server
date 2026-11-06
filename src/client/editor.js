// Map picker (15 themed maps with previews) and the custom map editor (mirror tool + share code).
import { h , rel } from './dom.js';
import { MAPS, genArena, EDIT_W, EDIT_H, encodeMap, decodeMap } from '../sim/maps.js';
import { T_MUD, T_SWAMP, T_EMPTY, T_BRICK, T_STEEL, T_WATER, T_BUSH, T_ICE, T_CRATE } from '../sim/defs.js';

const COL = { [T_BRICK]: '#b5623d', [T_STEEL]: '#9aa5b0', [T_WATER]: '#2d6da3', [T_BUSH]: '#2f7a2a', [T_ICE]: '#cfe8f5', [T_CRATE]: '#c08a4a', [T_MUD]: '#6b5236', [T_SWAMP]: '#3d4f2a' };
export function drawTiles(cv, m, w, hgt, ground) {
  const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); cv.style.width = w + 'px'; cv.style.height = hgt + 'px';
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = ground || (m.theme && m.theme.ground) || '#6b5e44'; g.fillRect(0, 0, w, hgt);
  const kx = w / m.w, ky = hgt / m.h;
  for (let r = 0; r < m.h; r++) for (let c = 0; c < m.w; c++) { const v = m.t[r * m.w + c], cc = COL[v]; if (cc) { g.fillStyle = cc; g.fillRect(c * kx, r * ky, Math.ceil(kx), Math.ceil(ky)); } }
  if (m.spawns) for (const [team, col] of [[0, '#5cc2ff'], [1, '#ff6b6b']]) { g.fillStyle = col; for (const [x, y] of m.spawns[team].slice(0, 5)) { g.beginPath(); g.arc(x / 8 * kx, y / 8 * ky, 2.2, 0, 7); g.fill(); } }
}
const previewCache = new Map();
function preview(i) { if (!previewCache.has(i)) previewCache.set(i, genArena(7, i, 150, 96)); return previewCache.get(i); }

export function mapPicker(ui, onPick) {
  const d = ui.m.d, cur = d.mapSel ?? -1;
  const cards = [h('button', { class: 'mapc' + (cur === -1 ? ' sel' : ''), data: { m: 'map:-1' } }, h('div', { class: 'mprev rnd' }, '?'), h('b', null, 'Случайная'))];
  MAPS.forEach((mp, i) => { const cv = h('canvas', { class: 'mprev' }); cards.push(h('button', { class: 'mapc' + (cur === i ? ' sel' : ''), data: { m: 'map:' + i } }, cv, h('b', null, mp.name))); setTimeout(() => drawTiles(cv, preview(i), 132, 84), 0); });
  if (d.customMap) { const cv = h('canvas', { class: 'mprev' }); const dm = decodeMap(d.customMap); cards.push(h('button', { class: 'mapc' + (cur === 'custom' ? ' sel' : ''), data: { m: 'map:custom' } }, cv, h('b', null, 'Своя карта'))); if (dm) setTimeout(() => drawTiles(cv, { w: dm.w, h: dm.h, t: dm.tiles }, 132, 88), 0); }
  ui.modal([h('h3', null, 'Выбор карты'), h('div', { class: 'mapgrid' }, cards), h('div', { class: 'btns' }, h('button', { class: 'btn b big', data: { m: 'editor' } }, 'Редактор карт'), h('button', { class: 'btn big', data: { m: 'close' } }, 'Закрыть'))], (a) => {
    if (a.startsWith('map:')) { const v = a.slice(4); d.mapSel = v === 'custom' ? 'custom' : +v; ui.m.save(); if (onPick) onPick(); }
    if (a === 'editor') setTimeout(() => mapEditor(ui), 240);
  }, { dismiss: true });
}

export function mapEditor(ui) {
  const d = ui.m.d, W = EDIT_W, H = EDIT_H; const dm = d.customMap && decodeMap(d.customMap);
  const tiles = dm && dm.w === W && dm.h === H ? dm.tiles.slice() : new Uint8Array(W * H);
  let tool = T_BRICK, mirror = true, dirty = false;
  const vw = Math.min(320, (ui.root.clientWidth || 360) - 84), vh = Math.round(vw * H / W), cv = h('canvas', { class: 'edcv' });
  const redraw = () => { drawTiles(cv, { w: W, h: H, t: tiles }, vw, vh, '#6b5e44'); const g = cv.getContext('2d'); g.fillStyle = 'rgba(92,194,255,0.18)'; g.fillRect(0, 0, vw * 6 / W, vh); g.fillStyle = 'rgba(255,107,107,0.18)'; g.fillRect(vw - vw * 6 / W, 0, vw * 6 / W, vh);
    if (mirror) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(vw / 2, 0); g.lineTo(vw / 2, vh); g.stroke(); g.setLineDash([]); } };
  const paint = (e) => { const q = rel(cv, e), r = { left: 0, top: 0, width: q.w, height: q.h }; e = { clientX: q.x, clientY: q.y }; const c = Math.floor((e.clientX - r.left) / r.width * W), rr = Math.floor((e.clientY - r.top) / r.height * H); if (c < 0 || rr < 0 || c >= W || rr >= H) return;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const cc = c + dx, ry = rr + dy; if (cc >= W || ry >= H) continue; tiles[ry * W + cc] = tool; if (mirror) tiles[ry * W + (W - 1 - cc)] = tool; } dirty = true; redraw(); };
  let down = false; cv.onpointerdown = (e) => { down = true; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} paint(e); }; cv.onpointermove = (e) => { if (down) paint(e); }; cv.onpointerup = cv.onpointercancel = () => { down = false; };
  const TOOLS = [[T_BRICK, 'Кирпич'], [T_STEEL, 'Сталь'], [T_WATER, 'Вода'], [T_BUSH, 'Кусты'], [T_ICE, 'Лёд'], [T_CRATE, 'Ящик'], [T_MUD, 'Грязь'], [T_SWAMP, 'Болото'], [T_EMPTY, 'Ластик']];
  const tb = h('div', { class: 'edtools' }, TOOLS.map(([v, n]) => h('button', { class: 'edt' + (v === tool ? ' sel' : ''), data: { m: 'tool:' + v } }, h('i', { style: { background: COL[v] || 'transparent' } }), n)));
  const mirBtn = h('button', { class: 'opt sel', data: { m: 'mirror' } }, h('small', null, 'Зеркало'), 'Вкл');
  const codeIn = h('input', { class: 'edcode', placeholder: 'Код карты: P1-60x40-…', spellcheck: false });
  const save = () => { d.customMap = encodeMap(tiles, W, H); d.mapSel = 'custom'; ui.m.save(); dirty = false; return d.customMap; };
  ui.modal([h('h3', null, 'Редактор карт'), h('p', { class: 'edhint' }, 'Рисуй пальцем. Синие и красные полосы — зоны появления (оставь их свободными). Зеркало делает карту честной для обеих сторон.'), cv, tb,
    h('div', { class: 'optsbar' }, mirBtn, h('button', { class: 'opt', data: { m: 'clear' } }, h('small', null, 'Поле'), 'Очистить'), h('button', { class: 'opt', data: { m: 'rand' } }, h('small', null, 'Шаблон'), 'Случайный')),
    codeIn, h('div', { class: 'btns' }, h('button', { class: 'btn b', data: { m: 'share' } }, 'Поделиться кодом'), h('button', { class: 'btn', data: { m: 'load' } }, 'Загрузить код')),
    h('div', { class: 'btns' }, h('button', { class: 'btn y big', data: { m: 'duel' } }, '▶ Дуэль на этой карте'), h('button', { class: 'btn big', data: { m: 'save' } }, 'Сохранить и закрыть'))], (a, b) => {
    if (a.startsWith('tool:')) { tool = +a.slice(5); for (const e of tb.children) e.classList.toggle('sel', e === b); return false; }
    if (a === 'mirror') { mirror = !mirror; mirBtn.lastChild.textContent = mirror ? 'Вкл' : 'Выкл'; mirBtn.classList.toggle('sel', mirror); redraw(); return false; }
    if (a === 'clear') { tiles.fill(T_EMPTY); redraw(); return false; }
    if (a === 'rand') { const m = genArena((Math.random() * 1e6) | 0, (Math.random() * MAPS.length) | 0, W, H); tiles.set(m.t); redraw(); return false; }
    if (a === 'share') { const code = save(); codeIn.value = code; codeIn.select(); try { navigator.clipboard && navigator.clipboard.writeText(code).then(() => ui.toast('Код скопирован — отправь другу', 'star'), () => ui.toast('Скопируй код из поля', 'star')); } catch (_) { ui.toast('Скопируй код из поля', 'star'); } return false; }
    if (a === 'load') { const dd = decodeMap(codeIn.value); if (!dd || dd.w !== W || dd.h !== H) { ui.toast('Неверный код карты', 'star'); return false; } tiles.set(dd.tiles); redraw(); ui.toast('Карта загружена', 'star'); return false; }
    if (a === 'save') { save(); ui.toast('Карта сохранена', 'star'); if (ui.screen === 'menu') ui.refreshOpts(); }
    if (a === 'duel') { save(); ui.app.startLocal('duel', { custom: d.customMap }); }
  }, { dismiss: false });
  setTimeout(redraw, 0);
}
