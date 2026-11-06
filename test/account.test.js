import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { openStore, createAccount, spendLegendary, creditMatch, legendaryTmods } from '../src/account/store.js';
import { MODELS } from '../src/sim/models.js';
import { matchCoins } from '../src/sim/progress.js';

const file = path.join(os.tmpdir(), 'pb-acct-' + process.pid + '.sqlite');
const db = openStore(file);
const leg = MODELS.find(m => m.rar === 3).id;
const myth = MODELS.find(m => m.rar === 4).id;

test('a device snapshot does not become spendable coins, rank, or legendary mods', () => {
  const a = createAccount(db, { name: 'Ana', local: { coins: 999999999, rp: 5000000, kills: 999999, name: 'Ana', tmods: { [leg]: [5, 5, 5, 5, 5], [myth]: [5, 5, 5, 5, 5] } } });
  assert.equal(a.imported, true);
  assert.equal(a.coins, 0);
  assert.equal(a.rp, 0);
  assert.equal(a.kills, 0);
  assert.deepEqual(a.tmods, {});
  assert.equal(a.deviceNote.accepted, false);
  assert.equal(a.deviceNote.coins, 999999999);
  const again = createAccount(db, { token: a.token, local: { coins: 1, rp: 9, kills: 0, tmods: { [leg]: [5, 0, 0, 0, 0] } } });
  assert.equal(again.coins, 0);
  assert.equal(again.token, a.token);
  assert.deepEqual(again.tmods, {});
  const spent = spendLegendary(db, a.token, leg, 0);
  assert.equal(spent.ok, false);
  assert.equal(spent.error, 'coins');
});

test('legendary upgrade spends server-earned coins; a device balance and mythic spend are refused', () => {
  const a = createAccount(db, { local: { coins: 999999, tmods: { [leg]: [5, 0, 0, 0, 0] } } });
  assert.equal(a.coins, 0);
  const blocked = spendLegendary(db, a.token, leg, 0);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'coins');
  const summary = { mode: 'team', win: true, kills: 80, place: 0, total: 4 };
  const earned = matchCoins(summary);
  assert.ok(earned >= 100);
  const credited = creditMatch(db, a.token, 'earn-leg', summary);
  assert.equal(credited.coins, earned);
  const no = spendLegendary(db, a.token, myth, 0);
  assert.equal(no.ok, false);
  assert.equal(no.error, 'payments-off');
  const yes = spendLegendary(db, a.token, leg, 0);
  assert.equal(yes.ok, true);
  assert.equal(yes.cost, 100);
  assert.equal(yes.account.coins, earned - 100);
  assert.equal(yes.account.tmods[String(leg)][0], 1);
});

test('online match credit uses the server formula and does not pay twice', () => {
  const a = createAccount(db, { local: { coins: 10, rp: 0, kills: 0 } });
  assert.equal(a.coins, 0);
  const summary = { mode: 'team', win: true, kills: 2, place: 0, total: 4, online: true };
  const once = creditMatch(db, a.token, 'room-9', summary);
  const twice = creditMatch(db, a.token, 'room-9', summary);
  assert.equal(once.coins, matchCoins(summary));
  assert.equal(twice.coins, once.coins);
  assert.equal(once.matches, 1);
  assert.ok(once.rp > 0);
});

test('legendaryTmods drops non-legendary rows', () => {
  const out = legendaryTmods({ [leg]: [1, 2, 0, 0, 9], [myth]: [1, 1, 1, 1, 1], 3: [1, 0, 0, 0, 0] });
  assert.deepEqual(out[String(leg)], [1, 2, 0, 0, 5]);
  assert.equal(out[String(myth)], undefined);
});

after(() => { try { fs.unlinkSync(file); } catch {} });
