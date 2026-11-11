import gplay from "google-play-scraper";

async function json(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(25000),
    headers: { "User-Agent": "CheckTopGame/1.0" },
  });
  if (!response.ok) throw new Error(`Nguồn trả về HTTP ${response.status}`);
  return response.json();
}

export async function apple(country, limit) {
  const sourceUrl = `https://itunes.apple.com/${country}/rss/topfreeapplications/limit=${limit}/genre=6014/json`;
  const feed = await json(sourceUrl);
  const entries = feed.feed?.entry;
  if (!Array.isArray(entries) || !entries.length)
    throw new Error("Apple không trả về bảng xếp hạng game.");
  const ids = entries.map((e) => e.id.attributes["im:id"]);
  let details = [],
    warning = null;
  try {
    details =
      (
        await json(
          `https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${country}`,
        )
      ).results ?? [];
  } catch {
    warning = "Có thứ hạng; chưa lấy được thông tin chi tiết từ Apple Lookup.";
  }
  return {
    sourceUrl,
    warning,
    games: entries.map((e, i) => {
      const id = e.id.attributes["im:id"];
      const app = details.find((d) => String(d.trackId) === id);
      const images = e["im:image"];
      return {
        key: `ios:${country}:${id}`,
        id,
        platform: "ios",
        country,
        rank: i + 1,
        title: app?.trackName ?? e["im:name"].label,
        developer: app?.artistName ?? e["im:artist"].label,
        icon: app?.artworkUrl512 ?? images.at(-1).label,
        url: app?.trackViewUrl ?? e.id.label,
        genre:
          app?.genres?.find((g) => g !== "Games" && g !== "Entertainment") ??
          "Games",
        description: app?.description ?? e.summary?.label ?? "",
        screenshots: (app?.screenshotUrls ?? []).slice(0, 5),
        score: app?.averageUserRating ?? null,
        ratings: app?.userRatingCount ?? null,
        installs: null,
        minInstalls: null,
        version: app?.version ?? null,
        released: app?.releaseDate ?? e["im:releaseDate"]?.label ?? null,
        updated: app?.currentVersionReleaseDate ?? null,
        sourceUrl,
      };
    }),
  };
}

export async function google(country, limit) {
  const sourceUrl = `https://play.google.com/store/games?gl=${country}&hl=en`;
  const rows = await gplay.list({
    category: gplay.category.GAME,
    collection: gplay.collection.TOP_FREE,
    country,
    lang: "en",
    num: limit,
    fullDetail: false,
    requestOptions: { timeout: 25000 },
  });
  if (!rows.length)
    throw new Error("Google Play không trả về bảng xếp hạng game.");
  const games = [];
  let failed = 0;
  // Limit concurrent requests; one failed detail must not discard the chart.
  for (let start = 0; start < rows.length; start += 4) {
    const batch = await Promise.all(
      rows.slice(start, start + 4).map(async (row, j) => {
        let app = row;
        try {
          app = await gplay.app({
            appId: row.appId,
            country,
            lang: "en",
            requestOptions: { timeout: 25000 },
          });
        } catch {
          failed++;
        }
        return {
          key: `android:${country}:${row.appId}`,
          id: row.appId,
          platform: "android",
          country,
          rank: start + j + 1,
          title: app.title,
          developer: app.developer,
          icon: app.icon,
          url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(row.appId)}&gl=${country}`,
          genre: app.genre ?? "Games",
          description: app.description ?? app.summary ?? "",
          screenshots: (app.screenshots ?? []).slice(0, 5),
          score: app.score ?? null,
          ratings: app.ratings ?? null,
          installs: app.installs ?? null,
          minInstalls: app.minInstalls ?? null,
          publicInstalls:
            Number.isSafeInteger(app.maxInstalls) &&
            app.maxInstalls >= (app.minInstalls ?? 0)
              ? app.maxInstalls
              : null,
          version: app.version ?? null,
          released: app.released ?? null,
          updated: app.updated ? new Date(app.updated).toISOString() : null,
          sourceUrl,
        };
      }),
    );
    games.push(...batch);
  }
  return {
    sourceUrl,
    games,
    warning: failed ? `${failed} game chưa lấy được thông tin chi tiết.` : null,
  };
}
