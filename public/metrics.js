export const DAY = 86400000;
export const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
export function shiftDay(day, amount) {
  return dateKey(Date.parse(`${day}T00:00:00Z`) + amount * DAY);
}

// A comparison must have a real observation near the requested boundary.
export function baseline(history, day, days) {
  const target = shiftDay(day, -days);
  return (
    history
      .filter((p) => p.date <= target && p.date >= shiftDay(target, -2))
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  );
}

export function downloadMetrics(records, day, days) {
  const byDay = new Map(records.map((p) => [p.date, p]));
  function period(offset) {
    const points = Array.from({ length: days }, (_, i) =>
      byDay.get(shiftDay(day, -offset - i)),
    );
    const count = points.filter(Boolean).length;
    if (count !== days)
      return { total: null, count, estimated: false, sources: [] };
    return {
      total: points.reduce((n, p) => n + p.downloads, 0),
      count,
      estimated: points.some((p) => p.estimated),
      sources: [...new Set(points.map((p) => p.source))],
    };
  }
  const current = period(0),
    previous = period(days),
    before = period(days * 2);
  const growth =
    current.total !== null && previous.total > 0
      ? ((current.total - previous.total) / previous.total) * 100
      : null;
  const previousGrowth =
    previous.total !== null && before.total > 0
      ? ((previous.total - before.total) / before.total) * 100
      : null;
  return {
    ...current,
    previous: previous.total,
    growth,
    acceleration:
      growth !== null && previousGrowth !== null
        ? growth - previousGrowth
        : null,
    comparisonEstimated:
      current.estimated || previous.estimated || before.estimated,
  };
}

export function analyze(game, data, days, day = dateKey(new Date())) {
  const history = data.observations
    .filter((p) => p.key === game.key)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = history.at(-1) ?? null;
  const old = baseline(history, day, days);
  const fresh = latest && latest.date >= shiftDay(day, -1);
  const records = data.downloads.filter((p) => p.key === game.key);
  return {
    ...game,
    history,
    latest,
    baseline: old,
    fresh,
    rankChange:
      fresh && old && latest.rank != null && old.rank != null
        ? old.rank - latest.rank
        : null,
    ratingsChange:
      fresh && old && latest.ratings != null && old.ratings != null
        ? latest.ratings - old.ratings
        : null,
    downloads: downloadMetrics(records, day, days),
  };
}

export function selectGames(games, filters, watchlist = []) {
  let list = games.filter(
    (g) =>
      (!filters.country || g.country === filters.country) &&
      (!filters.platform || g.platform === filters.platform) &&
      (!filters.genre || g.genre === filters.genre) &&
      (!filters.watchOnly || watchlist.includes(g.key)) &&
      (!filters.search ||
        `${g.title} ${g.developer}`
          .toLocaleLowerCase()
          .includes(filters.search.toLocaleLowerCase())),
  );
  const getters = {
    rank: (g) => (g.fresh ? -(g.latest?.rank ?? Infinity) : -Infinity),
    growth: (g) => g.downloads.growth,
    downloads: (g) => g.downloads.total,
    acceleration: (g) => g.downloads.acceleration,
    movement: (g) => g.rankChange,
    ratings: (g) => g.ratingsChange,
    score: (g) => g.score,
  };
  const get = getters[filters.sort] ?? getters.rank;
  return list.sort(
    (a, b) =>
      (get(b) ?? -Infinity) - (get(a) ?? -Infinity) ||
      a.title.localeCompare(b.title),
  );
}
