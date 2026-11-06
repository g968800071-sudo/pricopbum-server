import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { WebSocket } from 'ws';
import { World, HP_MUL, ARMOR_K, huntModel } from '../src/sim/sim.js';
import { MODELS } from '../src/sim/models.js';
import { snapshot } from '../src/net/protocol.js';
import { applyRank, rankDelta } from '../src/sim/rank.js';
import { T_HOUSE, T_TREE, T_TRENCH } from '../src/sim/trench.js';
import { T_MUD } from '../src/sim/defs.js';
import { ML_N } from '../src/sim/molotov.js';
import { roomOpts, startServer, stopServer } from '../server/server.js';
import { HostSession } from '../src/net/host.js';
import { HUNT } from '../src/sim/defs.js';

function boot(opts) {
  const w = new World({ countdown: 0, seed: 7, diff: 1, ...opts });
  w.state = 'play';
  w.countdown = 0;
  return w;
}
function smallTeam(extra = {}, players) {
  return boot({ mode: 'team', perTeam: 1, noBots: true, noBunker: true, mapW: 36, mapH: 24, timeLimit: 600, target: 100, players: players || [{ name: 'A', human: true, cid: 'a', team: 0 }, { name: 'B', human: true, cid: 'b', team: 1 }], ...extra });
}

test('default lives are 3; hunt overrides the solo tank to 5 and hunters stay at 3', () => {
  const team = smallTeam();
  for (const t of team.tanks) assert.equal(t.lives, 3, t.name);
  const hunt = boot({ mode: 'team', special: 'hunt', noBunker: true, map: 15, mapW: 64, mapH: 40, timeLimit: 600, players: [{ name: 'Solo', human: true, cid: 'solo', model: 0 }], huntTarget: 'solo' });
  const target = hunt.tanks.find(t => t.isTarget);
  const hunters = hunt.tanks.filter(t => !t.isTarget);
  assert.equal(hunters.length, 5);
  assert.equal(target.lives, HUNT.tLives);
  assert.equal(target.infAmmo, true);
  assert.equal(target.ammo, null);
  for (const h of hunters) {
    assert.equal(h.lives, HUNT.hLives);
    assert.ok(h.model >= 0 && (MODELS[h.model].rar === 0 || MODELS[h.model].rar === 3), 'hunter rarity ' + MODELS[h.model].rar);
  }
  assert.equal(hunt.map.sunny, 1);
  assert.equal(hunt.map.hgt, undefined);
});

test('a lost hunt life respawns the solo tank in a different tank with ammo still unlimited', () => {
  const hunt = boot({ mode: 'team', special: 'hunt', noBunker: true, map: 15, mapW: 64, mapH: 40, players: [{ name: 'Solo', human: true, cid: 'solo', model: 4 }], huntTarget: 'solo' });
  const target = hunt.tanks.find(t => t.isTarget);
  const hunter = hunt.tanks.find(t => !t.isTarget);
  const before = target.model;
  target.hp = 1; target.inv = 0; hunter.inv = 0;
  hunt.damage(target, 1e6, hunter.id, 'cannon', target.x, target.y);
  assert.equal(target.alive, false);
  assert.equal(target.lives, 4);
  for (let i = 0; i < 300; i++) hunt.step(1 / 30);
  assert.equal(target.alive, true);
  assert.notEqual(target.model, before);
  assert.equal(target.infAmmo, true);
  assert.equal(target.ammo, null);
});

test('huntModel never puts a hunter in a rare, epic or mythic tank', () => {
  const myth = MODELS.find(m => m.rar === 4).id;
  for (let i = 0; i < 40; i++) {
    const id = huntModel(() => (i * 17 % 100) / 100, i % 2 ? myth : 2);
    assert.ok(MODELS[id].rar === 0 || MODELS[id].rar === 3);
  }
});

test('global +25% armour is applied once and an armour crate does not multiply hull HP again', () => {
  const w = smallTeam();
  const me = w.tanks.find(t => t.cid === 'a');
  const expected = Math.round(100 * HP_MUL * ARMOR_K);
  assert.equal(ARMOR_K, 1.25);
  assert.equal(me.maxHp, expected);
  const hp = me.maxHp;
  assert.equal(w.applyPickup(me, { type: 'armor', tier: 3, ak: 0, x: me.x, y: me.y, t: 0, life: 1 }), true);
  assert.equal(w.applyPickup(me, { type: 'armor', tier: 3, ak: 0, x: me.x, y: me.y, t: 0, life: 1 }), false);
  assert.equal(me.maxHp, hp);
  assert.ok(me.armorHp > 0);
  me.hp = 1; me.inv = 0;
  const foe = w.tanks.find(t => t.cid === 'b');
  w.damage(me, 1e6, foe.id, 'cannon', me.x, me.y);
  assert.equal(me.lives, 2);
  for (let i = 0; i < 200; i++) w.step(1 / 30);
  assert.equal(me.alive, true);
  assert.equal(me.maxHp, hp);
});

test('a fire crate gives exactly 8 molotovs and the burn zone hurts another tank', () => {
  const w = smallTeam();
  const me = w.tanks.find(t => t.cid === 'a');
  const foe = w.tanks.find(t => t.cid === 'b');
  assert.equal(w.applyPickup(me, { type: 'fire', x: me.x, y: me.y, t: 0, life: 1 }), true);
  assert.equal(me.molotovN, ML_N);
  assert.equal(w.applyPickup(me, { type: 'fire', x: me.x, y: me.y, t: 0, life: 1 }), false);
  assert.equal(me.molotovN, 8);
  me.ta = 0; me.a = 0;
  foe.x = me.x + 90; foe.y = me.y; foe.inv = 0;
  assert.equal(w.doAction(me, 'molotov_90'), true);
  assert.equal(me.molotovN, 7);
  const hp0 = foe.hp;
  for (let i = 0; i < 180; i++) w.step(1 / 30);
  assert.ok((w.fires || []).length > 0 || foe.hp < hp0);
  assert.ok(foe.hp < hp0, 'burn zone should damage the other tank');
});

test('trench is 15 vs 15, destructible village, no hills, and the higher kill score wins at 15 minutes', () => {
  const w = boot({ mode: 'team', special: 'trench', noBunker: true, perTeam: 15, map: 16, mapW: 80, mapH: 48, timeLimit: 900, target: 1e9, players: [] });
  assert.equal(w.tanks.filter(t => t.team === 0).length, 15);
  assert.equal(w.tanks.filter(t => t.team === 1).length, 15);
  assert.equal(w.map.hgt, undefined);
  assert.equal(w.map.trench, 1);
  let house = 0, mud = 0, trench = 0, tree = 0;
  for (let i = 0; i < w.map.t.length; i++) {
    const v = w.map.t[i];
    if (v === T_HOUSE) house++; else if (v === T_MUD) mud++; else if (v === T_TRENCH) trench++; else if (v === T_TREE) tree++;
  }
  assert.ok(house > 0 && mud > 0 && trench > 0 && tree > 0, { house, mud, trench, tree });
  w.score = [2, 9];
  w.time = w.timeLimit;
  w.stepTeam(0);
  assert.equal(w.result.winnerTeam, 1);
  assert.equal(w.result.timeout, true);
});

test('hills and pits are only added for the big battle royale', () => {
  const br = boot({ mode: 'br', terrain: 1, total: 4, mapSize: 48, noBunker: true, players: [{ name: 'A', human: true, cid: 'a' }] });
  assert.ok(br.map.hgt && br.map.hgt.length === br.map.w * br.map.h);
  assert.ok(br.map.hz.some(f => f.h > 0) && br.map.hz.some(f => f.h < 0));
  const plain = boot({ mode: 'br', total: 4, mapSize: 40, noBunker: true, players: [] });
  assert.equal(plain.map.hgt, undefined);
  const team = smallTeam();
  assert.equal(team.map.hgt, undefined);
});

test('legendary coin mods apply; mythic real-money mods do not while payments are off', () => {
  const leg = MODELS.find(m => m.rar === 3).id;
  const myth = MODELS.find(m => m.rar === 4).id;
  const hp = (model, tmod) => boot({ mode: 'team', perTeam: 1, noBots: true, noBunker: true, mapW: 28, mapH: 20, players: [{ name: 'A', human: true, cid: 'a', team: 0, model, tmod }] }).tanks.find(t => t.human).maxHp;
  assert.ok(hp(leg, [5, 0, 0, 0, 0]) > hp(leg, null));
  assert.equal(hp(myth, [5, 0, 0, 0, 0]), hp(myth, null));
  const common = MODELS.find(m => m.rar === 0).id;
  assert.equal(hp(common, [5, 0, 0, 0, 0]), hp(common, null));
});

test('rank points rise on a win, fall on a loss, and do not go below zero', () => {
  assert.ok(rankDelta({ win: true, kills: 2, mode: 'team' }) > 0);
  assert.ok(rankDelta({ win: false, kills: 0, mode: 'team' }) < 0);
  const profile = { rp: 0, stats: { kills: 0 } };
  applyRank(profile, { win: true, kills: 3, mode: 'team' });
  const won = profile.rp;
  assert.ok(won > 0);
  applyRank(profile, { win: false, kills: 0, mode: 'team' });
  assert.ok(profile.rp < won);
  profile.rp = 0;
  applyRank(profile, { win: false, kills: 0, mode: 'team' });
  assert.equal(profile.rp, 0);
  assert.equal(applyRank(profile, { win: false, kills: 0, mode: 'team' }).rank.name, 'Рядовой');
});

test('distant armour crates stay visible to the client; other loot does not, and a hunt target receives every hunter', () => {
  const w = smallTeam();
  const me = w.tanks.find(t => t.cid === 'a');
  w.pickups.push({ id: 900, x: me.x + 2000, y: me.y, type: 'armor', tier: 2, life: 100, layer: 0 });
  w.pickups.push({ id: 901, x: me.x + 2000, y: me.y + 8, type: 'med', tier: 1, life: 100, layer: 0 });
  const snap = snapshot(w, me, [], [], false, me);
  const types = snap.P.map(p => p[3]);
  assert.ok(types.includes('armor'));
  assert.equal(types.includes('med'), false);
  const hunt = boot({ mode: 'team', special: 'hunt', noBunker: true, map: 15, mapW: 64, mapH: 40, players: [{ name: 'Solo', human: true, cid: 'solo' }], huntTarget: 'solo' });
  const target = hunt.tanks.find(t => t.isTarget);
  target.x = 30; target.y = 30;
  for (const h of hunt.tanks) if (h !== target) { h.x = hunt.map.pw - 40; h.y = 40; }
  const seen = new Set(snapshot(hunt, target, [], [], false, target).T.map(t => t[0]));
  for (const h of hunt.tanks) if (!h.isTarget) assert.ok(seen.has(h.id));
});

test('online room options keep hills on battle royale only and cap tanks at MAX_TANKS', () => {
  const br = roomOpts('br', 1, {});
  const trench = roomOpts('trench', 1, {});
  const hunt = roomOpts('hunt', 1, {});
  assert.equal(br.opts.terrain, 1);
  assert.equal(trench.opts.terrain, undefined);
  assert.equal(hunt.opts.terrain, undefined);
  assert.equal(br.opts.total, 150);
  assert.equal(trench.opts.timeLimit, 900);
  assert.equal(trench.opts.mapW, 220);
  assert.equal(trench.opts.perTeam, 15);
  assert.equal(roomOpts('br', 150, {}).opts.total, 150);
  assert.equal(roomOpts('team', 20, {}).opts.perTeam <= 12, true);
  assert.equal(hunt.opts.mapW, 120);
  assert.equal(hunt.opts.timeLimit, 600);
});

test('the match host keeps earned legendary mods and ignores unpaid mythic mods', () => {
  const leg = MODELS.find(m => m.rar === 3).id;
  const myth = MODELS.find(m => m.rar === 4).id;
  const host = new HostSession({ mode: 'team', players: [
    { cid: 'a', name: 'A', model: leg, tmod: [5, 0, 0, 0, 0], team: 0 },
    { cid: 'b', name: 'B', model: myth, tmod: [5, 0, 0, 0, 0], team: 1 },
  ], opts: { perTeam: 1, noBots: true, noBunker: true, mapW: 28, mapH: 20, countdown: 0 }, send() {} });
  const A = host.world.tanks.find(t => t.cid === 'a');
  const B = host.world.tanks.find(t => t.cid === 'b');
  assert.deepEqual(A.tmod, [5, 0, 0, 0, 0]);
  assert.equal(B.tmod, undefined);
  assert.ok(A.maxHp > B.maxHp * 0.5);
});

test('the shipped client does not grant a demo purchase', () => {
  const js = fs.readFileSync(new URL('../www/game.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
  assert.match(js, /Оплата реальными деньгами не подключена/);
  assert.equal(js.includes('Купить (демо)'), false);
  assert.equal(js.includes('€'), false);
  assert.match(html, /не магазинное приложение и не APK/);
});

test('two clients match, exchange snapshots, and one can rejoin after a drop', async () => {
  const server = await startServer(0);
  const port = server.address().port;
  try {
  const open = () => new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const msgs = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    ws.on('error', reject);
    ws.on('open', () => resolve({ ws, msgs }));
  });
  const waitFor = async (bag, pred, ms = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = bag.msgs.find(pred);
      if (hit) return hit;
      await new Promise(r => setTimeout(r, 30));
    }
    throw new Error('timeout ' + bag.msgs.map(m => m.t).join(','));
  };
  const health = await fetch('http://127.0.0.1:' + port + '/healthz');
  assert.equal(await health.text(), 'PRICOPBUM server OK');
  const page = await fetch('http://127.0.0.1:' + port + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PRICOPBUM/);
  const a = await open(), b = await open();
  const hello = (name) => ({ t: 'hello', v: 5, name, model: 10, tmod: [2, 0, 0, 0, 0], tlv: 4 });
  a.ws.send(JSON.stringify(hello('Alpha')));
  b.ws.send(JSON.stringify(hello('Bravo')));
  await waitFor(a, m => m.t === 'welcome');
  await waitFor(b, m => m.t === 'welcome');
  a.ws.send(JSON.stringify({ t: 'qm', mode: 'duel', name: 'Alpha', model: 10, tmod: [2, 0, 0, 0, 0] }));
  b.ws.send(JSON.stringify({ t: 'qm', mode: 'duel', name: 'Bravo', model: 10, tmod: [1, 0, 0, 0, 0] }));
  const start = await waitFor(a, m => m.t === 'start');
  await waitFor(b, m => m.t === 'start');
  const token = (await waitFor(a, m => m.t === 'rj')).token;
  assert.equal(start.mode, 'team');
  assert.equal(typeof token, 'string');
  await waitFor(a, m => m.t === 's');
  a.ws.send(JSON.stringify({ t: 'in', mx: 1, my: 0, fire: true }));
  await new Promise(r => { a.ws.once('close', r); a.ws.close(); });
  const a2 = await open();
  a2.ws.send(JSON.stringify({ t: 'rejoin', token }));
  const again = await waitFor(a2, m => m.t === 'start');
  assert.equal(again.me, start.me);
  await waitFor(a2, m => m.t === 's' && m.T && m.T.length >= 1);
  const snap = a2.msgs.filter(m => m.t === 's').at(-1);
  assert.ok(snap.T.length >= 2);
  await new Promise(r => { let n = 0; const done = () => { if (++n === 2) r(); }; b.ws.once('close', done); a2.ws.once('close', done); b.ws.close(); a2.ws.close(); });
  } finally { await stopServer(); }
});
