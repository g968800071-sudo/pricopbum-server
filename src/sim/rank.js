// Rank points live on the device (there is no account server). Wins add points, losses subtract them.
// Same curve the playable client uses: rank name from points AND career kills, so a loss can demote.
export const RANK_NAMES = ['Рядовой', 'Ефрейтор', 'Младший сержант', 'Сержант', 'Старший сержант', 'Старшина', 'Прапорщик', 'Младший лейтенант', 'Лейтенант', 'Старший лейтенант', 'Капитан', 'Майор', 'Подполковник', 'Полковник', 'Генерал-майор', 'Генерал-лейтенант', 'Генерал-полковник', 'Генерал армии', 'Маршал'];
export const RANK_KILLS = [0, 0, 10, 25, 50, 150, 300, 500, 1000, 1500, 2500, 5000, 7500, 10000, 25000, 35000, 50000, 75000, 100000];
export const RANK_POINTS = RANK_NAMES.map((_, i) => Math.round(40 * i ** 2.3));

export function rankOf(profile) {
  const rp = Math.max(0, profile && profile.rp || 0);
  const kills = profile && profile.stats && profile.stats.kills || 0;
  let i = 0;
  while (i + 1 < RANK_NAMES.length && rp >= RANK_POINTS[i + 1] && kills >= RANK_KILLS[i + 1]) i++;
  if (i + 1 >= RANK_NAMES.length) return { i, name: RANK_NAMES[i], sub: 3, pct: 100, next: null };
  const p = (rp - RANK_POINTS[i]) / (RANK_POINTS[i + 1] - RANK_POINTS[i]);
  const k = RANK_KILLS[i + 1] > RANK_KILLS[i] ? (kills - RANK_KILLS[i]) / (RANK_KILLS[i + 1] - RANK_KILLS[i]) : 1;
  const o = Math.max(0, Math.min(0.999, Math.min(p, k)));
  return { i, name: RANK_NAMES[i], sub: 1 + Math.floor(o * 3), pct: Math.floor(o * 100), next: i + 2 >= RANK_NAMES.length ? '???' : RANK_NAMES[i + 1] };
}

// Match result → rank-point delta. A win is +25, a loss is −15, a draw is neither.
// Kills still add points. Never used for real-money rewards.
export function rankDelta(res) {
  const kills = res.kills || 0;
  const draw = res.draw === true || res.winnerTeam === -1;
  let win = !!res.win && !draw;
  if (!draw && res.mode === 'br' && res.place && res.total) win = res.place <= Math.max(1, Math.ceil(res.total * 0.1));
  const podium = res.mode === 'br' && res.place && res.place <= 3;
  const base = draw ? 0 : (win ? 25 : -15);
  return base + Math.min(20, kills * 2) + (podium ? 10 : 0);
}

export function applyRank(profile, res) {
  const d = rankDelta(res);
  profile.rp = Math.max(0, (profile.rp || 0) + d);
  profile.stats = profile.stats || { kills: 0 };
  profile.stats.kills = (profile.stats.kills || 0) + (res.kills || 0);
  return { delta: d, rank: rankOf(profile) };
}
