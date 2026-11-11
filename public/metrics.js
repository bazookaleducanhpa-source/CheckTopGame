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

export function downloadTimeline(records, end, days) {
  const byDay = new Map(records.map((p) => [p.date, p]));
  const start = shiftDay(end, 1 - days);
  const points = Array.from({ length: days }, (_, i) => {
    const date = shiftDay(start, i),
      previousDate = shiftDay(date, -days);
    return {
      date,
      previousDate,
      current: byDay.get(date) ?? null,
      previous: byDay.get(previousDate) ?? null,
    };
  });
  const available = points.filter((p) => p.current);
  return {
    start,
    end,
    points,
    metrics: downloadMetrics(records, end, days),
    peak: available.length
      ? Math.max(...available.map((p) => p.current.downloads))
      : null,
    estimated: points.some(
      (p) => p.current?.estimated || p.previous?.estimated,
    ),
    sources: [
      ...new Set(
        points
          .flatMap((p) => [p.current?.source, p.previous?.source])
          .filter(Boolean),
      ),
    ],
  };
}

export function downloadSeriesFor(game, data, today = dateKey(new Date())) {
  const id = game.id ?? game.key.split(":").slice(2).join(":");
  const globalKey = `${game.platform}:global:${id}`;
  const groups = new Map();
  for (const row of data.downloads) {
    if (![game.key, globalKey].includes(row.key) || row.date > today) continue;
    const scope = row.key === globalKey ? "global" : game.country;
    const provider = row.provider ?? "manual",
      groupId = `${scope}|${provider}`;
    if (!groups.has(groupId))
      groups.set(groupId, {
        id: groupId,
        scope,
        provider,
        label: `${row.source} · ${scope === "global" ? "Toàn cầu" : scope.toUpperCase()}`,
        metric: row.metric ?? "reported-downloads",
        records: [],
      });
    groups.get(groupId).records.push(row);
  }
  const priority = {
    civcharts: 0,
    apptrendkit: 0,
    appcurves: 1,
    "google-play": 2,
    manual: 0,
  };
  return [...groups.values()]
    .map((s) => ({
      ...s,
      latest: s.records
        .map((p) => p.date)
        .sort()
        .at(-1),
    }))
    .sort(
      (a, b) =>
        Number(b.scope === game.country) - Number(a.scope === game.country) ||
        Number(b.latest >= shiftDay(today, -2)) -
          Number(a.latest >= shiftDay(today, -2)) ||
        (priority[a.provider] ?? 5) - (priority[b.provider] ?? 5) ||
        b.records.length - a.records.length,
    );
}

export function analyze(game, data, days, day = dateKey(new Date())) {
  const history = data.observations
    .filter((p) => p.key === game.key)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = history.at(-1) ?? null;
  const old = baseline(history, day, days);
  const fresh = latest && latest.date >= shiftDay(day, -1);
  const downloadSeries = downloadSeriesFor(game, data, day);
  const series = downloadSeries[0];
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
    downloadSeries,
    downloadScope: series?.scope ?? game.country,
    downloadAsOf: series?.latest ?? day,
    downloadMetric: series?.metric ?? null,
    downloads: downloadMetrics(
      series?.records ?? [],
      series?.latest ?? day,
      days,
    ),
  };
}

export function searchTerm(value) {
  const text = String(value ?? "").trim();
  try {
    const url = new URL(text);
    if (url.hostname === "play.google.com")
      return url.searchParams.get("id") ?? text;
    if (url.hostname === "apps.apple.com")
      return url.pathname.match(/\/id(\d+)/)?.[1] ?? text;
  } catch {}
  return text;
}
export function normalizeSearch(value) {
  return searchTerm(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function matchesSearch(game, query) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const text = normalizeSearch(
    `${game.title} ${game.developer} ${game.id ?? game.key}`,
  );
  return terms.length > 0 && terms.every((term) => text.includes(term));
}
export function selectGames(games, filters, watchlist = []) {
  let list = games.filter(
    (g) =>
      (!filters.country || g.country === filters.country) &&
      (!filters.platform || g.platform === filters.platform) &&
      (!filters.genre || g.genre === filters.genre) &&
      (!filters.watchOnly || watchlist.includes(g.key)) &&
      (!filters.search || matchesSearch(g, filters.search)),
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
