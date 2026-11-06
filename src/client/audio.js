// Procedural sound effects + procedural music engine (WebAudio, no assets).
export class Audio {
  constructor() { this.ctx = null; this.sfxOn = true; this.musicOn = true; this.track = null; this.step = 0; this.nextT = 0; this.timer = null; this.last = {}; }
  ensure() { try { return this.ensure0(); } catch (e) { this.ctx = null; return false; } }
  ensure0() {
    if (!this.ctx) {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext); if (!AC) return false;
      try { this.ctx = new AC(); } catch (e) { return false; }
      const c = this.ctx; this.master = c.createGain(); this.master.gain.value = 0.8;
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.master.connect(this.comp); this.comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
      this.mus = c.createGain(); this.mus.gain.value = 0.22; this.mus.connect(this.master);
      // r21: distance echo bus (two filtered feedback delays = terrain slap-back)
      this.echo = c.createGain(); this.echo.gain.value = 1; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; this.echo.connect(lp);
      for (const [dt, fb] of [[0.23, 0.32], [0.41, 0.25]]) { const d = c.createDelay(1.5), g = c.createGain(); d.delayTime.value = dt; g.gain.value = fb; lp.connect(d); d.connect(g); g.connect(d); d.connect(this.sfx); }
      const len = c.sampleRate; this.noise = c.createBuffer(1, len, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }
  setSfx(on) { this.sfxOn = on; }
  setMusic(on) { this.musicOn = on; if (!on) this.stopMusic(); else if (this.wanted) this.playMusic(this.wanted); }
  throttle(k, ms) { const n = performance.now(); if (this.last[k] && n - this.last[k] < ms) return false; this.last[k] = n; return true; }
  tone(type, f0, f1, dur, vol, when = 0, dest) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  noiseHit(dur, vol, f0, f1, q = 0.8, when = 0, type = 'lowpass', dest) {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  // r21: spatial chain per sound: stereo pan + distance low-pass (air absorption) + echo send that grows with distance
  spatial(sp, echo) { const c = this.ctx; if (!sp) { this._d = this.sfx; return; } const pn = c.createStereoPanner ? c.createStereoPanner() : null, f = c.createBiquadFilter(), d = Math.max(0, Math.min(1, sp.d || 0));
    f.type = 'lowpass'; f.frequency.value = 16000 * Math.pow(0.09, d); f.Q.value = 0.5; const dg = c.createGain(); dg.gain.value = 1 - 0.6 * d; /* r22: direct path falls off with distance */ f.connect(dg); if (pn) { pn.pan.value = Math.max(-0.9, Math.min(0.9, sp.pan || 0)); dg.connect(pn); pn.connect(this.sfx); } else dg.connect(this.sfx);
    const e = c.createGain(); e.gain.value = (echo || 0.15) * (0.2 + 0.45 * d); /* echo stays below the direct sound */ f.connect(e); e.connect(this.echo); this._d = f; setTimeout(() => { try { f.disconnect(); pn && pn.disconnect(); e.disconnect(); } catch (_) {} }, 4000); }
  // inharmonic metal partials (armour clang / ricochet ping)
  modal(fr, dec, vol, when = 0) { const c = this.ctx, t = c.currentTime + when; for (let i = 0; i < fr.length; i++) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = fr[i] * (0.97 + Math.random() * 0.06);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol / (1 + i * 0.6), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dec * (1 - i * 0.12)); o.connect(g); g.connect(this._d || this.sfx); o.start(t); o.stop(t + dec + 0.05); } }
  // r21: continuous engine rumble + track clatter for the player's tank (k: 0..1 speed, <0 = off)
  // r25: per-model engine voice. vx = { p: pitch, tb: turbine 0/1, cl: track clatter rate, rb: rumble } — keyed so an enemy engine can play beside ours
  engine(k, vx, key = 'me', vol = 1) { if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') { const E0 = this.engs && this.engs[key]; if (E0 && k < 0) E0.g.gain.value = 0; return; } const c = this.ctx; const V = vx || { p: 1, tb: 0, cl: 1, rb: 1 };
    const EN = this.engs || (this.engs = {}); let E = EN[key];
    if (!E || E.vk !== (V.p + ':' + V.tb)) { if (E) { try { for (const x of E.src) x.stop(); E.g.disconnect(); } catch (_) {} }
      const g = c.createGain(); g.gain.value = 0; g.connect(this.sfx); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(g);
      const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = V.tb ? 'triangle' : 'sawtooth'; o2.type = 'sawtooth'; const g2 = c.createGain(); g2.gain.value = V.tb ? 0.25 : 0.5; o1.connect(lp); o2.connect(g2); g2.connect(lp);
      const ns = c.createBufferSource(); ns.buffer = this.noise; ns.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100 + 900 * V.cl; bp.Q.value = 1.2; const cg = c.createGain(); cg.gain.value = 0; ns.connect(bp); bp.connect(cg); cg.connect(g);
      const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 6; const lg = c.createGain(); lg.gain.value = 0; lfo.connect(lg); lg.connect(cg.gain); const rum = c.createBufferSource(); rum.buffer = this.noise; rum.loop = true; rum.playbackRate.value = 0.2 + 0.1 * V.rb; const rg = c.createGain(); rg.gain.value = 0.6 + 0.6 * V.rb; rum.connect(rg); rg.connect(lp);
      const src = [o1, o2, ns, lfo, rum]; let wh = null; if (V.tb) { wh = c.createOscillator(); wh.type = 'sine'; const wg = c.createGain(); wg.gain.value = 0.05; wh.connect(wg); wg.connect(g); src.push(wh); }
      for (const x of src) x.start(); E = EN[key] = { g, o1, o2, cg, lg, lfo, lp, wh, src, vk: V.p + ':' + V.tb, T: 0 };
      if (!this._engIv) this._engIv = setInterval(() => { for (const q of Object.values(this.engs)) if (performance.now() - q.T > 350) q.g.gain.setTargetAtTime(0, c.currentTime, 0.1); }, 300); }
    E.T = performance.now();
    const t = c.currentTime, on = k >= 0, v = Math.max(0, k), P = V.p; E.g.gain.setTargetAtTime(on ? (0.12 + 0.12 * v) * vol : 0, t, 0.15); E.o1.frequency.setTargetAtTime((30 + 26 * v) * P, t, 0.3); E.o2.frequency.setTargetAtTime((45 + 39 * v) * P * (V.tb ? 1.5 : 1), t, 0.3); E.lp.frequency.setTargetAtTime((200 + 380 * v) * (V.tb ? 1.6 : 1), t, 0.3);
    if (E.wh) E.wh.frequency.setTargetAtTime(1800 + 2400 * v * P, t, 0.4);
    E.cg.gain.setTargetAtTime(0.35 * v, t, 0.1); E.lg.gain.setTargetAtTime(0.3 * v, t, 0.1); E.lfo.frequency.setTargetAtTime((3 + 15 * v) * V.cl, t, 0.2); }
  rotor(v) { const c = this.ctx; if (!c || !this.sfxOn || c.state !== 'running') return; let R = this._rot; if (v < 0) { if (R) R.g.gain.setTargetAtTime(0, c.currentTime, 0.2); return; }
    if (!R) { const g = c.createGain(); g.gain.value = 0; g.connect(this.sfx); const am = c.createGain(); am.gain.value = 0.5; am.connect(g); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 165; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(lp); lp.connect(am);
      const ns = c.createBufferSource(); ns.buffer = this.noise; ns.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8; const ng = c.createGain(); ng.gain.value = 0.6; ns.connect(bp); bp.connect(ng); ng.connect(am);
      const lfo = c.createOscillator(); lfo.frequency.value = 42; const lg = c.createGain(); lg.gain.value = 0.45; lfo.connect(lg); lg.connect(am.gain); o.start(); ns.start(); lfo.start(); R = this._rot = { g, o, lfo }; }
    const t = c.currentTime; R.g.gain.setTargetAtTime(0.09 * v, t, 0.15); R.o.frequency.setTargetAtTime(160 + 14 * Math.sin(t * 0.7), t, 0.3); }
  play(name, vol = 1, sp, vx) {
    if (!this.sfxOn || !this.ensure()) return; vol = Math.max(0, Math.min(1, vol)); if (vol < 0.03) return;
    this.spatial(sp, /^boom|shot_cannon|shot_rail|shot_shotgun/.test(name) ? 0.45 : 0.12); const D = this._d;
    switch (name) {
      case 'shot_cannon': { if (!this.throttle(name, 40)) return; // r25: timbre from the tank model (calibre → pitch/body), + random per-shot variant
        const V = vx || { p: 1, b: 1, c: 1 }, R = Math.random, P = V.p * (0.94 + R() * 0.12), B = V.b * (0.9 + R() * 0.2), C = V.c, vr = Math.floor(R() * 3);
        this.noiseHit(0.03 + 0.015 * vr, 0.7 * vol * C, 9000 * C, 2500 + 800 * vr, 0.6, 0, 'highpass', D); this.noiseHit(1.3 * B, 0.75 * vol, 2200 * P, 45 * P, 0.7, 0, 'lowpass', D); this.tone('sine', 72 * P, 26 * P, 0.7 * B, 0.6 * vol, 0, D); this.noiseHit(0.5 * B, 0.25 * vol, 500 * P, 80, 0.8, 0.06 + 0.02 * vr, 'lowpass', D);
        if (vr === 2) this.noiseHit(0.25, 0.18 * vol, 1200 * P, 300, 1.5, 0.03, 'bandpass', D);
        if (V.me) { this.modal([2400, 3900, 6100], 0.18, 0.05, 0.55 + R() * 0.2); this.modal([2600, 4100], 0.12, 0.035, 0.8 + R() * 0.15); } break; }
      case 'splash': this.noiseHit(0.5, 0.6 * vol, 3000, 400, 0.6, 0, 'lowpass', D); this.noiseHit(0.25, 0.35 * vol, 6000, 1500, 0.8, 0.04, 'bandpass', D); this.tone('sine', 180, 60, 0.2, 0.2 * vol, 0, D); break;
      case 'reload': this.noiseHit(0.08, 0.35 * vol, 900, 200, 1.2, 0, 'bandpass', D); this.modal([180, 420, 760], 0.12, 0.12 * vol, 0.02); this.noiseHit(0.05, 0.25 * vol, 2500, 800, 1, 0.12, 'bandpass', D); this.modal([240, 560], 0.1, 0.1 * vol, 0.13); break;
      case 'shot_twin': if (!this.throttle(name, 40)) return; for (const w of [0, 0.07]) { this.noiseHit(0.03, 0.5 * vol, 8000, 2500, 0.6, w, 'highpass', D); this.noiseHit(0.8, 0.55 * vol, 2000, 60, 0.7, w, 'lowpass', D); this.tone('sine', 85, 32, 0.45, 0.4 * vol, w, D); } break;
      case 'shot_mg': { if (!this.throttle(name, vx && vx.mg === 2 ? 30 : 55)) return; const M = vx ? vx.mg | 0 : 0, R = Math.random, P = 0.95 + R() * 0.1; // r25: 0 light / 1 heavy / 2 gatling
        if (M === 1) { this.noiseHit(0.03, 0.9 * vol, 6000, 1800, 0.7, 0, 'highpass', D); this.noiseHit(0.2, 1 * vol, 1500 * P, 200, 0.9, 0, 'bandpass', D); this.tone('sine', 95 * P, 40, 0.12, 0.6 * vol, 0, D); }
        else if (M === 2) { this.noiseHit(0.015, 0.7 * vol, 8000, 4000, 0.7, 0, 'highpass', D); this.noiseHit(0.05, 0.7 * vol, 3400 * P, 900, 1.1, 0, 'bandpass', D); this.tone('sawtooth', 210 * P, 160, 0.04, 0.15 * vol, 0, D); }
        else { this.noiseHit(0.02, 0.9 * vol, 7000, 3000, 0.7, 0, 'highpass', D); this.noiseHit(0.1, 0.9 * vol, 2600 * P, 500, 0.9, 0, 'bandpass', D); this.tone('sine', 140 * P, 60, 0.07, 0.5 * vol, 0, D); }
        if (vx && vx.me && R() < 0.3) this.modal([5200 + R() * 800, 7600], 0.08, 0.02, 0.25 + R() * 0.2); break; }
      case 'shot_rocket': if (!this.throttle(name, 60)) return; this.noiseHit(0.25, 0.5 * vol, 1400, 120, 0.7, 0, 'lowpass', D); { const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.6; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.35); f.frequency.exponentialRampToValueAtTime(900, t + 1.3); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4 * vol, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); s.connect(f); f.connect(g); g.connect(D); s.start(t); s.stop(t + 1.5); } break;
      case 'shot_shotgun': if (!this.throttle(name, 60)) return; this.noiseHit(0.03, 0.6 * vol, 8000, 2500, 0.6, 0, 'highpass', D); this.noiseHit(0.7, 0.6 * vol, 2600, 70, 0.8, 0, 'lowpass', D); this.tone('sine', 95, 35, 0.35, 0.4 * vol, 0, D); break;
      case 'shot_flame': if (!this.throttle(name, 110)) return; this.noiseHit(0.3, 0.2 * vol, 900, 300, 0.5, 0, 'lowpass', D); this.noiseHit(0.2, 0.1 * vol, 3000, 1500, 0.6, 0, 'bandpass', D); break;
      case 'shot_laser': if (!this.throttle(name, 50)) return; this.tone('square', 2400, 900, 0.09, 0.08 * vol); this.tone('sine', 1200, 600, 0.12, 0.1 * vol); break;
      case 'shot_emp': if (!this.throttle(name, 80)) return; this.tone('sine', 300, 1600, 0.25, 0.16 * vol); this.tone('square', 60, 60, 0.2, 0.08 * vol); break;
      case 'shot_ricochet': if (!this.throttle(name, 60)) return; this.modal([2900, 4300, 6100], 0.35, 0.12 * vol); this.tone('sine', 3400, 1700, 0.4, 0.08 * vol, 0.01, D); this.noiseHit(0.04, 0.3 * vol, 6000, 2500, 1, 0, 'highpass', D); break;
      case 'shot_rail': if (!this.throttle(name, 60)) return; this.tone('sawtooth', 1800, 120, 0.35, 0.16 * vol); this.tone('sine', 90, 40, 0.3, 0.3 * vol); this.noiseHit(0.2, 0.25 * vol, 8000, 600, 2, 0, 'bandpass'); break;
      case 'hit_metal': if (!this.throttle(name, 30)) return; this.noiseHit(0.03, 0.35 * vol, 7000, 2500, 0.8, 0, 'highpass', D); this.modal([610, 1270, 2140, 3330], 0.45, 0.2 * vol); if (Math.random() < 0.35) this.tone('sine', 3600, 1900, 0.35, 0.06 * vol, 0.02, D); break;
      case 'ram': if (!this.throttle(name, 120)) return; this.noiseHit(0.25, 0.5 * vol, 1200, 150, 0.6, 0, 'lowpass', D); this.modal([180, 395, 720, 1180], 0.8, 0.3 * vol); break;
      case 'hit_tank': if (!this.throttle(name, 30)) return; this.noiseHit(0.03, 0.4 * vol, 6000, 2000, 0.8, 0, 'highpass', D); this.modal([290, 655, 1110, 1730], 0.6, 0.26 * vol); this.tone('sine', 90, 40, 0.2, 0.35 * vol, 0, D); break;
      case 'crumble': if (!this.throttle(name, 60)) return; { const big = vx === 0; this.noiseHit(big ? 0.7 : 0.3, (big ? 0.5 : 0.3) * vol, big ? 900 : 2200, 90, 0.8, 0, 'lowpass', D); for (let i = 0; i < (big ? 9 : 4); i++) this.noiseHit(0.04 + Math.random() * 0.05, 0.14 * vol, vx === 2 ? 1800 : 2600, 700, 1, 0.04 + Math.random() * (big ? 0.6 : 0.25), 'bandpass', D); if (vx === 2) this.noiseHit(0.5, 0.25 * vol, 400, 60, 0.6, 0.15, 'lowpass', D); } break; // r37 collapse: house rumble+crack, fence snap, tree crack+thud
      case 'brick': if (!this.throttle(name, 35)) return; this.noiseHit(0.22, 0.4 * vol, 1500, 160, 0.6, 0, 'lowpass', D); for (let i = 0; i < 4; i++) this.noiseHit(0.03, 0.12 * vol, 3000, 1200, 1, 0.05 + Math.random() * 0.25, 'bandpass', D); break;
      case 'crate': this.noiseHit(0.3, 0.45 * vol, 1100, 150, 0.8, 0, 'lowpass', D); for (let i = 0; i < 5; i++) this.noiseHit(0.025, 0.15 * vol, 2200, 900, 2, Math.random() * 0.2, 'bandpass', D); this.tone('sine', 150, 70, 0.12, 0.2 * vol, 0, D); break;
      case 'boom': if (!this.throttle(name, 50)) return; this.noiseHit(0.05, 0.8 * vol, 8000, 2000, 0.5, 0, 'highpass', D); this.noiseHit(2.4, 0.9 * vol, 2600, 30, 0.7, 0, 'lowpass', D); this.tone('sine', 55, 20, 1.3, 0.8 * vol, 0, D); for (let i = 0; i < 9; i++) this.noiseHit(0.04, 0.12 * vol, 3500, 1500, 1, 0.15 + Math.random() * 1.1, 'bandpass', D); break;
      case 'boom_small': if (!this.throttle(name, 40)) return; this.noiseHit(0.03, 0.5 * vol, 8000, 2500, 0.5, 0, 'highpass', D); this.noiseHit(1.1, 0.6 * vol, 2200, 50, 0.7, 0, 'lowpass', D); this.tone('sine', 80, 30, 0.5, 0.45 * vol, 0, D); break;
      case 'boom_rocket': if (!this.throttle('boom_small', 40)) return; this.noiseHit(0.04, 0.6 * vol, 9000, 2500, 0.5, 0, 'highpass', D); this.noiseHit(1.6, 0.75 * vol, 3000, 40, 0.7, 0, 'lowpass', D); this.tone('sine', 64, 24, 0.8, 0.6 * vol, 0, D); for (let i = 0; i < 6; i++) this.noiseHit(0.03, 0.1 * vol, 4000, 1500, 1, 0.1 + Math.random() * 0.7, 'bandpass', D); break;
      case 'pick': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.07, 0.12 * vol, i * 0.05)); break;
      case 'weapon': [392, 523, 659, 784, 988].forEach((f, i) => this.tone('sawtooth', f, f * 1.01, 0.07, 0.09 * vol, i * 0.04)); break;
      case 'click': this.tone('triangle', 880, 660, 0.04, 0.08 * vol); break;
      case 'tap': this.tone('triangle', 660, 660, 0.03, 0.08 * vol); break;
      case 'beep': this.tone('triangle', 660, 660, 0.12, 0.12 * vol); break;
      case 'go': this.tone('triangle', 990, 990, 0.3, 0.14 * vol); this.tone('triangle', 1320, 1320, 0.3, 0.08 * vol); break;
      case 'zone': this.tone('sawtooth', 300, 600, 0.5, 0.08 * vol); this.tone('sawtooth', 600, 300, 0.5, 0.08 * vol, 0.5); break;
      case 'kill': [660, 880, 1320].forEach((f, i) => this.tone('triangle', f, f, 0.06, 0.12 * vol, i * 0.05)); break;
      case 'hurt': if (!this.throttle(name, 120)) return; this.tone('sawtooth', 120, 50, 0.18, 0.25 * vol); break;
      case 'coin': this.tone('triangle', 988, 988, 0.05, 0.08 * vol); this.tone('triangle', 1319, 1319, 0.12, 0.08 * vol, 0.05); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.12 * vol, i * 0.11)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.25, 0.18 * vol, i * 0.2)); break;
      case 'levelup': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => { this.tone('triangle', f, f, 0.1, 0.1 * vol, i * 0.07); this.tone('triangle', f / 2, f / 2, 0.1, 0.1 * vol, i * 0.07); }); break;
      case 'spawn': this.tone('sine', 300, 900, 0.3, 0.08 * vol); break;
      // r36 sounds: lightning crackle (pitch by tier), Molotov throw/shatter/fire, hunt traps (each its own timbre), target tank swap
      case 'zap': { if (!this.throttle(name, 45)) return; const z = vx | 0 || 1, P = [1, 1, 0.8, 0.62][z]; for (let i = 0; i < 5; i++) this.noiseHit(0.018, (0.35 - i * 0.04) * vol, 9000, 3000 * P, 1.4, i * 0.022 + Math.random() * 0.01, 'highpass', D); this.tone('sawtooth', 1900 * P, 240 * P, 0.16, 0.12 * vol, 0, D); this.tone('square', 95 * P, 60, 0.1, 0.1 * vol, 0, D); break; }
      case 'molo_throw': this.noiseHit(0.25, 0.22 * vol, 1800, 500, 1.2, 0, 'bandpass', D); this.tone('sine', 420, 180, 0.22, 0.05 * vol, 0, D); break;
      case 'molo_boom': if (!this.throttle(name, 60)) return; this.modal([2300, 3500, 5200, 6900], 0.25, 0.14 * vol); for (let i = 0; i < 6; i++) this.noiseHit(0.03, 0.15 * vol, 8000, 3500, 1.5, Math.random() * 0.12, 'highpass', D); this.noiseHit(0.9, 0.5 * vol, 1400, 120, 0.6, 0.05, 'lowpass', D); this.noiseHit(1.2, 0.25 * vol, 3000, 600, 0.5, 0.15, 'bandpass', D); break;
      case 'fire': if (!this.throttle(name, 260)) return; this.noiseHit(0.35, 0.12 * vol, 1200, 300, 0.4, 0, 'lowpass', D); for (let i = 0; i < 2; i++) this.noiseHit(0.02, 0.07 * vol, 5000, 2000, 2, Math.random() * 0.2, 'bandpass', D); break;
      case 'trap': { const k = vx | 0, T = [[90, 'boom'], [1400, 'emp'], [300, 'hiss'], [180, 'slick'], [900, 'spike'], [600, 'mag'], [1200, 'holo'], [700, 'tur'], [140, 'box'], [220, 'wall'], [2400, 'flare'], [500, 'tele']][k] || [400];
        const f = T[0]; if (k === 0 || k === 8) { this.noiseHit(1.2, 0.7 * vol, 2400, 40, 0.7, 0, 'lowpass', D); this.tone('sine', 60, 22, 0.7, 0.55 * vol, 0, D); } else if (k === 1) { this.tone('sine', 200, 1800, 0.3, 0.16 * vol); this.tone('square', 60, 40, 0.4, 0.1 * vol); } else if (k === 2) this.noiseHit(1, 0.3 * vol, 2500, 700, 0.5, 0, 'bandpass', D);
        else if (k === 10) { this.tone('sine', 2400, 3800, 0.15, 0.12 * vol); this.noiseHit(0.6, 0.25 * vol, 9000, 2500, 0.8, 0, 'highpass', D); } else if (k === 11) { this.tone('sine', 300, 1600, 0.35, 0.12 * vol); this.tone('triangle', 1600, 300, 0.35, 0.08 * vol, 0.3); } else if (k === 6) { [880, 1175, 1568].forEach((q, i) => this.tone('sine', q, q * 1.02, 0.12, 0.08 * vol, i * 0.06)); }
        else { this.modal([f, f * 2.3, f * 3.7], 0.25, 0.16 * vol); this.noiseHit(0.08, 0.25 * vol, 4000, f, 1, 0, 'bandpass', D); } break; }
      case 'htank': [220, 330, 440, 660].forEach((q, i) => this.tone('sawtooth', q * (vx || 1), q * (vx || 1) * 1.5, 0.12, 0.07 * vol, i * 0.07)); this.noiseHit(0.5, 0.25 * vol, 2000, 200, 0.6, 0, 'lowpass', D); break;
    }
  }
  // ---------- music (r15: original procedural score — cinematic menu, driving battle, tense final circle, stingers) ----------
  setVolumes(music, sfx) { this.musVol = music; this.sfxVol = sfx; if (this.mus) { this.mus.gain.value = 0.34 * music; this.sfx.gain.value = 0.6 * sfx; } }
  setIntensity(x) { this.inten = Math.max(0, Math.min(1, x)); }
  bus() {
    if (this.mbus) return; const c = this.ctx;
    // music chain: voices -> duck (sidechain pump) -> warm lowpass + low-shelf cut of mud -> music gain; reverb + dotted delay sends
    this.duck = c.createGain(); this.mtone = c.createBiquadFilter(); this.mtone.type = 'lowpass'; this.mtone.frequency.value = 9000; this.mtone.Q.value = 0.4;
    const hs = c.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 5000; hs.gain.value = -5; // tame harshness on phone speakers
    this.duck.connect(this.mtone); this.mtone.connect(hs); hs.connect(this.mus);
    const len = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.2); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revIn = c.createGain(); this.revIn.gain.value = 0.32; this.revIn.connect(this.rev); this.rev.connect(this.duck);
    this.dly = c.createDelay(1); this.dlyFb = c.createGain(); this.dlyFb.gain.value = 0.32; this.dlyIn = c.createGain(); this.dlyIn.gain.value = 0.22; const dlf = c.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2600;
    this.dlyIn.connect(this.dly); this.dly.connect(dlf); dlf.connect(this.dlyFb); this.dlyFb.connect(this.dly); dlf.connect(this.duck);
    this.mbus = this.duck; this.inten = this.inten || 0;
    if (this.musVol != null) this.setVolumes(this.musVol, this.sfxVol);
  }
  playMusic(name) {
    this.wanted = name; if (!this.musicOn || !this.ensure()) return; if (this.track === name && this.timer) return;
    this.bus(); this.stopMusic(); this.track = name; this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stopMusic() { if (this.timer) clearInterval(this.timer); this.timer = null; this.track = null; }
  stinger(kind) {
    if (!this.musicOn || !this.ensure()) return; this.bus(); this.stopMusic(); const t = this.ctx.currentTime + 0.05;
    const seq = kind === 'win' ? [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42], [16, 0.62]] : [[0, 0], [-1, 0.3], [-4, 0.6], [-7, 0.95]];
    const root = kind === 'win' ? 60 : 57;
    for (const [n, dt] of seq) { this.voice('saw', root + n, t + dt, kind === 'win' ? 0.9 : 1.2, 0.12, { cut: 3200, rev: 0.6 }); this.voice('saw', root + n + 12, t + dt, 0.7, 0.05, { cut: 4000, det: 9, rev: 0.6 }); }
    this.voice('sine', root - 24, t, 2.2, 0.35, { rev: 0.3 }); this.drum('boom', t, 1); if (kind === 'win') this.drum('crash', t + 0.62, 0.8);
    setTimeout(() => { if (!this.track && this.wanted) this.playMusic(this.wanted); }, 3500);
  }
  schedule() {
    if (!this.ctx) return; const S = SONGS[this.track]; if (!S) return; const spb = 60 / S.bpm / 4;
    if (this.dly) this.dly.delayTime.value = spb * 3; // dotted-eighth echo locked to tempo
    // intensity opens the filter and adds layers
    const it = this.inten || 0; if (this.mtone) this.mtone.frequency.setTargetAtTime(S.cut0 + (9500 - S.cut0) * (0.35 + it * 0.65), this.ctx.currentTime, 0.6);
    while (this.nextT < this.ctx.currentTime + 0.12) { this.playStep(S, this.step, this.nextT, spb); this.step++; this.nextT += spb; }
  }
  // one synth voice: osc(s) -> filter env -> amp env -> bus (+ sends)
  voice(type, n, t, dur, vol, o = {}) {
    const c = this.ctx, f = 440 * Math.pow(2, (n - 69) / 12), g = c.createGain(), fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.Q.value = o.q || 0.7; const cut = o.cut || 2400; fl.frequency.setValueAtTime(cut * (o.fenv || 1), t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.4), t + dur);
    const atk = o.atk || 0.008; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.setTargetAtTime(0.0001, t + Math.max(atk, dur * 0.6), dur * 0.25 + 0.02);
    const oscs = o.det ? [-o.det, o.det] : [0];
    for (const d of oscs) { const os = c.createOscillator(); os.type = type === 'saw' ? 'sawtooth' : type; os.frequency.value = f; os.detune.value = d; os.connect(fl); os.start(t); os.stop(t + dur * 1.6 + 0.3); }
    fl.connect(g); g.connect(this.mbus); if (o.rev) { const s = c.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(this.revIn); } if (o.dly) { const s = c.createGain(); s.gain.value = o.dly; g.connect(s); s.connect(this.dlyIn); }
  }
  drum(k, t, v = 1) {
    const c = this.ctx, g = c.createGain();
    if (k === 'k' || k === 'boom') { // kick + sidechain pump on the whole music bus
      const o = c.createOscillator(); o.frequency.setValueAtTime(k === 'boom' ? 90 : 160, t); o.frequency.exponentialRampToValueAtTime(k === 'boom' ? 32 : 44, t + (k === 'boom' ? 0.5 : 0.11));
      g.gain.setValueAtTime(0.95 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (k === 'boom' ? 0.9 : 0.32)); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 1);
      const dg = this.duck.gain; dg.cancelScheduledValues(t); dg.setValueAtTime(0.35, t); dg.linearRampToValueAtTime(1, t + (k === 'boom' ? 0.5 : 0.2)); return;
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = this.noise;
    const P = { s: ['bandpass', 1900, 0.45, 0.16], h: ['highpass', 8000, 0.1, 0.035], o: ['highpass', 7000, 0.12, 0.18], crash: ['highpass', 5000, 0.25, 1.4], tom: ['lowpass', 380, 0.7, 0.35] }[k];
    f.type = P[0]; f.frequency.value = P[1]; g.gain.setValueAtTime(P[2] * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + P[3]);
    s.connect(f); f.connect(g); g.connect(this.mbus); if (k === 's' || k === 'tom' || k === 'crash') { const r = c.createGain(); r.gain.value = 0.4; g.connect(r); r.connect(this.revIn); }
    if (k === 's') { const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); og.gain.setValueAtTime(0.25 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og); og.connect(this.mbus); o.start(t); o.stop(t + 0.12); }
    s.start(t, Math.random() * 0.5); s.stop(t + P[3] + 0.05);
  }
  playStep(S, step, t, spb) {
    const bar = Math.floor(step / 16), i = step % 16, root = S.prog[bar % S.prog.length], it = this.inten || 0, sect = Math.floor(bar / 4) % 4; // 4-bar sections
    const ch = S.minor ? [0, 3, 7] : [0, 4, 7];
    // pads / strings: chord on bar start, long and wide
    if (i === 0) for (const n of ch) { this.voice('saw', root + n + 48, t, spb * 16, S.pad, { det: 12, cut: 1500, atk: 0.35, rev: 0.7 }); }
    if (S.brass && i === 0 && sect >= 1) this.voice('saw', root + 36, t, spb * 14, 0.06, { det: 6, cut: 900, atk: 0.2, rev: 0.5 });
    // bass
    const b = S.bass[i]; if (b != null) this.voice(S.bassW || 'saw', root + b + 24, t, spb * (S.bassLen || 1.6), S.bassV || 0.22, { cut: 700 + it * 900, fenv: 2.2, q: 4 });
    // arp / ostinato (layer grows with intensity)
    const a = S.arp[step % S.arp.length]; if (a != null && (sect > 0 || S.arpAlways) && (it > 0.2 || S.arpAlways || i % 2 === 0)) this.voice('square', root + ch[a % 3] + 60 + 12 * Math.floor(a / 3), t, spb * 0.8, 0.035 + it * 0.02, { cut: 2600 + it * 2500, dly: 0.45 });
    // lead hook in sections 2-3
    const l = S.lead && S.lead[step % S.lead.length]; if (l != null && sect >= 2) this.voice('saw', root + l + 60, t, spb * 1.8, 0.05, { det: 7, cut: 3200, rev: 0.35, dly: 0.3 });
    // drums
    const d = S.drums[i]; if (d) for (const k of d.split('')) this.drum(k === 'H' ? 'o' : k === 'T' ? 'tom' : k, t, 1);
    if (it > 0.55 && i % 2 === 1 && S.hatFill) this.drum('h', t, 0.7); // intensity hats
    if (i === 0 && bar % 8 === 0 && bar) this.drum('crash', t, 0.6);
    if (S.riser && i === 0 && it > 0.7) this.voice('saw', root + 72, t, spb * 16, 0.02, { cut: 6000, fenv: 0.3 });
  }
}
const _ = null;
const SONGS = {
  // hybrid orchestral/synth theme: slow taiko-like toms, wide strings, brass swells
  menu: { bpm: 92, minor: true, prog: [57, 53, 48, 55], pad: 0.05, brass: true, cut0: 2200, bassW: 'triangle', bassV: 0.3, bassLen: 6,
    bass: [0, _, _, _, _, _, _, _, 0, _, _, _, 7, _, _, _], arp: [0, 1, 2, 3, 2, 1], lead: [12, _, _, _, 15, _, 14, _, 12, _, _, _, 10, _, 7, _],
    drums: ['k', _, _, _, 'T', _, _, 'T', _, _, 'k', _, 'sT', _, _, _] },
  // driving electronic battle track, 132 BPM
  battle: { bpm: 132, minor: true, prog: [57, 57, 53, 55, 57, 57, 50, 52], pad: 0.03, cut0: 1600, hatFill: true, riser: true,
    bass: [0, _, 0, 12, _, 0, 0, _, 0, _, 0, 12, _, 0, 10, 12], arp: [0, 1, 2, 4, 2, 1, 3, 1], lead: [12, _, 15, _, 19, _, 17, 15, 12, _, _, 10, 12, _, _, _],
    drums: ['kh', 'h', 'H', 'h', 'ksh', 'h', 'H', 'h', 'kh', 'h', 'H', 'h', 'ksh', 'h', 'H', 's'] },
  // BR final circle: 140 BPM, half-time heavy, chromatic dread ostinato
  final: { bpm: 140, minor: true, prog: [52, 52, 53, 52], pad: 0.035, cut0: 1200, hatFill: true, riser: true, arpAlways: true,
    bass: [0, 0, _, 0, 1, _, 0, _, 0, 0, _, 0, -1, _, 0, _], arp: [0, 3, 1, 4], lead: [12, _, 13, _, 12, _, 15, _, 13, _, 12, _, 11, _, 12, _],
    drums: ['kh', 'h', 'h', 'kh', 'h', 'h', 'ks', 'h', 'kh', 'h', 'kh', 'h', 'h', 'h', 'ksT', 'T'] },
  classic: { bpm: 128, minor: false, prog: [60, 60, 65, 67], pad: 0.025, cut0: 3000, arpAlways: true, bassW: 'square', bassV: 0.12,
    bass: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 7, _, 12, _], arp: [0, 1, 2, 3], lead: [12, _, 14, _, 16, _, 19, _, 16, _, 14, _, 12, _, _, _],
    drums: ['k', _, 'h', _, 's', _, 'h', _, 'k', _, 'h', 'k', 's', _, 'h', _] },
};
