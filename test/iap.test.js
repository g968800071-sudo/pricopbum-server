import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { openStore, createAccount, grantAppleReceipt } from '../src/account/store.js';
import { APPLE_PRODUCTS, TIER_PRICES } from '../src/iap/products.js';
import { PRICE_TIERS } from '../src/client/catalog.js';
import { serverFeatures } from '../server/server.js';

const file = path.join(os.tmpdir(), 'pb-iap-' + process.pid + '.sqlite');
const db = openStore(file);

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function certBody(pem) {
  return pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
}
function selfSigned() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-iap-cert-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', key]);
  execFileSync('openssl', ['req', '-new', '-x509', '-key', key, '-out', cert, '-days', '2', '-subj', '/CN=xcode-test']);
  return { key: fs.readFileSync(key, 'utf8'), cert: fs.readFileSync(cert, 'utf8') };
}
function signJws(material, payload) {
  const header = { alg: 'ES256', x5c: [certBody(material.cert)] };
  const input = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const sig = crypto.sign('sha256', Buffer.from(input), { key: material.key, dsaEncoding: 'ieee-p1363' });
  return input + '.' + b64url(sig);
}
const keys = selfSigned();
function xcode(productId, transactionId, extra = {}) {
  return signJws(keys, { bundleId: 'studio.pricop.pricopbum', environment: 'Xcode', productId, transactionId, ...extra });
}

test('the Apple catalog matches the price tiers and the local StoreKit file', () => {
  assert.deepEqual(TIER_PRICES, PRICE_TIERS);
  const storekit = JSON.parse(fs.readFileSync(new URL('../ios/App/TouchUITests/PRICOPBUM.storekit', import.meta.url), 'utf8'));
  const ids = storekit.products.map(p => p.productID);
  assert.deepEqual(ids, APPLE_PRODUCTS.map(p => p.id));
  assert.equal(APPLE_PRODUCTS.find(p => p.id === 'coins_500').coins, 500);
  assert.equal(APPLE_PRODUCTS.find(p => p.id === 'coins_1400').coins, 1400);
  assert.equal(APPLE_PRODUCTS.find(p => p.id === 'coins_3000').coins, 3000);
  const features = serverFeatures();
  assert.equal(features.payments, false);
  assert.equal(features.appleIap, true);
});

test('an Xcode StoreKit receipt credits the catalog amount once and a cancel is not a receipt', () => {
  const a = createAccount(db, { local: { coins: 99999 } });
  assert.equal(a.coins, 0);
  const refused = grantAppleReceipt(db, { token: a.token, jws: xcode('coins_500', 'tx-off') }, { allowXcode: false });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'xcode-disabled');
  const signed = xcode('coins_500', 'tx-bad');
  const parts = signed.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  payload.productId = 'coins_38000';
  const tampered = parts[0] + '.' + b64url(JSON.stringify(payload)) + '.' + parts[2];
  const bad = grantAppleReceipt(db, { token: a.token, jws: tampered }, { allowXcode: true });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'signature');
  const sandbox = signJws(keys, { bundleId: 'studio.pricop.pricopbum', environment: 'Sandbox', productId: 'coins_500', transactionId: 'tx-sand' });
  const untrusted = grantAppleReceipt(db, { token: a.token, jws: sandbox }, { allowXcode: true });
  assert.equal(untrusted.ok, false);
  assert.equal(untrusted.error, 'apple-root');
  const first = grantAppleReceipt(db, { token: a.token, jws: xcode('coins_500', 'tx-500', { quantity: 9 }) }, { allowXcode: true });
  assert.equal(first.ok, true);
  assert.equal(first.replay, false);
  assert.equal(first.coinsAdded, 500);
  assert.equal(first.account.coins, 500);
  const again = grantAppleReceipt(db, { token: a.token, jws: xcode('coins_500', 'tx-500') }, { allowXcode: true });
  assert.equal(again.ok, true);
  assert.equal(again.replay, true);
  assert.equal(again.coinsAdded, 0);
  assert.equal(again.account.coins, 500);
  const other = createAccount(db, {});
  const stolen = grantAppleReceipt(db, { token: other.token, jws: xcode('coins_500', 'tx-500') }, { allowXcode: true });
  assert.equal(stolen.ok, false);
  assert.equal(stolen.error, 'transaction-used');
  const unknown = grantAppleReceipt(db, { token: a.token, jws: xcode('coins_nope', 'tx-nope') }, { allowXcode: true });
  assert.equal(unknown.error, 'product');
  assert.equal(createAccount(db, { token: a.token }).coins, 500);
});
