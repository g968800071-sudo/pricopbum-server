// Screen-space HUD on the game canvas.
import { GMODS } from '../sim/gmods.js';
import { tr } from './i18n.js';
import { RADAR_R, RADAR_CLOSE, RADAR_SHOT, RADAR_MOD, TIERS, armorMax, WEAPONS, MODS, teamColor, teamTag, CELL, T_WATER, T_STEEL, T_BRICK, T_BUSH } from '../sim/defs.js';
import { roundRect, drawIcon, skinColors } from './render.js';
const TAU = Math.PI * 2;
const F = (px) => px + 'px "Russo One", system-ui, "Noto Sans Georgian", "Noto Sans Armenian", "Sylfaen", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif';

export class Hud {
  constructor() { this.banners = []; this.feed = []; this.notes = []; this.noteQ = []; this.dmgDirs = []; this.mini = null; this.miniVer = -1; this.t = 0; }
  banner(text, sub, color = '#fff', dur = 1.6, big = true) { text = tr(text); sub = sub && tr(sub); if (big) this.banners = this.banners.filter(b => !b.big); this.banners.push({ text, sub, color, t: 0, dur, big }); if (this.banners.length > 3) this.banners.shift(); }
  noteLife() { return 4; }
  addFeed(f, meId) { this.feed.push({ ...f, t: 0, mine: f.kid === meId, me: f.vid === meId }); if (this.feed.length > (this.chatMode === 0 ? 5 : 3)) this.feed.shift(); }
  note(text, color = '#fff', chat = false) { text = tr(text); // r28: translate before layout/ellipsis so cut lines never stay Russian
    if (!text || (chat && chat !== 'pick' && this.chatMode === 2)) return;
    if (chat === 'pick') { /* r35: pickups — one short (1.6 s), small, semi-transparent line at the top-left edge; repeated pickups merge into it */ const pk = this.notes.find(x => x.pick); if (pk) { if (pk.text === text) pk.n = (pk.n || 1) + 1; else { pk.more = (pk.more || 0) + 1; pk.text = text; pk.color = color; pk.n = 1; } pk.t = Math.min(pk.t, 0.15); return; } this.notes.unshift({ text, color, t: 0, pick: true, life: 1.6 }); return; }
    const same = this.notes.find(n => n.text === text); if (same) { same.t = Math.min(same.t, 0.2); same.n = (same.n || 1) + 1; return; }
    if (this.noteQ.some(n => n.text === text)) return; this.noteQ.push({ text, color, t: 0, chat }); if (this.noteQ.length > 4) this.noteQ.shift();
  }
  damageFrom(angle) { this.dmgDirs.push({ a: angle, t: 0 }); if (this.dmgDirs.length > 6) this.dmgDirs.shift(); }
  step(dt) {
    this.t += dt;
    for (let i = this.banners.length - 1; i >= 0; i--) { this.banners[i].t += dt; if (this.banners[i].t > this.banners[i].dur) this.banners.splice(i, 1); }
    for (let i = this.feed.length - 1; i >= 0; i--) { this.feed[i].t += dt; if (this.feed[i].t > (this.chatMode === 0 ? 6 : 4)) this.feed.splice(i, 1); }
    for (let i = this.notes.length - 1; i >= 0; i--) { this.notes[i].t += dt; if (this.notes[i].t > (this.notes[i].life || this.noteLife())) this.notes.splice(i, 1); }
    this.noteGap = (this.noteGap || 0) - dt; if (this.noteQ.length && this.notes.length < 3 && this.noteGap <= 0) { this.notes.push(this.noteQ.shift()); this.noteGap = 0.18; }
    for (let i = this.dmgDirs.length - 1; i >= 0; i--) { this.dmgDirs[i].t += dt; if (this.dmgDirs[i].t > 0.9) this.dmgDirs.splice(i, 1); }
  }
  buildMini(m, mode) {
    const s = 96, cv = document.createElement('canvas'); cv.width = cv.height = s * 2; const g = cv.getContext('2d');
    const kx = cv.width / m.w, ky = cv.height / m.h;
    g.fillStyle = m.under ? '#141210' : mode === 'team' ? '#5d4f35' : '#2d3823'; g.fillRect(0, 0, cv.width, cv.height);
    const col = m.under ? { 0: '#7a6650', 10: '#ffb347' } : { [T_WATER]: '#2d6da3', [T_STEEL]: '#9aa5b0', [T_BRICK]: '#a0583a', [T_BUSH]: '#2f6b2a', 11: '#c9c4b8', 8: '#5a4630', 9: '#3d4f2a', 10: '#ffb347', 12: '#b5603f', 13: '#8a6238', 14: '#1f4a1f', 15: '#2a1c0e' };
    const step = Math.max(1, Math.floor(m.w / cv.width));
    for (let r = 0; r < m.h; r += step) for (let c = 0; c < m.w; c += step) { const v = m.t[r * m.w + c]; const cc = col[v]; if (cc) { g.fillStyle = cc; g.fillRect(c * kx, r * ky, Math.max(1, kx * step), Math.max(1, ky * step)); } }
    this.mini = cv; this.miniMap = m;
  }
  draw(g, view, me, layout, cam, extra) {
    const W = layout.W, H = layout.H, mode = view.mode, t = this.t;
    g.save();
    if (me && me.blindT > 0) { g.fillStyle = 'rgba(255,251,232,' + Math.min(0.88, me.blindT * 0.45) + ')'; g.fillRect(0, 0, W, H); } // r36 «Вспышка»: flare blinds hunters
    if (me && me.snareT > 0) { g.strokeStyle = 'rgba(255,77,216,0.5)'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8); }
    if (me && me.empT > 0) { g.fillStyle = 'rgba(93,240,255,' + (0.06 + Math.random() * 0.08) + ')'; for (let k = 0; k < 6; k++) g.fillRect(0, Math.random() * H, W, 2 + Math.random() * 6); }
    // r15: low-HP red vignette (pulses) and a hit-marker cross in the centre when our shell connects
    if (me && me.alive && me.hp < me.maxHp * 0.35) { const k = (1 - me.hp / (me.maxHp * 0.35)) * (0.55 + 0.2 * Math.sin(t * 6)); const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72); vg.addColorStop(0, 'rgba(255,0,0,0)'); vg.addColorStop(1, 'rgba(200,0,20,' + (0.5 * k).toFixed(3) + ')'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    if (this.hitT > 0) { this.hitT -= 1 / 60; const cx = W / 2, cy = layout.vp.y + layout.vp.h / 2, a = Math.min(1, this.hitT * 8); g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.lineWidth = 2; g.beginPath(); for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(cx + dx * 6, cy + dy * 6); g.lineTo(cx + dx * 12, cy + dy * 12); } g.stroke(); }
    // top gradient
    const tg = g.createLinearGradient(0, 0, 0, 70); tg.addColorStop(0, 'rgba(0,0,0,0.55)'); tg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = tg; g.fillRect(0, 0, W, 70);
    const top = layout.safeTop + 8;
    if (mode === 'br') this.drawBRTop(g, view, me, W, top);
    else if (mode === 'team' && (view.special === 'survival' || view.special === 'zombie')) this.drawWaveTop(g, view, me, W, top);
    else if (mode === 'team' && view.special === 'race') this.drawRaceTop(g, view, me, W, top);
    else if (mode === 'team') { this.drawTeamTop(g, view, me, W, top); if (view.boss) this.drawBossBar(g, view.boss, W, top + 40); }
    else this.drawClassicTop(g, view, me, W, top, layout);
    if (view.underground) { const t = this.t, bw = 150, bx = W / 2 - bw / 2, by = top + 58; g.save(); g.fillStyle = 'rgba(40,24,8,0.72)'; roundRect(g, bx, by, bw, 24, 12); g.fill(); g.strokeStyle = 'rgba(255,179,71,' + (0.6 + Math.sin(t * 3) * 0.3) + ')'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#ffcf8a'; g.font = '800 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('▼ ПОДЗЕМЕЛЬЕ', W / 2, by + 12); g.restore(); }
    if (me && mode !== 'classic' && mode !== 'br' && me.lives != null && !['race', 'moba', 'survival', 'zombie'].includes(view.special)) { g.save(); g.font = '800 13px system-ui, sans-serif'; const tx = '♥×' + Math.max(0, me.lives); g.fillStyle = 'rgba(20,10,16,0.7)'; roundRect(g, 10, top + 60, 52, 22, 11); g.fill(); g.fillStyle = '#ff6b8a'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(tx, 18, top + 71); g.restore(); } // r27: lives in every respawn mode
    if (me && me.gm && me.gm.length && mode !== 'classic') this.drawModPanel(g, me, layout, top);
    this.leftCol = layout.leftCol; this.noteTop = layout.noteTop; this.noteW = layout.noteW; this.boxes = []; // r28: canvas HUD boxes for the layout/overlap test
    if (mode !== 'classic') { const M = layout.mm || { x: W - 104 - (layout.sr || 0), y: top + 34, s: layout.land ? 84 : 96 }; this.drawMinimap(g, view, me, M.x, M.y, M.s, cam); }
    if (mode !== 'classic') { const ms = layout.land ? 84 : 96; const M = layout.mm || { x: W - 104 - (layout.sr || 0), y: top + 34, s: ms }; this.boxes.push({ n: 'minimap', x: M.x, y: M.y, w: M.s, h: M.s }); }
    this.squad = view.squad || 1; this.race = view.special === 'race'; this.drawFeed(g, 10, top + (mode === 'classic' ? 0 : view.special === 'race' ? 48 + Math.min(4, view.tanks.length) * 15 : 40), mode);
    // damage direction arcs
    if (me) for (const d of this.dmgDirs) { const k = 1 - d.t / 0.9, cx = layout.vp.x + layout.vp.w / 2, cy = layout.vp.y + layout.vp.h / 2; g.strokeStyle = 'rgba(255,50,50,' + 0.8 * k + ')'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 70, d.a - 0.35, d.a + 0.35); g.stroke(); }
    // zone direction arrow
    if (mode === 'br' && !view.ffa && me && me.alive && view.zone) {
      const z = view.zone, dx = z.cx - me.x, dy = z.cy - me.y, d = Math.hypot(dx, dy);
      if (d > z.r - 20) { const a = Math.atan2(dy, dx), cx = W / 2 + Math.cos(a) * Math.min(W, H) * 0.32, cy = layout.vp.y + layout.vp.h / 2 + Math.sin(a) * Math.min(W, H) * 0.32; g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = 'rgba(230,140,255,' + (0.7 + 0.3 * Math.sin(t * 6)) + ')'; g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -10); g.lineTo(-3, 0); g.lineTo(-8, 10); g.closePath(); g.fill(); g.restore(); }
    }
    // bottom: hp + weapon
    if (me && me.alive) this.drawBottom(g, view, me, layout, extra);
    // sticks
    this.drawSticks(g, layout, extra.input, extra);
    // banners
    let by = layout.bannerY || layout.vp.y + Math.max(96, layout.vp.h * 0.15); // r22: keep banners above the player's tank
    for (const b of this.banners) {
      const k = b.t / b.dur, a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1, sc = k < 0.12 ? 1.6 - 0.6 * (k / 0.12) : 1;
      g.save(); g.globalAlpha = a; g.translate(W / 2, by); g.scale(sc, sc); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = F(b.big ? 30 : 18); { const mw = g.measureText(b.text).width; const bw = layout.bannerW || W - 24; if (mw > bw) g.scale(bw / mw, bw / mw); } g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(b.text, 0, 0);
      const gr = g.createLinearGradient(0, -18, 0, 18); gr.addColorStop(0, '#fff'); gr.addColorStop(1, b.color); g.fillStyle = gr; g.fillText(b.text, 0, 0);
      if (b.sub) { g.font = F(14); g.lineWidth = 4; g.strokeText(b.sub, 0, b.big ? 30 : 22); g.fillStyle = '#e8e8e8'; g.fillText(b.sub, 0, b.big ? 30 : 22); }
      g.restore(); by += b.big ? 70 : 44;
    }
    g.restore();
  }
  pill(g, x, y, w, h, fill = 'rgba(10,14,20,0.62)') { g.fillStyle = fill; roundRect(g, x, y, w, h, h / 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke(); }
  drawBRTop(g, view, me, W, top) {
    g.textBaseline = 'middle'; g.textAlign = 'left';
    this.pill(g, 10, top, 82, 28); g.fillStyle = '#ffd23d'; personIcon(g, 26, top + 14); g.font = F(15); g.fillStyle = '#fff'; g.fillText(String(view.aliveCount), 40, top + 15);
    this.pill(g, 98, top, 70, 28); g.fillStyle = '#ff6b6b'; skullIcon(g, 114, top + 14); g.fillStyle = '#fff'; g.fillText(String(me ? me.kills : 0), 128, top + 15);
    if (me && !view.ffa) { this.pill(g, 174, top, 64, 28); g.fillStyle = '#ff6b8a'; g.font = F(15); g.fillText('♥×' + (me.lives ?? 3), 184, top + 15); } // r26: lives counter
    if (view.ffa) { const left = Math.max(0, (view.timeLimit || 300) - view.time), rank = view.tanks.slice().sort((a, b) => b.kills - a.kills).findIndex(t => me && t.id === me.id) + 1;
      const txt = 'До ' + view.target + ' · ' + fmt(left) + (rank ? ' · #' + rank : ''); g.font = F(12); const tw = g.measureText(txt).width + 24; const xx = Math.max(176, Math.min(W / 2 - tw / 2, W - 58 - tw));
      this.pill(g, xx, top, tw, 28); g.fillStyle = '#ffd23d'; g.textAlign = 'left'; g.fillText(txt, xx + 12, top + 15); return; }
    const z = view.zone; if (!z) return;
    let label, secs, col = '#e6a3ff';
    if (z.state === 'wait') { label = 'Сужение через'; secs = z.timer; } else if (z.state === 'shrink') { label = 'Зона сужается'; secs = z.timer; col = '#ff9bf0'; } else { label = 'Финальная зона'; secs = 0; }
    let txt = label + (secs ? ' ' + fmt(secs) : '') + (view.time != null && !view.ffa ? '  ·  ' + fmt(view.time) + '/20:00' : '');
    g.font = F(12); let tw = g.measureText(txt).width + 30;
    if (tw > W - 58 - 176) { txt = (z.state === 'wait' ? 'Сужение' : z.state === 'shrink' ? 'Сужается' : 'Финал') + (secs ? ' ' + fmt(secs) : ''); tw = g.measureText(txt).width + 30; }
    const xx = Math.max(176, Math.min(W / 2 - tw / 2, W - 58 - tw));
    this.pill(g, xx, top, tw, 28); g.fillStyle = col; g.beginPath(); g.arc(xx + 14, top + 14, 5, 0, TAU); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.fillText(txt, xx + 24, top + 15);
  }
  drawWaveTop(g, view, me, W, top) {
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = F(14);
    const left = view.tanks.filter(t => t.team === 1 && t.alive).length, txt = 'Волна ' + (view.wave || 0) + '  ·  врагов ' + left, tw = g.measureText(txt).width + 24, x = Math.max(10, Math.min(W / 2 - tw / 2 - 40, W - 160 - tw));
    this.pill(g, 10, top, tw, 28); g.fillStyle = '#ff9f3d'; g.fillText(txt, 22, top + 15);
    this.pill(g, 16 + tw, top, 92, 28); g.fillStyle = '#ff6b6b'; g.fillText('♥ ' + Math.max(0, view.lives ?? 0), 28 + tw, top + 15); g.fillStyle = '#fff'; g.fillText('☠ ' + view.score[0], 64 + tw, top + 15);
  }
  drawBossBar(g, b, W, y) {
    const bw = Math.max(90, Math.min(220, W - 104 - 116)), x = Math.max(108, (W - 104) / 2 - bw / 2 + 6), k = Math.max(0, b.hp / b.maxHp);
    this.pill(g, x - 4, y - 3, bw + 8, 22); g.fillStyle = '#3a1111'; roundRect(g, x, y, bw, 16, 8); g.fill(); g.fillStyle = '#ff4d4d'; roundRect(g, x, y, Math.max(16, bw * k), 16, 8); g.fill();
    g.font = F(11); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(b.alive ? 'МАМОНТ · ' + Math.ceil(b.hp) : 'ПОВЕРЖЕН', x + bw / 2, y + 8.5);
  }
  drawTeamTop(g, view, me, W, top) {
    if (view.towers) { const hq = [0, 1].map(tm => view.towers.find(T => T.hq && T.team === tm) || { hp: 0, maxHp: 1 }), bw = Math.min(280, W - 130), x = W / 2 - bw / 2 - 40, half = bw / 2 - 20, tl = 1500 - view.time;
      this.pill(g, x, top, bw, 30); g.fillStyle = '#3d7be0'; roundRect(g, x + 4, top + 4, Math.max(4, half * hq[0].hp / hq[0].maxHp), 22, 11); g.fill(); g.fillStyle = '#e04848'; const rw = Math.max(4, half * hq[1].hp / hq[1].maxHp); roundRect(g, x + bw - 4 - rw, top + 4, rw, 22, 11); g.fill();
      g.font = F(10); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; const up = [0, 1].map(tm => view.towers.filter(T => !T.hq && T.team === tm && T.alive).length); g.fillText('🗼' + up[0], x + 26, top + 16); g.fillText('🗼' + up[1], x + bw - 26, top + 16);
      g.fillStyle = view.time >= 1200 ? '#ff8a65' : 'rgba(255,255,255,0.75)'; g.fillText(view.time >= 1200 ? 'ВНЕЗАПНАЯ СМЕРТЬ' : 'штабы', x + bw / 2, top + 10); g.font = F(12); g.fillStyle = '#fff'; g.fillText(fmt(Math.max(0, tl)), x + bw / 2, top + 22);
      if (me) { g.textAlign = 'left'; this.pill(g, 10, top + 36, 140, 26); g.font = F(13); g.fillStyle = '#fff'; g.fillText('☠ ' + me.kills + '   💰 ' + Math.floor((view.gold || [0, 0])[me.team] || 0), 20, top + 50); }
      return; }
    if (view.special === 'hunt') return this.drawHuntTop(g, view, me, W, top);
    const s = view.score || [0, 0], tgt = view.target || 100, bw = Math.min(260, W - 130), x = W / 2 - bw / 2 - 40;
    this.pill(g, x, top, bw, 30);
    const half = bw / 2 - 18;
    g.fillStyle = '#3d7be0'; roundRect(g, x + 4, top + 4, Math.max(4, half * s[0] / tgt), 22, 11); g.fill();
    g.fillStyle = '#e04848'; const rw = Math.max(4, half * s[1] / tgt); roundRect(g, x + bw - 4 - rw, top + 4, rw, 22, 11); g.fill();
    g.font = F(16); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.fillText(String(s[0]), x + 30, top + 16); g.fillText(String(s[1]), x + bw - 30, top + 16);
    g.font = F(10); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(view.special === 'boss' ? 'рейд' : view.special === 'koth' ? 'очки · до ' + tgt : view.special === 'ctf' ? 'флаги · до ' + tgt : tgt >= 1e6 ? 'убийства · больше — победа' : 'до ' + tgt, x + bw / 2, top + 10);
    g.font = F(12); g.fillStyle = '#fff'; g.fillText(fmt(Math.max(0, (view.timeLimit || 480) - view.time)), x + bw / 2, top + 22);
    if (me) { g.textAlign = 'left'; this.pill(g, 10, top + 36, 70, 26); g.fillStyle = '#ff6b6b'; skullIcon(g, 26, top + 49); g.font = F(14); g.fillStyle = '#fff'; g.fillText(String(me.kills), 40, top + 50); }
  }
  drawHuntTop(g, view, me, W, top) { // r36 «Охота»: target lives (for everyone), hunters left, timer
    const T = view.tanks.find(t => t.isTarget), hs = view.tanks.filter(t => t.team === 1), hl = hs.filter(t => !t.outL).length, bw = Math.min(300, W - 130), x = W / 2 - bw / 2 - 40, tl = Math.max(0, (T ? T.lives ?? 0 : 0) - (T && T.outL ? 99 : 0));
    this.pill(g, x, top, bw, 30); g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = F(9); g.fillStyle = '#ffd23d'; g.fillText(me && me.isTarget ? 'ТЫ — ЦЕЛЬ' : 'ЦЕЛЬ', x + 46, top + 9); g.font = F(13); g.fillStyle = '#ff5d7a'; g.fillText('♥'.repeat(Math.max(0, Math.min(5, tl))) + '♡'.repeat(Math.max(0, 5 - Math.max(0, tl))), x + 46, top + 21);
    g.font = F(9); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText('ОХОТНИКИ', x + bw - 40, top + 9); g.font = F(13); g.fillStyle = '#fff'; g.fillText(hl + '/' + hs.length, x + bw - 40, top + 21);
    g.font = F(9); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('ОХОТА', x + bw / 2, top + 9); g.font = F(13); g.fillStyle = '#fff'; g.fillText(fmt(Math.max(0, (view.timeLimit || 600) - view.time)), x + bw / 2, top + 21);
    if (me) { g.textAlign = 'left'; this.pill(g, 10, top + 36, 120, 26); g.font = F(12); g.fillStyle = '#fff'; g.fillText((me.isTarget ? '♥ ' : '♥ ') + Math.max(0, me.lives ?? 0) + '   ☠ ' + me.kills, 20, top + 50); }
    if (view.huntHold && view.time < view.huntHold) { g.textAlign = 'center'; g.font = F(13); g.fillStyle = '#ffd23d'; g.fillText(me && me.isTarget ? 'Прячься! Охотники выйдут через ' + Math.ceil(view.huntHold - view.time) + ' с' : 'Старт охоты через ' + Math.ceil(view.huntHold - view.time) + ' с', W / 2, top + 48); }
  }
  drawRaceTop(g, view, me, W, top) {
    const rk = view.raceRanking(), laps = view.laps || 3, bw = Math.min(250, W - 130), x = W / 2 - bw / 2 - 40, place = me ? rk.findIndex(t => t.id === me.id) + 1 : 0;
    this.pill(g, x, top, bw, 30); g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = F(10); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('круг', x + 34, top + 9); g.fillText('место', x + bw - 34, top + 9);
    g.font = F(15); g.fillStyle = '#ffd23d'; g.fillText(Math.min(laps, (me ? me.lap || 0 : 0) + 1) + '/' + laps, x + 34, top + 21); g.fillStyle = place === 1 ? '#5dff8a' : '#fff'; g.fillText(place + '/' + rk.length, x + bw - 34, top + 21);
    g.font = F(12); g.fillStyle = '#fff'; g.fillText(fmt(Math.max(0, (view.timeLimit || 480) - view.time)), x + bw / 2, top + 16);
    g.textAlign = 'left'; g.font = F(11); const n = Math.min(4, rk.length); this.pill(g, 10, top + 36, 112, 8 + n * 15);
    for (let i = 0; i < n; i++) { const t = rk[i]; g.fillStyle = me && t.id === me.id ? '#ffd23d' : 'rgba(255,255,255,0.85)'; let nm = (i + 1) + '. ' + t.name; while (g.measureText(nm).width > 76) nm = nm.slice(0, -1); g.fillText(nm, 18, top + 47 + i * 15); g.textAlign = 'right'; g.fillText(t.finishT ? '🏁' : 'к' + Math.min(laps, (t.lap || 0) + 1), 116, top + 47 + i * 15); g.textAlign = 'left'; }
  }
  drawClassicTop(g, view, me, W, top, layout) {
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = F(13);
    const lt = 'УР. ' + ((view.level || 0) + 1); const lw = g.measureText(lt).width; g.font = F(11); let nm = view.levelName || ''; const maxN = Math.max(0, W - 58 - 90 - 72 - lw - 40); while (nm && g.measureText(nm).width > maxN) nm = nm.slice(0, -2); if (nm !== (view.levelName || '') && nm) nm += '…'; const nw = nm ? g.measureText(nm).width + 8 : 0; const pw = lw + nw + 24;
    g.font = F(13); this.pill(g, 10, top, pw, 28); g.fillStyle = '#ffd23d'; g.fillText(lt, 22, top + 15); if (nm) { g.fillStyle = '#cfd6df'; g.font = F(11); g.fillText(nm, 22 + lw + 8, top + 15); }
    const lx = 16 + pw; this.pill(g, lx, top, 62, 28); g.fillStyle = '#7dff8a'; g.font = F(13); tankIcon(g, lx + 16, top + 14, '#7dff8a'); g.fillStyle = '#fff'; g.fillText('×' + Math.max(0, view.lives), lx + 28, top + 15);
    g.textAlign = 'center'; const sx = Math.max(lx + 68, W - 58 - 84); this.pill(g, sx, top, 84, 28); g.fillStyle = '#fff'; g.fillText(String(view.score || 0).padStart(6, '0'), sx + 42, top + 15);
    // enemy reserve icons
    const left = Math.max(0, (view.enemyTotal || 20) - (view.enemyKilled || 0) - view.tanks.filter(t => t.team === 1 && t.alive).length);
    const iy = top + 36; for (let i = 0; i < left; i++) { const x = 14 + (i % 20) * 12, y = iy + Math.floor(i / 20) * 10; g.fillStyle = '#c9ced6'; g.fillRect(x, y, 8, 7); g.fillStyle = '#7b818a'; g.fillRect(x + 3, y - 2, 2, 3); }
    if (view.freezeT > 0) { g.textAlign = 'right'; g.font = F(11); g.fillStyle = '#b8b8ff'; g.fillText('Враги заморожены: ' + Math.ceil(view.freezeT), W - 12, iy + 4); }
  }
  // r27: stat panel — mounted mods (tier colour, level) + effective stats from mods
  drawModPanel(g, me, layout, top) { const F = me.fx || {}, x = layout.leftCol || 10, y = layout.leftCol ? layout.noteTop + 72 : top + 88, rows = me.gm.slice(0, 8); g.save(); g.font = '600 9px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    const st = []; if (me.dmgMul && me.dmgMul !== 1) st.push('Урон ×' + me.dmgMul.toFixed(2)); if (me.armMul && me.armMul !== 1) st.push('Прочность ×' + me.armMul.toFixed(2)); if (F.spread && F.spread !== 1) st.push('Разброс ×' + F.spread.toFixed(2)); if (me.shBMax) st.push('Щит ' + Math.ceil(me.shBHp || 0) + '/' + me.shBMax); if (me.apsN != null && (me.apsN || me.apsMax)) st.push('АЗ ×' + me.apsN);
    const hh = 12 * rows.length + 12 * st.length + 6; g.fillStyle = 'rgba(8,10,14,0.55)'; roundRect(g, x, y, 132, hh, 6); g.fill();
    rows.forEach((m, i) => { const M = GMODS[m[0]]; if (!M) return; const yy = y + 9 + i * 12; g.fillStyle = M.col; g.fillRect(x + 5, yy - 4, 8, 8); g.fillStyle = m[1] >= 5 ? '#ff3b6b' : m[1] >= 4 ? '#ffb347' : '#e8e8f0'; g.fillText(M.name + ' · ' + ['I', 'II', 'III'][m[2] - 1], x + 17, yy); });
    st.forEach((s, i) => { g.fillStyle = '#9fd8ff'; g.fillText(s, x + 6, y + 9 + (rows.length + i) * 12); }); g.restore(); }
  drawMinimap(g, view, me, x, y, s, cam) {
    const m = view.map; if (!this.mini || this.miniMap !== m) this.buildMini(m, view.mode);
    g.save(); roundRect(g, x, y, s, s, 10); g.clip(); g.globalAlpha = 0.85; g.drawImage(this.mini, x, y, s, s); g.globalAlpha = 1;
    const kx = s / m.pw, ky = s / m.ph;
    if (view.towers) for (const T of view.towers) { if (!T.alive) continue; g.fillStyle = T.team === (me ? me.team : 0) ? '#5cc2ff' : '#ff6b6b'; const z = T.hq ? 6 : 4; g.fillRect(x + T.x * kx - z / 2, y + T.y * ky - z / 2, z, z); }
    if (view.flags) for (const F of view.flags) { g.fillStyle = F.team === 0 ? '#5cc2ff' : '#ff6b6b'; g.fillRect(x + F.x * kx - 2.5, y + F.y * ky - 2.5, 5, 5); g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(x + F.x * kx - 2.5, y + F.y * ky - 2.5, 5, 5); }
    if (view.special === 'race' && view.map.checkpoints && me) { const c = view.map.checkpoints[me.cp ?? 1]; if (c) { g.strokeStyle = '#ffd23d'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + c[0] * kx, y + c[1] * ky, 4, 0, TAU); g.stroke(); } }
    for (const p of view.pickups || []) if (p.type === 'armor') { /* r36: armour crates on the minimap — small steel shield */ const px = x + p.x * kx, py = y + p.y * ky, k = 0.75 + 0.25 * Math.sin(this.t * 4 + p.id); g.fillStyle = 'rgba(150,200,255,' + (0.9 * k) + ')'; g.strokeStyle = '#0d1520'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(px, py - 3.6); g.lineTo(px + 3, py - 2.2); g.lineTo(px + 2.4, py + 1.4); g.lineTo(px, py + 3.6); g.lineTo(px - 2.4, py + 1.4); g.lineTo(px - 3, py - 2.2); g.closePath(); g.fill(); g.stroke(); }
    if (view.zone && !view.ffa) { const z = view.zone; g.fillStyle = 'rgba(120,30,170,0.45)'; g.beginPath(); g.rect(x, y, s, s); g.arc(x + z.cx * kx, y + z.cy * ky, Math.max(0.5, z.r * kx), 0, TAU, true); g.fill('evenodd'); g.strokeStyle = '#e6a3ff'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + z.cx * kx, y + z.cy * ky, Math.max(0.5, z.r * kx), 0, TAU); g.stroke(); if (z.state !== 'final') { g.strokeStyle = '#fff'; g.setLineDash([2, 2]); g.beginPath(); g.arc(x + z.tcx * kx, y + z.tcy * ky, Math.max(0.5, z.tr * kx), 0, TAU); g.stroke(); g.setLineDash([]); } }
    if (me && view.mode !== 'classic') { // r15 radar: allies always; enemies only inside the detection ring, fading to a last-known ping
      const RR = RADAR_R * (me.radar || (me.eq && me.eq.includes('radar')) ? RADAR_MOD : 1), now = this.t, mem = this.radarMem || (this.radarMem = new Map());
      g.strokeStyle = 'rgba(125,255,176,0.28)'; g.lineWidth = 1; g.setLineDash([2, 2]); g.beginPath(); g.arc(x + me.x * kx, y + me.y * ky, Math.max(3, RR * kx), 0, TAU); g.stroke(); g.setLineDash([]);
      const smoked = (t) => view.smokes && view.smokes.some(s0 => Math.hypot(t.x - s0.x, t.y - s0.y) < (s0.r || 30));
      for (const t of view.tanks) { if (!t.alive || t.id === me.id || t.x < -900) continue; if (t.cloaked && (t.team !== me.team || view.ffa)) continue; /* r26: hidden from minimap */ const ally = t.team === me.team && (view.mode !== 'br' || view.squad > 1);
        if (view.special === 'hunt' && me.isTarget && t.team !== me.team) { mem.set(t.id, { x: t.x, y: t.y, t: now, shot: false }); continue; } // r36: the hunted always sees all hunters
        if (ally) { g.fillStyle = view.mode === 'team' ? (t.team ? '#ff4d4d' : '#4d8dff') : teamColor(t.team); g.fillRect(x + t.x * kx - 2, y + t.y * ky - 2, 4, 4); continue; }
        const d = Math.hypot(t.x - me.x, t.y - me.y), shot = view.time - (t.lastFire ?? -99) < 0.5, hid = !(t.rev || (t.revT > 0 && me && t.revTeam === me.team)) && (t.inBush || smoked(t)) && d > (t.sub || t.terr === 2 ? (t.seeR || 20) : RADAR_CLOSE);
        if ((d < RR && !hid) || (shot && d < RR * RADAR_SHOT)) mem.set(t.id, { x: t.x, y: t.y, t: now, shot: shot && d >= RR }); }
      for (const [id, p] of mem) { const age = now - p.t; if (age > 2.2) { mem.delete(id); continue; } const tk = view.tanks.find(q => q.id === id); if (tk && !tk.alive) { mem.delete(id); continue; }
        const px = x + p.x * kx, py = y + p.y * ky;
        if (age < 0.05 && !p.shot) { g.fillStyle = '#ff4d4d'; g.fillRect(px - 2, py - 2, 4, 4); }
        else { const a = Math.max(0, 1 - age); if (a > 0) { g.fillStyle = 'rgba(255,77,77,' + a + ')'; g.fillRect(px - 2, py - 2, 4, 4); } g.strokeStyle = 'rgba(255,' + (p.shot ? 210 : 120) + ',90,' + Math.max(0, 0.7 - age * 0.3) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, 3 + age * 3, 0, TAU); g.stroke(); } } }
    if (me && view.wrecks && (view.mode !== 'br' || view.squad > 1) && !view.ffa) for (const k of view.wrecks) { if (!k.tid || k.team !== me.team) continue; const px = x + k.x * kx, py = y + k.y * ky, pul = 0.5 + 0.5 * Math.sin(this.t * 6); g.fillStyle = 'rgba(108,255,154,' + (0.5 + pul * 0.5) + ')'; g.fillRect(px - 3, py - 1, 6, 2); g.fillRect(px - 1, py - 3, 2, 6); g.font = F(7); g.textAlign = 'center'; g.fillText('ждёт помощи', px, py - 6); }
    if (this.pings) { const now = performance.now(); this.pings = this.pings.filter(p => now - p.t < 6000); for (const p of this.pings) { const a = 1 - (now - p.t) / 6000, r = 3 + ((now - p.t) % 1000) / 1000 * 7; g.strokeStyle = 'rgba(255,210,61,' + a + ')'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + p.x * kx, y + p.y * ky, r, 0, TAU); g.stroke(); } }
    if (cam) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.strokeRect(x + (cam.x - cam.vw / 2) * kx, y + (cam.y - cam.vh / 2) * ky, cam.vw * kx, cam.vh * ky); }
    if (me) { g.fillStyle = '#5dff8a'; g.beginPath(); g.arc(x + me.x * kx, y + me.y * ky, 3, 0, TAU); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); }
    g.restore(); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5; roundRect(g, x, y, s, s, 10); g.stroke();
  }
  drawFeed(g, x, y, mode) {
    g.textAlign = 'left'; g.textBaseline = 'middle'; const sm = this.chatMode !== 0, ph = sm ? 16 : 20, fs = sm ? 10 : 11; g.font = F(fs);
    let yy = y;
    const x0 = x; for (const f of this.feed) { x = yy + ph > 88 ? Math.max(x0, 62) : x0; // r25: rows beside the ⚙/⟲ column never overlap it
      const life = sm ? 4 : 6, a = f.t > life - 1 ? life - f.t : 1; g.globalAlpha = Math.max(0, a);
      const sq = mode === 'br' && this.squad > 1; const txt1 = (sq && f.kt >= 0 ? teamTag(f.kt) + ' ' : '') + f.killer, txt2 = (sq ? teamTag(f.vt) + ' ' : '') + f.victim;
      const fc = (tm) => tm == null || tm < 0 ? '#fff' : mode === 'team' && !this.race ? (tm ? '#ff8a8a' : '#8ab8ff') : mode === 'classic' ? '#fff' : teamColor(tm); const w1 = g.measureText(txt1).width, w2 = g.measureText(txt2).width, tot = w1 + w2 + 34;
      this.pill(g, x, yy, tot, ph, f.mine ? 'rgba(40,120,60,' + (sm ? 0.5 : 0.7) + ')' : f.me ? 'rgba(140,30,30,' + (sm ? 0.55 : 0.75) + ')' : 'rgba(10,14,20,' + (sm ? 0.4 : 0.55) + ')');
      g.fillStyle = f.mine ? '#c9ffd6' : fc(f.kt); g.fillText(txt1, x + 8, yy + ph / 2 + 0.5);
      g.save(); g.translate(x + 14 + w1, yy + ph / 2); g.scale(0.9, 0.9); g.fillStyle = (WEAPONS[f.w] || WEAPONS.cannon).color || '#ffd23d'; if (f.w === 'zone') g.fillStyle = '#e6a3ff'; g.fillRect(-1, -1.5, 9, 3); g.fillRect(-3, -3, 4, 6); g.restore();
      g.fillStyle = f.me ? '#ffb0b0' : fc(f.vt); g.fillText(txt2, x + 26 + w1, yy + ph / 2 + 0.5);
      yy += ph + 3; g.globalAlpha = 1;
    }
    this.feedEnd = yy; return yy;
  }
  drawNotes(g, W, yBase) {
    if (true) { // r33: always the compact top-left log (3 lines, 4 s); was centre in chatMode 0: top-left under the kill feed, ≤4 lines, 4 s, never centre/controls/HP bar
      const L = this.noteLife(), maxW = this.noteW || Math.min(W * 0.4, 230); g.font = F(9.5); g.textAlign = 'left'; g.textBaseline = 'middle'; let y = Math.max((this.feedEnd || 90) + 2, this.noteTop || 0);
      for (const n of this.notes) { const Ln = n.life || L, a = Math.max(0, Math.min(1, n.t * 6, (Ln - n.t) * (n.pick ? 3 : 1.5))) * (n.pick ? 0.72 : 1); let txt = (n.pick ? '+ ' : '') + n.text + (n.n > 1 ? ' ×' + n.n : '') + (n.more ? '  (+' + n.more + ')' : ''); g.font = F(n.pick ? 8.5 : 9.5); while (txt.length > 4 && g.measureText(txt).width > maxW - 12) txt = txt.slice(0, -2); if (txt.length < n.text.length) txt = txt.replace(/.$/, '…');
        const tw = g.measureText(txt).width + 12, ox = this.leftCol || (y + 15 > 88 && y < 250 ? 62 : 10); g.globalAlpha = a * 0.95; this.pill(g, ox, y, tw, n.pick ? 13 : 15, n.pick ? 'rgba(10,14,20,0.3)' : 'rgba(10,14,20,0.42)'); g.fillStyle = n.color; g.fillText(txt, ox + 6, y + (n.pick ? 7 : 8)); y += n.pick ? 15 : 17; }
      g.globalAlpha = 1; return; }
    const L = this.noteLife(); g.font = F(11); g.textAlign = 'center'; g.textBaseline = 'middle'; let y = yBase;
    for (let i = this.notes.length - 1; i >= 0; i--) { const n = this.notes[i], a = Math.min(1, n.t * 8, (L - n.t) * 3); const txt = n.text + (n.n > 1 ? ' ×' + n.n : '');
      const tw = g.measureText(txt).width + 18; g.globalAlpha = Math.max(0, a); this.pill(g, W / 2 - tw / 2, y - 10 - (1 - Math.min(1, n.t * 8)) * 6, tw, 20); g.fillStyle = n.color; g.fillText(txt, W / 2, y + 0.5 - (1 - Math.min(1, n.t * 8)) * 6); y -= 23; }
    g.globalAlpha = 1;
  }
  drawBottom(g, view, me, L, extra) {
    const W = L.W, y = L.hudBottom - 30, bw = L.hpW || Math.min(220, W * 0.5), x = W / 2 - bw / 2; (this.boxes || (this.boxes = [])).push({ n: 'hpBar', x: x - 38, y: y - 4, w: bw + 42, h: 26 });
    { // r15: part-damage silhouette left of the HP bar (red = broken, stays until a part pickup / repair kit)
      const pb = me.pbroke || 0, sx0 = x - 34, sy0 = y - 8, red = '#ff4d4d', ok = 'rgba(220,230,240,0.85)'; g.save(); g.fillStyle = 'rgba(10,14,20,0.6)'; roundRect(g, sx0 - 4, sy0 - 4, 30, 26, 7); g.fill();
      g.fillStyle = pb & 4 ? red : ok; g.fillRect(sx0, sy0, 22, 4); g.fillRect(sx0, sy0 + 14, 22, 4); // tracks
      if (pb & 4) { g.fillStyle = '#14171c'; g.fillRect(sx0 + 8, sy0, 3, 4); }
      g.fillStyle = pb & 16 ? red : ok; g.fillRect(sx0 + 2, sy0 + 5, 18, 8); // hull plates
      g.fillStyle = pb & 8 ? red : 'rgba(120,130,140,0.9)'; g.fillRect(sx0 + 2, sy0 + 6, 5, 6); // engine
      g.fillStyle = pb & 1 ? red : '#9aa6b2'; g.beginPath(); g.arc(sx0 + 12, sy0 + 9, 4, 0, Math.PI * 2); g.fill(); // turret
      g.fillStyle = pb & 2 ? red : '#9aa6b2'; g.fillRect(sx0 + 15, sy0 + 8, 10, 2); // gun
      if (me.burnT > 0) { g.fillStyle = '#ff8a2a'; g.fillText ? (g.font = '10px system-ui', g.fillText('🔥', sx0 + 18, sy0 - 2)) : 0; }
      if (me.empT > 0) { g.font = '10px system-ui'; g.fillStyle = '#5df0ff'; g.fillText('⚡', sx0 - 2, sy0 - 2); }
      if (me.sub || (me.oxy ?? 30) < 30) { const k = Math.max(0, (me.oxy ?? 30) / 30); g.fillStyle = 'rgba(10,14,20,0.6)'; g.fillRect(x, y - 16, bw, 6); g.fillStyle = k < 0.25 ? '#ff6b6b' : '#5df0ff'; g.fillRect(x + 1, y - 15, (bw - 2) * k, 4); g.font = '9px system-ui'; g.fillStyle = '#cfefff'; g.textAlign = 'left'; g.fillText('O₂', x + bw + 4, y - 11); }
      if (me.beaconT > 0) { g.font = 'bold 10px system-ui'; g.fillStyle = '#ff4d7a'; g.textAlign = 'right'; g.fillText('МАЯК АКТИВЕН', x + bw, y - 20); }
      g.restore(); }
    this.drawNotes(g, W, y - 22);
    this.pill(g, x - 4, y - 4, bw + 8, 26);
    const k = Math.max(0, me.hp / me.maxHp); const gr = g.createLinearGradient(x, 0, x + bw, 0);
    if (k > 0.5) { gr.addColorStop(0, '#36d26a'); gr.addColorStop(1, '#8dff7a'); } else if (k > 0.25) { gr.addColorStop(0, '#e0a72a'); gr.addColorStop(1, '#ffd23d'); } else { gr.addColorStop(0, '#c8282f'); gr.addColorStop(1, '#ff5d5d'); }
    g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, x, y, bw, 18, 9); g.fill();
    g.fillStyle = gr; roundRect(g, x, y, Math.max(9, bw * k), 18, 9); g.fill();
    if (me.armorT > 0 && me.armorHp > 0) { const ac = TIERS[me.armorT - 1].color; g.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(g, x, y - 7, bw, 5, 2.5); g.fill(); g.fillStyle = ac; roundRect(g, x, y - 7, Math.max(5, bw * Math.min(1, me.armorHp / armorMax(me.armorT))), 5, 2.5); g.fill(); }
    if (me.shield > 0) { g.fillStyle = 'rgba(93,200,255,0.85)'; roundRect(g, x, y + 13, Math.max(6, bw * Math.min(1, me.shield / 140)), 5, 2.5); g.fill(); }
    g.font = F(12); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(Math.ceil(me.hp) + ' / ' + me.maxHp, W / 2, y + 9.5); if ((me.wT || 0) > 0.3 && me.alive) { const left = 30 - me.wT, bad = left <= 0, bw = 150, bx = W / 2 - bw / 2, by = y - 30; g.globalAlpha = 0.85; g.fillStyle = 'rgba(8,24,40,0.8)'; g.beginPath(); g.roundRect ? g.roundRect(bx, by, bw, 22, 8) : g.rect(bx, by, bw, 22); g.fill(); g.globalAlpha = 1;
      g.fillStyle = bad ? '#ff4d4d' : left < 10 ? '#ffd23d' : '#7fd0ff'; g.fillRect(bx + 4, by + 17, (bw - 8) * Math.max(0, Math.min(1, left / 30)), 3); g.font = F(12); g.fillText(bad ? '🌊 Вода: броня и корпус гибнут!' : '🌊 В воде: ' + Math.ceil(left) + ' с', W / 2, by + 9); } // r25 water timer
    // buffs
    let bx = x + bw + 12; const buffs = [];
    if (me.speedT > 0) buffs.push(['speed', '#ffd23d', me.speedT]); if (me.powerT > 0) buffs.push(['power', '#ff9f3d', me.powerT]); if (me.inv > 0) buffs.push(['helmet', '#7fd8ff', me.inv]); if (view.mode === 'classic' && me.stars) buffs.push(['star', '#ffe066', me.stars]);
    for (const [ic, col, v] of buffs) { if (bx > W - 30) break; g.save(); g.translate(bx + 8, y + 9); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1.2; g.scale(1.3, 1.3); drawIcon(g, ic); g.restore(); bx += 22; }
    { // r37: items found on the map act only in THIS battle (annulled at the end) — shown as temporary buffs
      const fb = []; if (me.armorT > 0) fb.push(['🛡 Броня T' + me.armorT, '#7fd8ff']); if (me.wtier > 1) fb.push(['🔫 Оружие T' + me.wtier, '#ffd23d']); const A = me.shA || [];
      const zc = [[25, '#f4f8ff'], [26, '#5aa8ff'], [27, '#ff4d5a']]; for (const [i, c] of zc) if (A[i] > 0) fb.push(['⚡ ' + A[i], c]); if (me.molotovN > 0) fb.push(['🔥 ' + me.molotovN, '#ff8a3d']); if (me.fmN > 0) fb.push(['🔧 Моды ×' + me.fmN, '#8fd46a']);
      if (me.speedT > 0) fb.push(['💨 ' + Math.ceil(me.speedT) + 'с', '#ffd23d']); if (me.powerT > 0) fb.push(['💪 ' + Math.ceil(me.powerT) + 'с', '#ff9f3d']);
      if (fb.length && me.alive) { g.save(); g.font = F(10); g.textAlign = 'left'; g.textBaseline = 'middle'; fb.unshift(['⏳ до конца боя', 'rgba(255,255,255,0.8)']);
        const maxW = Math.max(bw, 260), rows = [[]]; let rw = 0; for (const it of fb) { const tw = g.measureText(it[0]).width + 10; if (rw + tw > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push([it[0], it[1], tw]); rw += tw + 4; }
        let py = y - 10 - ((me.wT || 0) > 0.3 ? 32 : 0) - (rows.length - 1) * 15; // above the HP bar, never under the screen edge
        for (const row of rows) { const tot = row.reduce((s, r) => s + r[2] + 4, -4); let px = W / 2 - tot / 2; for (const [tx, c, tw] of row) { g.fillStyle = 'rgba(10,14,20,0.72)'; roundRect(g, px, py - 6.5, tw, 13, 6); g.fill(); g.strokeStyle = c; g.lineWidth = 1; g.stroke(); g.fillStyle = c; g.fillText(tx, px + 5, py + 0.5); px += tw + 4; } py += 15; }
        if (typeof window !== 'undefined') window.__tbuf = fb.length - 1; g.restore(); } else if (typeof window !== 'undefined') window.__tbuf = 0; }
    // weapon chip with reload ring (above aim stick)
    const wd = WEAPONS[me.weapon] || WEAPONS.cannon; const cx = L.chip ? L.chip.x : L.aimHint.x, cy = L.chip ? L.chip.y : L.aimHint.y - L.stickR - 26;
    const am = me.ammo ?? me.shells; const wlabel = wd.name + (view.mode !== 'classic' && am != null ? ' · ' + am : view.mode !== 'classic' && me.weapon !== 'cannon' ? ' · ∞' : '');
    g.textAlign = 'center'; g.font = F(11); const tw = g.measureText(wlabel).width + 30; this.pill(g, cx - tw / 2, cy - 11, tw, 22); (this.boxes || (this.boxes = [])).push({ n: 'weaponChip', x: cx - tw / 2, y: cy - 11, w: tw, h: 22 });
    g.fillStyle = (me.wtier > 1 && TIERS[me.wtier - 1].color) || wd.color; g.beginPath(); g.arc(cx - tw / 2 + 12, cy, 4, 0, TAU); g.fill(); g.fillStyle = am != null && am <= 5 ? '#ff8a6b' : '#fff'; g.fillText(wlabel, cx + 6, cy + 1);
    if (me.mods) { const ms = Object.values(MODS).filter(m => me.mods & m.bit).map(m => m.short).join(' · '); g.font = F(9); const mw = g.measureText(ms).width + 14; this.pill(g, cx - mw / 2, cy + 14, mw, 16); g.fillStyle = '#7dffcf'; g.fillText(ms, cx, cy + 22.5); }
    const reloadK = extra.reloadK; if (reloadK < 1) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(L.aimHint.x, L.aimHint.y, L.stickR * 0.5, -Math.PI / 2, -Math.PI / 2 + TAU * reloadK); g.stroke(); }
  }
  drawSticks(g, L, input, extra) {
    if (extra && extra.spec) return; // r27: spectators have no controls
    const R = L.stickR; const s = input.sticks; (this.boxes || (this.boxes = [])).push({ n: 'moveStick', x: L.moveHint.x - R, y: L.moveHint.y - R, w: 2 * R, h: 2 * R }, { n: 'fireStick', x: L.aimHint.x - R, y: L.aimHint.y - R, w: 2 * R, h: 2 * R });
    const drawStick = (ox, oy, kx, ky, active, label, col) => {
      g.globalAlpha = (active ? 0.9 : 0.35) * (this.joyA ?? 1);
      g.fillStyle = 'rgba(10,14,20,0.35)'; g.beginPath(); g.arc(ox, oy, R, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(ox, oy, R * 0.62, 0, TAU); g.stroke();
      const gr = g.createRadialGradient(kx - 6, ky - 6, 2, kx, ky, R * 0.45); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.arc(kx, ky, R * 0.42, 0, TAU); g.fill();
      if (label) { g.globalAlpha = active ? 0.9 : 0.6; g.fillStyle = 'rgba(0,0,0,0.6)'; g.font = F(10); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, kx, ky + 1); }
      g.globalAlpha = 1;
    };
    const mv = s.move, am = s.aim;
    if (extra.touch || mv || am) {
      if (mv) { const dx = mv.x - mv.ox, dy = mv.y - mv.oy, d = Math.hypot(dx, dy), k = Math.min(1, R / (d || 1)); drawStick(mv.ox, mv.oy, mv.ox + dx * Math.min(1, k), mv.oy + dy * Math.min(1, k), true, '', '#9ad7ff'); }
      else drawStick(L.moveHint.x, L.moveHint.y, L.moveHint.x, L.moveHint.y, false, 'ХОД', '#9ad7ff');
      if (am) { const dx = am.x - am.ox, dy = am.y - am.oy, d = Math.hypot(dx, dy), k = Math.min(1, R / (d || 1)); drawStick(am.ox, am.oy, am.ox + dx * k, am.oy + dy * k, true, '', '#ff8a6b'); }
      else drawStick(L.aimHint.x, L.aimHint.y, L.aimHint.x, L.aimHint.y, false, 'ОГОНЬ', '#ff8a6b');
    }
  }
}
function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function personIcon(g, x, y) { g.beginPath(); g.arc(x, y - 4, 3.5, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - 6, y + 7); g.quadraticCurveTo(x, y - 3, x + 6, y + 7); g.closePath(); g.fill(); }
function skullIcon(g, x, y) { g.beginPath(); g.arc(x, y - 1, 6, Math.PI, 0); g.lineTo(x + 6, y + 3); g.lineTo(x + 3, y + 3); g.lineTo(x + 3, y + 6); g.lineTo(x - 3, y + 6); g.lineTo(x - 3, y + 3); g.lineTo(x - 6, y + 3); g.closePath(); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x - 2.4, y, 1.6, 0, TAU); g.arc(x + 2.4, y, 1.6, 0, TAU); g.fill(); }
function tankIcon(g, x, y, c) { g.fillStyle = c; g.fillRect(x - 6, y - 3, 12, 8); g.fillRect(x - 2, y - 6, 4, 4); g.fillRect(x, y - 5, 7, 2); }
