// Coin reward for a finished match. Same curve the playable client uses (kill staircase + mode bonus).
// The account server credits this from its own tank stats. A client-supplied coin total is never trusted.
export function killCoins(kills) {
  let e = 0;
  const n = Math.max(0, kills | 0);
  for (let t = 0; t < n; t++) e += 1 + ((t * 7 + 3) % 3);
  return e;
}
export function matchCoins(e) {
  const kills = Math.max(0, e.kills | 0);
  let a = 0;
  if (e.mode === 'br') a = killCoins(kills) + (e.place <= 10 ? 2 : 0) + (e.place <= 3 ? 4 : 0) + (e.place === 1 ? 10 : 0);
  else if (e.mode === 'team') a = killCoins(kills) + (e.win ? (e.variant === 'moba' ? 8 : 4) : 0);
  else a = killCoins(kills) + (e.classicLevels | 0) * 3;
  a += 3 + (e.win || e.place === 1 ? 18 : 0);
  if (e.rew && e.rew !== 1) a = Math.round(a * e.rew);
  return a;
}
