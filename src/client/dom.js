// Tiny DOM builder: structure is code, text is always textContent. No HTML strings anywhere.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
    else if (k === 'data') { for (const d in v) if (v[d] != null) el.dataset[d] = v[d]; }
    else if (k === 'vars') { for (const d in v) el.style.setProperty(d, v[d]); }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el[k] = v;
  }
  add(el, kids); return el;
}
function add(el, kids) { for (const c of kids) { if (c == null || c === false || c === '') continue; if (Array.isArray(c)) add(el, c); else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); } }
export function fill(el, ...kids) { el.replaceChildren(); add(el, kids); return el; }
export const br = () => document.createElement('br');

// r22: rotation-aware pointer position relative to an element (game root may be CSS-rotated 90° clockwise for forced orientation)
export const ROT = { on: false };
export function rel(el, e) { const r = el.getBoundingClientRect(); if (!ROT.on) return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; return { x: e.clientY - r.top, y: r.right - e.clientX, w: r.height, h: r.width }; }
