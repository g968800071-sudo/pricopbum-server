// Device-linked account ledger. This is a local SQLite file (ACCOUNT_DB), not localStorage and not a paid host.
// The first link copies a device snapshot once and does not delete that snapshot. After that, online match
// rewards and legendary upgrades are applied only here. Mythic / real-money rows are refused.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { MODELS } from '../sim/models.js';
import { TM_COIN, TM_MAX, TMODS } from '../sim/tmods.js';
import { matchCoins } from '../sim/progress.js';
import { rankDelta } from '../sim/rank.js';

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
  `);
  return db;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
export function validToken(s) { return typeof s === 'string' && TOKEN_RE.test(s) ? s : null; }

function rowOf(db, token) {
  return db.prepare('SELECT token, created, coins, rp, kills, matches, name, tmods, imported FROM accounts WHERE token = ?').get(token);
}
function parseTmods(raw) { try { const o = JSON.parse(raw || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
export function publicAccount(row) {
  return { token: row.token, coins: row.coins, rp: row.rp, kills: row.kills, matches: row.matches, name: row.name, tmods: parseTmods(row.tmods), imported: !!row.imported, server: true };
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
  let coins = 0, rp = 0, kills = 0, imported = 0, tmods = {};
  let nm = String(name || 'Игрок').replace(/[^\w \u0400-\u04FF.-]/g, '').trim().slice(0, 14) || 'Игрок';
  if (local && typeof local === 'object') {
    coins = Math.max(0, Math.min(5_000_000, Math.floor(+local.coins || 0)));
    rp = Math.max(0, Math.min(5_000_000, Math.floor(+local.rp || 0)));
    kills = Math.max(0, Math.min(5_000_000, Math.floor(+local.kills || 0)));
    if (local.name) nm = String(local.name).replace(/[^\w \u0400-\u04FF.-]/g, '').trim().slice(0, 14) || nm;
    tmods = legendaryTmods(local.tmods);
    imported = 1;
  }
  db.prepare('INSERT INTO accounts (token, created, coins, rp, kills, matches, name, tmods, imported) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)').run(t, Date.now(), coins, rp, kills, nm, JSON.stringify(tmods), imported);
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

export function spendLegendary(db, token, modelId, track) {
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
  if (row.coins < cost) return { ok: false, error: 'coins', cost, account: publicAccount(row) };
  lv[i] += 1;
  tmods[String(id)] = lv;
  db.prepare('UPDATE accounts SET coins = ?, tmods = ? WHERE token = ?').run(row.coins - cost, JSON.stringify(tmods), t);
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

export function defaultDbFile() {
  return process.env.ACCOUNT_DB || path.join(process.cwd(), 'data', 'accounts.sqlite');
}
