// r15 economy: coins are scarce (1–3 per kill), prices are high. «Арсенал» sells spare parts, rockets, armour, medkits and
// full-tank upgrade kits for coins — in the garage (stock) and in-match (offline / bot modes only; online keeps «равные условия»).
import { h } from './dom.js';
import { icon } from './icons.js';

export const ARSENAL = [
  { id: 'part_tur', n: 'Запасная башня', d: 'Чинит сломанную башню', c: 3, pk: { type: 'part_tur' } },
  { id: 'part_gun', n: 'Запасное орудие', d: 'Чинит погнутый ствол', c: 3, pk: { type: 'part_gun' } },
  { id: 'part_trk', n: 'Запасные гусеницы', d: 'Возвращают полную скорость', c: 4, pk: { type: 'part_trk' } },
  { id: 'part_eng', n: 'Запасной двигатель', d: 'Чинит двигатель', c: 4, pk: { type: 'part_eng' } },
  { id: 'part_pl', n: 'Бронеплиты', d: 'Восстанавливают навесную броню', c: 3, pk: { type: 'part_pl' } },
  { id: 'repair', n: 'Ремкомплект', d: 'Все детали + ремонт корпуса', c: 6, pk: { type: 'repair' } },
  { id: 'med_l', n: 'Большая аптечка', d: '+80% прочности', c: 4, pk: { type: 'med_l' } },
  { id: 'armor2', n: 'Броня II', d: 'Композитная броня', c: 10, pk: { type: 'armor', tier: 2 } },
  { id: 'armor3', n: 'Броня III', d: 'Тяжёлая броня', c: 18, pk: { type: 'armor', tier: 3 } },
  { id: 'hrocket', n: 'Пакет самонаводящихся ракет', d: '10 ракет (только когда запас пуст)', c: 14, pk: { type: 'hrocket' } },
  { id: 'smoke', n: 'Дымовая шашка', d: 'Укрытие', c: 3, pk: { type: 'smoke' } },
  { id: 'drone', n: 'Боевой дрон', d: '15 с охраняет танк · 500 патронов', c: 8, pk: { type: 'drone' } },
  { id: 'ldrone', n: 'Легендарный дрон', d: '15 с охраны + сбрасывает аптечку', c: 20, pk: { type: 'ldrone' } },
  { id: 'twinr', n: 'Спаренные ракеты', d: '2 самонаводящиеся ракеты на корпусе · можно поставить ловушкой', c: 14, pk: { type: 'twinr' } },
  { id: 'mine', n: 'Мина', d: 'Ставится за танком', c: 4, pk: { type: 'mine' } },
  { id: 'kit', n: 'Полная модернизация', d: '+1 уровень ко всем 4 улучшениям · на 1 бой', c: 20, garageOnly: true },
];
export const COIN_RULES = { kill: [1, 3], brTop10: 2, brTop3: 4, brWin: 10, teamWin: 4, mobaWin: 8, classicLv: 3, onlineCapLv: 2 };

export function installEconomy(UI) {
  const P = UI.prototype;
  // purchase confirmation with clear balance → price → remainder
  P.confirmSpend = function (title, price, onYes) { const d = this.m.d, left = d.coins - price;
    this.modal([h('div', { style: 'color:#ffd23d' }, icon('coin', 40)), h('h3', null, title), h('div', { class: 'spend' }, h('div', null, h('small', null, 'Баланс'), h('b', null, '🪙 ' + d.coins)), h('div', null, h('small', null, 'Цена'), h('b', { style: 'color:#ff9a6b' }, '−' + price)), h('div', null, h('small', null, 'Останется'), h('b', { style: { color: left < 0 ? '#ff5a5a' : '#8fd46a' } }, left < 0 ? 'не хватает ' + (-left) : '🪙 ' + left))),
      left < 0 ? this.confirmBtns(['', 'no', 'Закрыть'], ['y', 'buyc', 'Купить монеты']) : this.confirmBtns(['', 'no', 'Отмена'], ['y', 'yes', 'Купить'])], (m) => { if (m === 'yes') { this.m.spend('coins', price); this.m.save(); this.app.audio.play('coin'); this.app.vibrate(25); onYes(); } else if (m === 'buyc') setTimeout(() => this.shop(), 230); });
  };
  P.arsenal = function () { const d = this.m.d, inv = d.inv || (d.inv = {});
    const row = (it) => this.card('', h('div', { style: 'width:44px;display:grid;place-items:center;color:#ffd23d' }, icon(it.id === 'kit' ? 'star' : it.id.startsWith('part') || it.id === 'repair' ? 'gear' : it.id.startsWith('armor') ? 'shield' : 'gift', 28)), [it.n, inv[it.id] ? h('span', { class: 'demo-tag', style: 'background:#3d7be0;margin-left:6px' }, 'в запасе: ' + inv[it.id]) : null], it.d,
      h('button', { class: 'btn y', onclick: () => this.confirmSpend(it.n, it.c, () => { if (it.id === 'kit') { const mb = this.m.mbx(); mb.kit = 1; } else inv[it.id] = (inv[it.id] || 0) + 1; this.m.save(); this.toast('Куплено: ' + it.n, 'check'); this.arsenal(); }) }, icon('coin', 16), String(it.c)));
    this.show('arsenal', [h('div', { class: 'menu-bg' }), this.hdr('Арсенал', this.curs(false)), h('div', { class: 'pbnote' }, '⏱ Всё в Арсенале — расходники на 1 бой: неиспользованное исчезает после боя.'), h('div', { class: 'scroll' },
      h('div', { class: 'panel' }, h('p', { class: 'note' }, 'Монеты даются за уничтожение танков (1–3 за танк) и небольшой бонус за место или победу. Купленный запас можно применить в бою через «Паузу → Арсенал» в одиночных режимах и боях с ботами. В онлайн-боях действуют «равные условия»: запас недоступен, улучшения гаража ограничены ' + COIN_RULES.onlineCapLv + '-м уровнем.')),
      ARSENAL.map(row))]);
  };
  // in-match arsenal (offline only): use stock or buy & apply instantly
  P.matchArsenal = function (session, onClose) { const d = this.m.d, inv = d.inv || (d.inv = {}), me = session.me, w = session.world;
    if (!w || session.online) { this.modal([h('h3', null, 'Арсенал'), h('p', null, 'В онлайн-боях действуют «равные условия»: покупки и запас в бою недоступны.'), this.confirmBtns(['y', 'ok', 'Понятно'])], onClose); return; }
    const apply = (it) => { if (!me || !me.alive) { this.toast('Танк уничтожен', 'close'); return false; } const ok = w.applyPickup(me, { id: -1, x: me.x, y: me.y, t: 0, life: 1, tier: 1, ...it.pk }); if (!ok) this.toast('Сейчас не нужно: ' + it.n, 'info'); else { this.app.audio.play('pick'); this.app.vibrate(20); } return ok; };
    const ov = this.modal([h('h3', null, 'Арсенал · 🪙 ' + d.coins), h('div', { class: 'arsl' }, ARSENAL.filter(x => !x.garageOnly).map(it => h('div', { class: 'arsr' }, h('div', { class: 'grow' }, h('b', null, it.n), h('small', null, it.d)),
      inv[it.id] ? h('button', { class: 'btn g', data: { m: 'use:' + it.id } }, 'Применить (' + inv[it.id] + ')') : h('button', { class: 'btn y', data: { m: 'buy:' + it.id } }, '🪙 ' + it.c)))), this.confirmBtns(['y', 'close', 'Закрыть'])],
      (m) => { const [k, id] = m.split(':'), it = ARSENAL.find(x => x.id === id); if (!it) { onClose && onClose(); return; }
        if (k === 'use') { if (apply(it)) { inv[id]--; this.m.save(); } } else if (k === 'buy') { if (d.coins < it.c) { this.toast('Не хватает монет', 'coin'); return false; } if (apply(it)) { this.m.spend('coins', it.c); this.m.save(); this.app.audio.play('coin'); } }
        setTimeout(() => this.matchArsenal(session, onClose), 230); });
    return ov;
  };
}
