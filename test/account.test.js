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

test('first link copies device progress and a second link does not reset it', () => {
  const a = createAccount(db, { name: 'Ana', local: { coins: 800, rp: 40, kills: 12, name: 'Ana', tmods: { [leg]: [2, 0, 0, 0, 0], [myth]: [5, 5, 5, 5, 5] } } });
  assert.equal(a.imported, true);
  assert.equal(a.coins, 800);
  assert.equal(a.server, true);
  assert.deepEqual(a.tmods[String(leg)], [2, 0, 0, 0, 0]);
  assert.equal(a.tmods[String(myth)], undefined);
  const again = createAccount(db, { token: a.token, local: { coins: 1, rp: 0, kills: 0, tmods: {} } });
  assert.equal(again.coins, 800);
  assert.equal(again.token, a.token);
});

test('legendary upgrade spends earned coins; mythic spend is refused', () => {
  const a = createAccount(db, { local: { coins: 150, tmods: {} } });
  const no = spendLegendary(db, a.token, myth, 0);
  assert.equal(no.ok, false);
  assert.equal(no.error, 'payments-off');
  assert.equal(createAccount(db, { token: a.token }).coins, 150);
  const yes = spendLegendary(db, a.token, leg, 0);
  assert.equal(yes.ok, true);
  assert.equal(yes.cost, 100);
  assert.equal(yes.account.coins, 50);
  assert.equal(yes.account.tmods[String(leg)][0], 1);
  const poor = spendLegendary(db, a.token, leg, 1);
  assert.equal(poor.ok, false);
  assert.equal(poor.error, 'coins');
});

test('online match credit uses the server formula and does not pay twice', () => {
  const a = createAccount(db, { local: { coins: 10, rp: 0, kills: 0 } });
  const summary = { mode: 'team', win: true, kills: 2, place: 0, total: 4, online: true };
  const once = creditMatch(db, a.token, 'room-9', summary);
  const twice = creditMatch(db, a.token, 'room-9', summary);
  assert.equal(once.coins, 10 + matchCoins(summary));
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
