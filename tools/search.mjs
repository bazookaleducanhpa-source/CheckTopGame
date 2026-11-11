import gplay from "google-play-scraper";
import { load } from "cheerio";
import { searchTerm } from "../public/metrics.js";

function googleGame(app, country) {
  return {
    key: `android:${country}:${app.appId}`,
    id: app.appId,
    platform: "android",
    country,
    title: app.title,
    developer: app.developer,
    icon: app.icon,
    genre: app.genre ?? "Games",
    description: app.description ?? app.summary ?? "",
    screenshots: (app.screenshots ?? []).slice(0, 5),
    url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(app.appId)}&gl=${country}`,
    score: app.score ?? null,
    ratings: app.ratings ?? null,
    installs: app.installs ?? null,
    publicInstalls: Number.isSafeInteger(app.maxInstalls)
      ? app.maxInstalls
      : null,
    version: app.version ?? null,
    rank: null,
    discoveredBy: "search",
    sourceUrl: "https://play.google.com/store/games",
  };
}
function appleGame(app, country) {
  return {
    key: `ios:${country}:${app.trackId}`,
    id: String(app.trackId),
    platform: "ios",
    country,
    title: app.trackName,
    developer: app.artistName,
    icon: app.artworkUrl512 ?? app.artworkUrl100,
    genre:
      app.genres?.find((g) => g !== "Games" && g !== "Entertainment") ??
      "Games",
    description: app.description ?? "",
    screenshots: (app.screenshotUrls ?? []).slice(0, 5),
    url: app.trackViewUrl,
    score: app.averageUserRating ?? null,
    ratings: app.userRatingCount ?? null,
    version: app.version ?? null,
    rank: null,
    discoveredBy: "search",
    sourceUrl: "https://apps.apple.com/",
  };
}
export function playSearchIds(html) {
  const dom = load(html),
    ids = new Set();
  dom('a[href*="/store/apps/details?id="]').each((_, e) => {
    const url = new URL(dom(e).attr("href"), "https://play.google.com");
    const id = url.searchParams.get("id");
    if (
      url.hostname === "play.google.com" &&
      /^(?:[a-zA-Z]\w*\.)+[\w]+$/.test(id)
    )
      ids.add(id);
  });
  return [...ids].slice(0, 12);
}
async function androidSearch(term, country) {
  const options = { country, lang: "en", requestOptions: { timeout: 15000 } };
  let ids;
  if (/^(?:[a-zA-Z]\w*\.)+[\w]+$/.test(term)) ids = [term];
  else {
    const params = new URLSearchParams({
      q: term,
      c: "apps",
      hl: "en",
      gl: country,
    });
    const response = await fetch(
      `https://play.google.com/store/search?${params}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw new Error(`Google Play HTTP ${response.status}`);
    ids = playSearchIds(await response.text());
  }
  const apps = [];
  for (let i = 0; i < ids.length; i += 4) {
    const batch = await Promise.allSettled(
      ids.slice(i, i + 4).map((appId) => gplay.app({ appId, ...options })),
    );
    apps.push(
      ...batch.filter((r) => r.status === "fulfilled").map((r) => r.value),
    );
  }
  return apps
    .filter((a) => a.genreId?.startsWith("GAME"))
    .map((a) => googleGame(a, country));
}
async function iosSearch(term, country) {
  const byId = /^\d{5,}$/.test(term);
  const params = new URLSearchParams(
    byId
      ? { id: term, country }
      : {
          term,
          country,
          entity: "software",
          media: "software",
          limit: "50",
          genreId: "6014",
        },
  );
  const response = await fetch(
    `https://itunes.apple.com/${byId ? "lookup" : "search"}?${params}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`Apple HTTP ${response.status}`);
  const data = await response.json();
  return (data.results ?? [])
    .filter((a) => a.trackId && a.genreIds?.map(String).includes("6014"))
    .slice(0, 15)
    .map((a) => appleGame(a, country));
}
export async function searchStores(
  query,
  { countries = ["vn", "us"], android = androidSearch, ios = iosSearch } = {},
) {
  const term = searchTerm(query);
  if (term.length < 2 || term.length > 150)
    throw new Error("Nhập từ 2 đến 150 ký tự để tìm game.");
  const packageId = /^(?:[a-zA-Z]\w*\.)+[\w]+$/.test(term),
    appleId = /^\d{5,}$/.test(term);
  const jobs = countries.flatMap((country) => [
    ...(!appleId ? [{ platform: "android", country, run: android }] : []),
    ...(!packageId ? [{ platform: "ios", country, run: ios }] : []),
  ]);
  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        return { games: await job.run(term, job.country) };
      } catch {
        return {
          games: [],
          warning: `${job.platform === "ios" ? "App Store" : "Google Play"} (${job.country.toUpperCase()}) tạm thời không tìm được dữ liệu.`,
        };
      }
    }),
  );
  const games = [
    ...new Map(results.flatMap((r) => r.games).map((g) => [g.key, g])).values(),
  ];
  return {
    query: term,
    games,
    warnings: results.flatMap((r) => (r.warning ? [r.warning] : [])),
    checkedAt: new Date().toISOString(),
  };
}
