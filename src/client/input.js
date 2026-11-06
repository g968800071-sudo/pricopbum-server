import { rel } from './dom.js';
// Twin-stick touch controls (floating), keyboard + mouse for desktop.
export class Input {
  constructor(el, getLayout) {
    this.el = el; this.getLayout = getLayout;
    this.move = { x: 0, y: 0 }; this.aim = { x: 0, y: 0, active: false }; this.fireHeld = false; this.tapShots = 0; this.autoFire = false;
    this.sticks = { move: null, aim: null }; this.keys = new Set(); this.mouse = { x: 0, y: 0, down: false, inside: false, used: false };
    this.enabled = true; this.leftHanded = false;
    // co-op on one phone: top half belongs to player 2 (sitting opposite, so everything is mirrored)
    this.split = false; this.p2 = { sticks: { move: null, aim: null }, move: { x: 0, y: 0 }, aim: { x: 0, y: 0, active: false }, fire: false };
    const opt = { passive: false };
    this.h = {
      down: (e) => this.onDown(e), move: (e) => this.onMove(e), up: (e) => this.onUp(e),
      kd: (e) => this.onKey(e, true), ku: (e) => this.onKey(e, false), blur: () => this.reset(), ctx: (e) => e.preventDefault(),
    };
    el.addEventListener('pointerdown', this.h.down, opt); window.addEventListener('pointermove', this.h.move, opt);
    window.addEventListener('pointerup', this.h.up, opt); window.addEventListener('pointercancel', this.h.up, opt);
    window.addEventListener('keydown', this.h.kd); window.addEventListener('keyup', this.h.ku); window.addEventListener('blur', this.h.blur);
    el.addEventListener('contextmenu', this.h.ctx);
  }
  destroy() {
    this.el.removeEventListener('pointerdown', this.h.down); window.removeEventListener('pointermove', this.h.move);
    window.removeEventListener('pointerup', this.h.up); window.removeEventListener('pointercancel', this.h.up);
    window.removeEventListener('keydown', this.h.kd); window.removeEventListener('keyup', this.h.ku); window.removeEventListener('blur', this.h.blur);
    this.el.removeEventListener('contextmenu', this.h.ctx);
  }
  reset() { const q = this.p2; q.sticks.move = q.sticks.aim = null; q.move.x = q.move.y = 0; q.aim.active = false; q.fire = false; this.sticks.move = this.sticks.aim = null; this.move.x = this.move.y = 0; this.aim.active = false; this.fireHeld = false; this.keys.clear(); this.mouse.down = false; this.autoFire = false; }
  local(e) { return rel(this.el, e); }
  onDown(e) {
    if (!this.enabled) return;
    const p = this.local(e); const L = this.getLayout();
    if (e.pointerType === 'mouse') { this.mouse.down = e.button === 0; this.mouse.used = true; this.fireHeld = this.mouse.down; e.preventDefault(); return; }
    e.preventDefault();
    if (this.split) {
      const R2 = L.stickR * 0.85, ox2 = Math.max(R2 + 8, Math.min(p.w - R2 - 8, p.x)), oy2 = Math.max(R2 + 8, Math.min(p.h - R2 - 8, p.y));
      if (p.y < p.h * 0.5) { const q = this.p2.sticks, left2 = p.x > p.w * 0.5; // player 2 is upside-down: their left is our right
        if (left2 && !q.move) q.move = { id: e.pointerId, ox: ox2, oy: oy2, x: p.x, y: p.y }; else if (!left2 && !q.aim) q.aim = { id: e.pointerId, ox: ox2, oy: oy2, x: p.x, y: p.y };
        try { this.el.setPointerCapture(e.pointerId); } catch (_) {} return; }
    }
    if (p.y < L.topSafe) return;
    let left = p.x < p.w * 0.5; if (this.leftHanded) left = !left;
    const R = L.stickR;
    const ox = Math.max(R + 8, Math.min(p.w - R - 8, p.x)), oy = Math.max(L.topSafe + R, Math.min(p.h - R - 8, p.y));
    if (left && !this.sticks.move) { this.sticks.move = { id: e.pointerId, ox, oy, x: p.x, y: p.y, t: performance.now() }; this.updMove(); }
    else if (!left && !this.sticks.aim) { this.sticks.aim = { id: e.pointerId, ox, oy, x: p.x, y: p.y, t: performance.now(), dragged: false }; this.updAim(); }
    try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
  }
  onMove(e) {
    const p = this.local(e);
    if (e.pointerType === 'mouse') { this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = p.x >= 0 && p.y >= 0 && p.x <= p.w && p.y <= p.h; return; }
    const q = this.p2.sticks;
    if (q.move && q.move.id === e.pointerId) { q.move.x = p.x; q.move.y = p.y; this.upd2('move'); e.preventDefault(); return; }
    if (q.aim && q.aim.id === e.pointerId) { q.aim.x = p.x; q.aim.y = p.y; this.upd2('aim'); e.preventDefault(); return; }
    const s = this.sticks;
    if (s.move && s.move.id === e.pointerId) { s.move.x = p.x; s.move.y = p.y; this.updMove(); e.preventDefault(); }
    else if (s.aim && s.aim.id === e.pointerId) { s.aim.x = p.x; s.aim.y = p.y; this.updAim(); e.preventDefault(); }
  }
  onUp(e) {
    if (e.pointerType === 'mouse') { if (e.button === 0) { this.mouse.down = false; this.fireHeld = false; } return; }
    const q = this.p2;
    if (q.sticks.move && q.sticks.move.id === e.pointerId) { q.sticks.move = null; q.move.x = q.move.y = 0; }
    if (q.sticks.aim && q.sticks.aim.id === e.pointerId) { q.sticks.aim = null; q.aim.active = false; q.fire = false; }
    const s = this.sticks;
    if (s.move && s.move.id === e.pointerId) { s.move = null; this.move.x = this.move.y = 0; }
    if (s.aim && s.aim.id === e.pointerId) {
      const dt = performance.now() - s.aim.t; if (!s.aim.dragged && dt < 260) this.tapShots++;
      s.aim = null; this.aim.active = false; this.fireHeld = false; this.autoFire = false;
    }
  }
  updMove() {
    const s = this.sticks.move, R = this.getLayout().stickR; let dx = s.x - s.ox, dy = s.y - s.oy; const d = Math.hypot(dx, dy);
    if (d > R) { // drag the base along (floating stick)
      s.ox += dx / d * (d - R); s.oy += dy / d * (d - R); dx = s.x - s.ox; dy = s.y - s.oy;
    }
    const k = Math.min(1, d / R); const dead = 0.12;
    if (k < dead) { this.move.x = this.move.y = 0; return; }
    const nd = Math.hypot(dx, dy) || 1, kk = Math.min(1, (k - dead) / (1 - dead) * 1.15);
    this.move.x = dx / nd * kk; this.move.y = dy / nd * kk;
  }
  updAim() {
    const s = this.sticks.aim, R = this.getLayout().stickR; let dx = s.x - s.ox, dy = s.y - s.oy; const d = Math.hypot(dx, dy);
    if (d > R) { s.ox += dx / d * (d - R); s.oy += dy / d * (d - R); dx = s.x - s.ox; dy = s.y - s.oy; }
    if (d > R * 0.28) { s.dragged = true; this.aim.x = dx / (d || 1); this.aim.y = dy / (d || 1); this.aim.active = true; if (!this.fireHeld && this.onFireStart) this.onFireStart(); this.fireHeld = true; this.autoFire = false; }
    else if (!s.dragged) { this.aim.active = false; this.fireHeld = false; this.autoFire = performance.now() - s.t > 220; }
    else { this.aim.active = true; if (!this.fireHeld && this.onFireStart) this.onFireStart(); this.fireHeld = true; }
  }
  upd2(which) {
    const q = this.p2, s = q.sticks[which], R = this.getLayout().stickR * 0.85; let dx = s.x - s.ox, dy = s.y - s.oy; const d = Math.hypot(dx, dy);
    if (d > R) { s.ox += dx / d * (d - R); s.oy += dy / d * (d - R); dx = s.x - s.ox; dy = s.y - s.oy; }
    // screen is shared and not rotated: player 2 holds the phone from the other side, so invert their stick
    const k = Math.min(1, d / R);
    if (which === 'move') { if (k < 0.12) q.move.x = q.move.y = 0; else { q.move.x = -dx / (d || 1) * k; q.move.y = -dy / (d || 1) * k; } }
    else { if (d > R * 0.25) { q.aim.x = -dx / (d || 1); q.aim.y = -dy / (d || 1); q.aim.active = true; q.fire = true; } else { q.aim.active = false; q.fire = true; } }
  }
  read2() {
    const q = this.p2, K = this.keys; let mx = q.move.x, my = q.move.y;
    const kx = (K.has('ArrowRight') ? 1 : 0) - (K.has('ArrowLeft') ? 1 : 0), ky = (K.has('ArrowDown') ? 1 : 0) - (K.has('ArrowUp') ? 1 : 0);
    if (kx || ky) { const d = Math.hypot(kx, ky); mx = kx / d; my = ky / d; }
    const keyFire = K.has('Enter') || K.has('ShiftRight') || K.has('Numpad0');
    return { mx, my, aim: q.aim.active, ax: q.aim.x, ay: q.aim.y, fire: q.fire || keyFire, auto: (q.fire && !q.aim.active) || keyFire };
  }
  holdAuto() { const s = this.sticks.aim; if (s && !s.dragged && performance.now() - s.t > 220) this.autoFire = true; return this.autoFire; }
  onKey(e, down) {
    const k = e.code; if (!this.enabled && down) return;
    const game = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyJ', 'KeyK', 'Enter', 'ShiftRight', 'Numpad0'];
    if (game.includes(k)) { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; e.preventDefault(); }
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (down && (k === 'Space' || k === 'KeyJ')) this.tapShots++;
    if (down && this.onKeyAction) this.onKeyAction(k);
  }
  // compose final input vector
  read() {
    let mx = this.move.x, my = this.move.y; const K = this.keys;
    { const S = this.sens ?? 1, m0 = Math.hypot(mx, my); if (m0 > 0) { const m1 = Math.min(1, Math.pow(m0, 1 / S) ); mx *= m1 / m0; my *= m1 / m0; } }
    const sp = this.split, kx = (K.has('KeyD') || (!sp && K.has('ArrowRight')) ? 1 : 0) - (K.has('KeyA') || (!sp && K.has('ArrowLeft')) ? 1 : 0);
    const ky = (K.has('KeyS') || (!sp && K.has('ArrowDown')) ? 1 : 0) - (K.has('KeyW') || (!sp && K.has('ArrowUp')) ? 1 : 0);
    if (kx || ky) { const d = Math.hypot(kx, ky); mx = kx / d; my = ky / d; }
    const keyFire = K.has('Space') || K.has('KeyJ');
    // r23: eased acceleration / deceleration of the move vector and interpolated aim direction (frame-rate independent)
    const now = performance.now(), dt = Math.min(0.1, ((now - (this._rt || now)) / 1000) || 0.016); this._rt = now; const sm = this.smv || (this.smv = { x: 0, y: 0, a: null });
    const kin = 1 - Math.exp(-Math.min(dt, 0.05) * ((mx || my) ? 9 : 7)); /* r26: clamp dt so a long frame can't snap */ sm.x += (mx - sm.x) * kin; sm.y += (my - sm.y) * kin; if (Math.hypot(sm.x, sm.y) < 0.02 && !mx && !my) sm.x = sm.y = 0; mx = sm.x; my = sm.y;
    let ax = this.aim.x, ay = this.aim.y; if (this.aim.active) { const A = Math.atan2(ay, ax); if (sm.a == null) sm.a = A; let d = A - sm.a; d = Math.atan2(Math.sin(d), Math.cos(d)); sm.a += d * (1 - Math.exp(-dt * 22 * (this.sens ?? 1))); ax = Math.cos(sm.a); ay = Math.sin(sm.a); } else sm.a = null;
    return { mx, my, aim: this.aim.active, ax, ay, fire: this.fireHeld || keyFire, auto: this.holdAuto() || keyFire, mouse: this.mouse };
  }
}
