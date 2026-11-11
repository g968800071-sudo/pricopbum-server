// Device-linked account ledger in a local SQLite file (ACCOUNT_DB).
// Spendable coins, rank and legendary mods come from matches this process simulated, spends it approved,
// and App Store transactions it verified. A device localStorage snapshot is stored as a note and is never added to that balance.
// Mythic combat mods are still refused. An App Store purchase records its own entitlement.
// On a host with an ephemeral disk this file disappears on restart unless ACCOUNT_DB points at a persistent disk and ACCOUNT_DURABLE=1.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { MODELS } from '../sim/models.js';
import { TM_COIN, TM_MAX, TMODS } from '../sim/tmods.js';
import { matchCoins } from '../sim/progress.js';
import { rankDelta } from '../sim/rank.js';
import { productById } from '../iap/products.js';
import { verifyTransactionJws } from '../iap/verify.js';

export function openStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
    db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      token TEXT PRIMARY KEY,
      created INTEGER NOT NULL,
      coins INTEGER NOT NULL,
      rp INTEGER NOT NULL,
      kills INTEGER NOT NULL,
      matches INTEGER NOT NULL,
      name TEXT NOT NULL,
      tmods TEXT NOT NULL,
      imported INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS credits (
      token TEXT NOT NULL,
      match_key TEXT NOT NULL,
      PRIMARY KEY (token, match_key)
    );
    CREATE TABLE IF NOT EXISTS spends (
      token TEXT NOT NULL,
      spend_key TEXT NOT NULL,
      PRIMARY KEY (token, spend_key)
    );
    CREATE TABLE IF NOT EXISTS iap_tx (
      transaction_id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      product_id TEXT NOT NULL,
      coins INTEGER NOT NULL,
      created INTEGER NOT NULL
    );
  `);
  const cols = db.prepare('PRAGMA table_info(accounts)').all().map(c => c.name);
  if (!cols.includes('device_note')) db.exec("ALTER TABLE accounts ADD COLUMN device_note TEXT NOT NULL DEFAULT '{}'");
  return db;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
export function validToken(s) { return typeof s === 'string' && TOKEN_RE.test(s) ? s : null; }

function rowOf(db, token) {
  return db.prepare('SELECT token, created, coins, rp, kills, matches, name, tmods, imported, device_note FROM accounts WHERE token = ?').get(token);
}
function parseTmods(raw) { try { const o = JSON.parse(raw || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
export function publicAccount(row) {
  let note = {};
  try { note = JSON.parse(row.device_note || '{}') || {}; } catch { note = {}; }
  return { token: row.token, coins: row.coins, rp: row.rp, kills: row.kills, matches: row.matches, name: row.name, tmods: parseTmods(row.tmods), imported: !!row.imported, deviceNote: note, authoritative: true, server: true };
}

// Remember that a device offered numbers, without accepting them as spendable coins or rank.
export function deviceNote(local) {
  if (!local || typeof local !== 'object') return { present: false };
  const coins = Math.floor(+local.coins || 0);
  const rp = Math.floor(+local.rp || 0);
  const kills = Math.floor(+local.kills || 0);
  return { present: true, accepted: false, coins: Math.max(0, Math.min(1_000_000_000, coins)), rp: Math.max(0, Math.min(1_000_000_000, rp)), kills: Math.max(0, Math.min(1_000_000_000, kills)) };
}

// Keep only legendary (rarity 3) upgrade tracks. Mythic and other rarities are dropped, not granted.
export function legendaryTmods(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(input)) {
    const id = key | 0;
    const M = MODELS[id];
    if (!M || M.rar !== 3) continue;
    const src = input[key];
    if (!Array.isArray(src)) continue;
    const lv = TMODS.map((_, i) => Math.max(0, Math.min(TM_MAX, src[i] | 0)));
    if (lv.some(v => v)) out[String(id)] = lv;
  }
  return out;
}

export function createAccount(db, { token, name, local } = {}) {
  const existing = validToken(token) ? rowOf(db, token) : null;
  if (existing) return publicAccount(existing);
  const t = validToken(token) || crypto.randomBytes(18).toString('base64url');
  let nm = String(name || 'Игрок').replace(/[^\w \u0400-\u04FF.-]/g, '').trim().slice(0, 14) || 'Игрок';
  if (local && local.name) nm = String(local.name).replace(/[^\w \u0400-\u04FF.-]/g, '').trim().slice(0, 14) || nm;
  const note = deviceNote(local);
  db.prepare('INSERT INTO accounts (token, created, coins, rp, kills, matches, name, tmods, imported, device_note) VALUES (?, ?, 0, 0, 0, 0, ?, ?, ?, ?)').run(t, Date.now(), nm, '{}', note.present ? 1 : 0, JSON.stringify(note));
  return publicAccount(rowOf(db, t));
}

export function getAccount(db, token) {
  const t = validToken(token);
  if (!t) return null;
  const row = rowOf(db, t);
  return row ? publicAccount(row) : null;
}

export function tmodForModel(db, token, modelId) {
  const acc = getAccount(db, token);
  if (!acc) return undefined;
  const M = MODELS[modelId | 0];
  if (!M || M.rar !== 3) return null;
  return acc.tmods[String(modelId | 0)] || null;
}

export function spendLegendary(db, token, modelId, track, spendKey) {
  const t = validToken(token);
  const row = t ? rowOf(db, t) : null;
  if (!row) return { ok: false, error: 'account' };
  const id = modelId | 0;
  const M = MODELS[id];
  if (!M || M.rar === 4) return { ok: false, error: 'payments-off' };
  if (M.rar !== 3) return { ok: false, error: 'not-legendary' };
  const i = track | 0;
  if (i < 0 || i >= TMODS.length) return { ok: false, error: 'track' };
  const tmods = parseTmods(row.tmods);
  const lv = (tmods[String(id)] || TMODS.map(() => 0)).slice();
  while (lv.length < TMODS.length) lv.push(0);
  if (lv[i] >= TM_MAX) return { ok: false, error: 'max', account: publicAccount(row) };
  const cost = TM_COIN[lv[i]];
  const key = typeof spendKey === 'string' && spendKey ? String(spendKey).slice(0, 80) : '';
  if (key) {
    const replay = db.prepare('SELECT 1 AS x FROM spends WHERE token = ? AND spend_key = ?').get(t, key);
    if (replay) return { ok: true, replay: true, cost: 0, account: publicAccount(row) };
  }
  if (row.coins < cost) return { ok: false, error: 'coins', cost, account: publicAccount(row) };
  lv[i] += 1;
  tmods[String(id)] = lv;
  db.prepare('UPDATE accounts SET coins = ?, tmods = ? WHERE token = ?').run(row.coins - cost, JSON.stringify(tmods), t);
  if (key) db.prepare('INSERT INTO spends (token, spend_key) VALUES (?, ?)').run(t, key);
  return { ok: true, cost, account: publicAccount(rowOf(db, t)) };
}

// Credit one online match. A repeated match_key does not pay twice. The coin amount is computed here.
export function creditMatch(db, token, matchKey, summary) {
  const t = validToken(token);
  const row = t ? rowOf(db, t) : null;
  if (!row) return null;
  const key = String(matchKey || '').slice(0, 80);
  if (!key) return publicAccount(row);
  const seen = db.prepare('SELECT 1 AS x FROM credits WHERE token = ? AND match_key = ?').get(t, key);
  if (seen) return publicAccount(row);
  const coins = matchCoins(summary || {});
  const rp = Math.max(0, row.rp + rankDelta(summary || {}));
  const kills = row.kills + Math.max(0, summary.kills | 0);
  db.prepare('INSERT INTO credits (token, match_key) VALUES (?, ?)').run(t, key);
  db.prepare('UPDATE accounts SET coins = ?, rp = ?, kills = ?, matches = matches + 1 WHERE token = ?').run(row.coins + coins, rp, kills, t);
  return publicAccount(rowOf(db, t));
}

function entitlementOf(product) {
  return {
    productId: product.id,
    kind: product.kind,
    gems: product.gems | 0,
    myth: product.myth || null,
    skin: product.skin || null,
    removeAds: !!product.removeAds,
    starter: !!product.starter,
    seasonPass: !!product.seasonPass,
  };
}

// Credit a verified App Store transaction once. The coin amount comes from the product catalog.
export function grantAppleTransaction(db, token, verified, product) {
  const t = validToken(token);
  const row = t ? rowOf(db, t) : null;
  if (!row) return { ok: false, error: 'account' };
  const existing = db.prepare('SELECT token, product_id, coins FROM iap_tx WHERE transaction_id = ?').get(verified.transactionId);
  if (existing) {
    if (existing.token !== t) return { ok: false, error: 'transaction-used' };
    const prev = productById(existing.product_id) || product;
    return { ok: true, replay: true, coinsAdded: 0, ...entitlementOf(prev), account: publicAccount(row) };
  }
  const coins = Math.max(0, product.coins | 0);
  db.prepare('INSERT INTO iap_tx (transaction_id, token, product_id, coins, created) VALUES (?, ?, ?, ?, ?)').run(verified.transactionId, t, product.id, coins, Date.now());
  if (coins) db.prepare('UPDATE accounts SET coins = ? WHERE token = ?').run(row.coins + coins, t);
  return { ok: true, replay: false, coinsAdded: coins, ...entitlementOf(product), account: publicAccount(rowOf(db, t)) };
}

export function grantAppleReceipt(db, body, { allowXcode = false } = {}) {
  const verified = verifyTransactionJws(body && body.jws, { allowXcode });
  if (!verified.ok) return { ok: false, error: verified.error };
  const product = productById(verified.productId);
  if (!product) return { ok: false, error: 'product' };
  return grantAppleTransaction(db, body.token, verified, product);
}

export function defaultDbFile() {
  return process.env.ACCOUNT_DB || path.join(process.cwd(), 'data', 'accounts.sqlite');
}
