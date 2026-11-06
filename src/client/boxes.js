// r16: ящики, «Шансы», мифический магазин и виртуализированный каталог предметов (2750 шт.)
import { h } from './dom.js';
import { icon } from './icons.js';
import { MODELS } from '../sim/models.js';
import { eur, locName, catalog, RAR, SLOTS, BOXES, DUPE, openBox, paidBoxesAllowed, itemIcon, drawItem, sources, vlist, STAT_V } from './catalog.js';
const slotN = Object.fromEntries(SLOTS);
const statN = { dmg: 'урон', rel: 'перезарядка', hp: 'прочность', arm: 'броня', acc: 'разгон', spd: 'скорость', view: 'обзор' };
export function installBoxes(UI) { const P = UI.prototype;
  P.itemDesc = function (it) { return RAR[it.rar].n + ' · ' + slotN[it.slot] + (it.stat ? ' · +' + (it.sv * 100).toFixed(1) + '% ' + statN[it.stat] : ' · косметика') + (it.fx ? ' · эффект: ' + it.fx : ''); };
  P.boxes = function () { const d = this.m.d, bx = d.boxes || (d.boxes = { c: 1, r: 0, e: 0, l: 0 }), paid = paidBoxesAllowed(d);
    const row = (B) => this.card('', h('div', { class: 'boxart', style: { background: 'radial-gradient(circle,' + B.col + ',#151a22 70%)' } }, icon('gift', 30)), [B.n, h('span', { class: 'own-tag' }, '× ' + (bx[B.id] || 0))],
      'Шансы: ' + B.odds.map((o, k) => o ? RAR[k].n.slice(0, 3) + '. ' + o + '%' : null).filter(Boolean).join(' · '),
      h('div', { class: 'col' }, h('button', { class: 'btn y', disabled: !(bx[B.id] > 0), data: { bx: 'open', v: B.id } }, 'Открыть'), paid ? h('button', { class: 'btn b', data: { bx: 'buy', v: B.id } }, eur(B.rub), h('span', { class: 'demo-tag' }, 'ДЕМО')) : null));
    const s = this.show('boxes', [h('div', { class: 'menu-bg' }), this.hdr('Ящики', h('span', { class: 'cur' }, '💠 ' + (d.shards || 0))), h('div', { class: 'scroll' },
      h('div', { class: 'panel' }, h('p', { class: 'note' }, 'Ящики выдаются за победы, ежедневный бонус и путь наград. Легендарные предметы — только из ящиков или за реальные деньги. Мифические в ящиках не выпадают.'),
        paid ? null : h('p', { class: 'note', style: 'color:#ff9a6b' }, 'В вашем регионе платные ящики недоступны — их можно только заработать в игре.'),
        h('button', { class: 'btn', data: { bx: 'odds' } }, 'Шансы'), ' ', h('button', { class: 'btn', disabled: (d.shards || 0) < 100, data: { bx: 'craft' } }, '100 💠 → Редкий ящик')),
      BOXES.map(row))]);
    s.addEventListener('click', (e) => { const b = e.target.closest('[data-bx]'); if (!b) return; const a = b.dataset.bx, v = b.dataset.v; this.app.audio.play('click');
      if (a === 'odds') this.oddsModal(); else if (a === 'craft') { d.shards -= 100; bx.r = (bx.r || 0) + 1; this.m.save(); this.boxes(); }
      else if (a === 'buy') { const B = BOXES.find(x => x.id === v); this.demoPurchase({ title: B.n, price: eur(B.rub), desc: 'IAP: box_' + B.id }, (ok) => { if (ok) { bx[v] = (bx[v] || 0) + 1; this.m.save(); this.boxes(); } }); }
      else if (a === 'open' && bx[v] > 0) { bx[v]--; const r = openBox(d, v); if (r.rar === 3 && Math.random() < 0.3) { const L = MODELS.filter(m => m.rar === 3 && !(d.models || []).includes(m.id)); if (L.length) { const m = L[Math.floor(Math.random() * L.length)]; (d.models || (d.models = [])).push(m.id); this.toast('Легендарный танк: ' + m.name, 'star'); } } this.m.save(); this.boxAnim(BOXES.find(x => x.id === v), r, () => this.boxes()); } }); };
  P.oddsModal = function () { this.modal([h('h3', null, 'Шансы выпадения'), h('table', { class: 'odds' }, h('tr', null, h('th', null, ''), RAR.slice(0, 4).map(r => h('th', { style: { color: r.c } }, r.n))), BOXES.map(B => h('tr', null, h('td', null, B.n), B.odds.map(o => h('td', null, o + '%'))))),
    h('p', { class: 'note' }, 'Повтор: ' + DUPE.map((x, k) => RAR[k].n + ' → ' + x.shards + ' 💠 + ' + x.coins + ' 🪙').join('; ') + '. Мифические предметы (250) из ящиков не выпадают — только в «Мифическом магазине».'), this.confirmBtns(['y', 'ok', 'Понятно'])]); };
  // opening animation: shake → light burst → reveal card in rarity colour
  P.boxAnim = function (B, r, done) { const cv = h('canvas', { class: 'boxcv' }); cv.width = 520; cv.height = 520; const lbl = h('div', { class: 'boxlbl' }, ''); const ov = this.modal([cv, lbl, this.confirmBtns(['y', 'ok', 'Забрать'])], () => { cancelAnimationFrame(raf); done && done(); }, { dismiss: false });
    const g = cv.getContext('2d'), col = RAR[r.rar].c, t0 = performance.now(); let raf = 0; this.app.audio.play('coin');
    const loop = () => { const t = (performance.now() - t0) / 1000; g.clearRect(0, 0, 520, 520); g.save(); g.translate(260, 260);
      if (t < 1.4) { const sh = Math.sin(t * 40) * t * 8; g.rotate(sh * 0.01); g.fillStyle = B.col; g.fillRect(-90 + sh, -70, 180, 140); g.fillStyle = '#0006'; g.fillRect(-90 + sh, -14, 180, 28); g.fillStyle = '#fff8'; g.fillRect(-12 + sh, -70, 24, 140); }
      else { const k = Math.min(1, (t - 1.4) / 0.5); for (let i = 0; i < 16; i++) { g.rotate(0.3927); g.fillStyle = col + '44'; g.beginPath(); g.moveTo(0, 0); g.lineTo(260 * k, -20); g.lineTo(260 * k, 20); g.fill(); }
        g.rotate(-t * 0.2); g.setTransform(1, 0, 0, 1, 260, 260); const S = 200 * (0.6 + 0.4 * k); g.translate(-S / 2, -S / 2); drawItem(g, r.it, S, t);
        if (!lbl.textContent) { lbl.textContent = (r.dupe ? 'Повтор: ' : '') + locName(r.it) + ' — ' + RAR[r.rar].n + (r.dupe ? ' → +' + r.conv.shards + ' 💠 +' + r.conv.coins + ' 🪙' : ''); lbl.style.color = col; this.app.audio.play(r.rar >= 3 ? 'levelup' : 'pick'); } }
      g.restore(); if (ov.isConnected) raf = requestAnimationFrame(loop); }; loop(); };
  // мифический магазин
  P.mythShop = function () { const C = catalog(), M = C.filter(x => x.rar === 4), d = this.m.d, own = new Set(d.items || []), day = Math.floor(Date.now() / 864e5), feat = M[day % M.length];
    const preview = (it) => { const cv = h('canvas'); cv.width = cv.height = 300; let raf = 0; const t0 = performance.now(); const ov = this.modal([cv, h('h3', { style: { color: RAR[4].c } }, locName(it)), h('p', null, this.itemDesc(it)), h('p', { class: 'note' }, 'Только за реальные деньги · ID покупки: ' + it.iap + ' · в рейтинговых и онлайн-боях бонус отключён (равные условия)'),
      own.has(it.id) ? this.confirmBtns(['', 'no', 'Уже есть']) : this.confirmBtns(['', 'no', 'Закрыть'], ['b', 'buy', eur(it.rub) + ' · навсегда'])], (m) => { cancelAnimationFrame(raf); if (m === 'buy') this.demoPurchase({ title: locName(it), price: eur(it.rub) + ' · навсегда', desc: 'IAP: ' + it.iap }, (ok) => { if (ok) { (d.items || (d.items = [])).push(it.id); this.m.save(); /* r37: real-money mythic = forever */ this.toast('Получено: ' + locName(it), 'check'); this.mythShop(); } }); });
      const g = cv.getContext('2d'); const lp = () => { drawItem(g, it, 300, (performance.now() - t0) / 1000); if (ov.isConnected) raf = requestAnimationFrame(lp); }; lp(); };
    const bundles = [0, 1, 2].map(k => { const items = M.slice((day * 3 + k * 5) % 245, (day * 3 + k * 5) % 245 + 5); return { n: ['Набор «Пламя»', 'Набор «Космос»', 'Набор «Лёд»'][k], items, rub: Math.round(items.reduce((a, b) => a + b.rub, 0) * 0.6 / 10) * 10 - 1, iap: 'mythic_bundle_' + k }; });
    const row = (it) => { const el = h('div', { class: 'card vrow' + (own.has(it.id) ? ' owned' : ''), data: { mi: String(it.id) } }, itemIcon(it, 44), h('div', { class: 'grow' }, h('div', { class: 'ttl', style: { color: RAR[4].c } }, locName(it)), h('div', { class: 'ds' }, this.itemDesc(it))), h('b', null, own.has(it.id) ? '✓' : eur(it.rub) + ' · навсегда')); return el; };
    const s = this.show('myth', [h('div', { class: 'menu-bg' }), this.hdr('Мифический магазин'), h('div', { class: 'scroll' },
      h('div', { class: 'panel myth' }, h('div', { class: 'demo-tag' }, 'Только за реальные деньги'), h('h3', null, 'Предложение дня'), h('div', { class: 'card', data: { mi: String(feat.id) } }, itemIcon(feat, 64), h('div', { class: 'grow' }, h('div', { class: 'ttl' }, locName(feat)), h('div', { class: 'ds' }, this.itemDesc(feat))), h('b', null, eur(feat.rub)))),
      bundles.map((b, k) => h('div', { class: 'card', data: { mb: String(k) } }, h('div', { class: 'row' }, b.items.map(it => itemIcon(it, 30))), h('div', { class: 'grow' }, h('div', { class: 'ttl' }, b.n + ' · 5 мифических'), h('div', { class: 'ds' }, 'Скидка 40% · ' + b.iap)), h('b', null, eur(b.rub)))),
      h('p', { class: 'note' }, 'Все 250 мифических предметов (бонус максимум +5% к легендарному, в рейтинге отключён):'), vlist(M, 64, row, 380))]);
    s.addEventListener('click', (e) => { const a = e.target.closest('[data-mi]'), b = e.target.closest('[data-mb]'); if (a) preview(C[+a.dataset.mi]); else if (b) { const B = bundles[+b.dataset.mb]; this.demoPurchase({ title: B.n, price: eur(B.rub), desc: 'IAP: ' + B.iap }, (ok) => { if (ok) { for (const it of B.items) if (!own.has(it.id)) (d.items || (d.items = [])).push(it.id); this.m.save(); /* r20: coin purchases are one-match */ this.mythShop(); } }); } }); };
  // каталог: поиск, фильтры, сортировка, виртуализация
  P.catalogScr = function (st) { st = st || this._catSt || (this._catSt = { q: '', slot: '', rar: -1, own: 0, sort: 'rar' }); const C = catalog(), d = this.m.d, own = new Set(d.items || []), eq = d.itemEq || (d.itemEq = {});
    let list = C.filter(it => (!st.q || locName(it).toLowerCase().includes(st.q.toLowerCase())) && (!st.slot || it.slot === st.slot) && (st.rar < 0 || it.rar === st.rar) && (!st.own || own.has(it.id)));
    const so = { rar: (a, b) => b.rar - a.rar || a.id - b.id, name: (a, b) => a.name.localeCompare(b.name, 'ru'), slot: (a, b) => a.slot.localeCompare(b.slot) || b.rar - a.rar, power: (a, b) => b.sv - a.sv || b.rar - a.rar }; list.sort(so[st.sort]);
    const row = (it) => { const o = own.has(it.id), on = eq[it.slot] === it.id; return h('div', { class: 'card vrow' + (o ? ' owned' : ''), data: { ci: String(it.id) } }, itemIcon(it, 44), h('div', { class: 'grow' }, h('div', { class: 'ttl', style: { color: RAR[it.rar].c } }, locName(it)), h('div', { class: 'ds' }, this.itemDesc(it))),
      on ? h('b', null, '✓ Установлено') : o ? h('button', { class: 'btn', data: { ce: String(it.id) } }, 'Установить') : it.rar <= 2 ? h('button', { class: 'btn y', data: { cb: String(it.id) } }, '🪙 ' + it.price + ' · на 1 бой') : h('button', { class: 'btn ' + (it.rar === 4 ? 'b' : ''), data: { cinfo: String(it.id) } }, it.rar === 4 && it.rub ? eur(it.rub) + ' · навсегда' : 'Как получить')); };
    const inp = h('input', { id: 'catq', class: 'inp', placeholder: 'Поиск по 2750 предметам…', value: st.q });
    const sel = (k, opts) => h('select', { class: 'inp', data: { k } }, opts.map(([v, n]) => { const o = h('option', { value: String(v) }, n); if (String(st[k]) === String(v)) o.selected = true; return o; }));
    const vl = vlist(list, 64, row, 420);
    const s = this.show('catalog', [h('div', { class: 'menu-bg' }), this.hdr('Каталог', this.curs(false)), h('div', { class: 'scroll' }, h('div', { class: 'panel catf' }, inp,
      sel('slot', [['', 'Все слоты'], ...SLOTS]), sel('rar', [[-1, 'Любая редкость'], ...RAR.map((r, k) => [k, r.n])]), sel('own', [[0, 'Все'], [1, 'Мои']]), sel('sort', [['rar', 'По редкости'], ['power', 'По силе'], ['name', 'По имени'], ['slot', 'По слоту']]),
      h('div', { class: 'note' }, 'Найдено: ' + list.length + ' · у вас: ' + own.size + ' · бонусы действуют только в офлайн-боях')), vl)]);
    let tm = 0; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.q = inp.value; this.catalogScr(st); }, 250); });
    for (const se of s.querySelectorAll('select')) se.addEventListener('change', () => { const k = se.dataset.k; st[k] = k === 'rar' || k === 'own' ? +se.value : se.value; this.catalogScr(st); });
    s.addEventListener('click', (e) => { const rw = e.target.closest('[data-ci]'); if (rw && !e.target.closest('button')) { const bt = rw.querySelector('button'); if (bt) { bt.click(); return; } } // r37: the whole row is tappable
      const ib = e.target.closest('[data-cinfo]'); if (ib) { const it = C[+ib.dataset.cinfo]; this.app.audio.play('click'); // r36: legendary/mythic rows open a sheet
        this.modal([itemIcon(it, 64), h('h3', { style: { color: RAR[it.rar].c } }, locName(it)), h('p', null, this.itemDesc(it)), h('p', { class: 'note' }, 'Где получить: ' + sources(it).join(' · ')), it.rar === 4 ? h('p', { class: 'note' }, 'Мифические — только за реальные деньги, навсегда') : null,
          this.confirmBtns(['', 'no', 'Закрыть'], ['', 'boxes', 'К ящикам'], it.rar === 4 ? ['b', 'buy', (it.rub ? eur(it.rub) : 'недоступно') + ' · навсегда'] : ['b', 'myth', 'Мифический магазин'])], (m) => {
          if (m === 'boxes') setTimeout(() => this.boxes(), 230); else if (m === 'myth') setTimeout(() => this.mythShop(), 230);
          else if (m === 'buy') this.demoPurchase({ title: locName(it), price: eur(it.rub) + ' · навсегда', desc: 'IAP: ' + it.iap }, (ok) => { if (ok) { (d.items || (d.items = [])).push(it.id); this.m.save(); this.toast('Получено навсегда: ' + locName(it), 'check'); this.catalogScr(st); } }); }); return; }
      const b = e.target.closest('[data-cb],[data-ce]'); if (!b) return; const it = C[+(b.dataset.cb || b.dataset.ce)];
      if (b.dataset.ce) { eq[it.slot] = it.id; this.m.save(); this.app.audio.play('pick'); const top = vl.scrollTop; this.catalogScr(st); const nv = this.el.querySelector('.scr[data-name=catalog] .vlist'); if (nv) { nv.scrollTop = top; nv._draw(); } }
      else this.confirmSpend(locName(it), it.price, () => { (d.items || (d.items = [])).push(it.id); (d.itemsTmp || (d.itemsTmp = [])).push(it.id); this.m.save(); /* r20: coin purchases are one-match */ this.catalogScr(st); }); }); };
}
// ownership rules (used by tests): legendary never purchasable with coins/gems; mythic never from boxes
export function rulesOk() { const C = catalog(); return C.every(it => it.rar === 4 ? it.iap && !it.price : it.rar === 3 ? it.iap && !it.price : it.price > 0) && BOXES.every(b => b.odds.length === 4 && b.odds.reduce((a, c) => a + c, 0) === 100) && STAT_V[0] === 0 && STAT_V[3] <= 0.1 + 1e-9 && STAT_V[4] <= 0.2 + 1e-9; }
