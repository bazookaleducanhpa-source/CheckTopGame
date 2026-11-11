import * as cheerio from "cheerio";
import { dateKey, shiftDay } from "../public/metrics.js";

export const PROVIDERS = {
  civcharts: {
    name: "CivCharts · bộ đếm Google Play",
    platform: "android",
    url: "https://civcharts.com/",
  },
  appcurves: {
    name: "AppCurves · bộ đếm Google Play",
    platform: "android",
    url: "https://appcurves.com/",
  },
  apptrendkit: {
    name: "AppTrendKit · ước tính iOS",
    platform: "ios",
    url: "https://www.apptrendkit.com/categories/games",
  },
  "google-play": {
    name: "Google Play · quan sát trực tiếp",
    platform: "android",
    url: "https://play.google.com/store/games",
  },
};
export function validDay(day, today = dateKey(new Date())) {
  return (
    typeof day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    dateKey(day) === day &&
    day <= today
  );
}
export function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function parseCivCharts(payload, id) {
  if (payload.app?.store !== "android" || payload.app?.appId !== id)
    throw new Error("CivCharts trả về game không khớp ID.");
  const rows = payload.series?.android?.installs;
  if (!Array.isArray(rows))
    throw new Error("CivCharts chưa có chuỗi bộ đếm cài đặt.");
  return rows
    .filter((p) => validDay(p.date) && validCount(p.maxInstalls))
    .map((p) => ({ date: p.date, total: p.maxInstalls }));
}
export function parseAppCurves(markdown, id) {
  if (!markdown.includes(`Package: \`${id}\``))
    throw new Error("AppCurves trả về game không khớp package.");
  return [
    ...markdown.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([\d,]+)\s*\|/gm),
  ]
    .map((m) => ({ date: m[1], total: Number(m[2].replaceAll(",", "")) }))
    .filter((p) => validDay(p.date) && validCount(p.total));
}
export function parseCompactCount(value) {
  const match = String(value)
    .trim()
    .replaceAll(",", "")
    .match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
  if (!match) return null;
  const count = Math.round(
    Number(match[1]) *
      ({ K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase()] ?? 1),
  );
  return validCount(count) ? count : null;
}
export function parseTrendKit(html, id) {
  const dom = cheerio.load(html);
  const canonical = dom('link[rel="canonical"]').attr("href");
  if (canonical && new URL(canonical).pathname !== `/apps/ios/${id}`)
    throw new Error("AppTrendKit trả về trang không khớp ID.");
  // Only the public daily table is read. No account, hidden state or paid endpoints.
  const table = dom("caption")
    .filter((_, e) => dom(e).text().trim() === "Daily app metrics")
    .closest("table");
  const rows = [];
  table.find("tbody tr").each((_, e) => {
    const cells = dom(e)
      .find("th,td")
      .map((_, cell) => dom(cell).text().trim())
      .get();
    const parsed = Date.parse(`${cells[0]} 00:00:00 UTC`);
    const downloads = parseCompactCount(cells[1]);
    if (Number.isFinite(parsed) && downloads !== null) {
      const date = dateKey(parsed);
      if (validDay(date))
        rows.push({
          date,
          downloads,
          confidence: cells[2]?.toLowerCase() ?? "unknown",
        });
    }
  });
  return rows;
}
export function publicTrendKitApps(html) {
  const dom = cheerio.load(html),
    ids = new Set();
  dom("table tbody tr").each((_, e) => {
    const row = dom(e);
    if (/part of Pro|workspace account required/i.test(row.text())) return;
    const href = row.find('a[href^="/apps/ios/"]').first().attr("href");
    const match = href?.match(/^\/apps\/ios\/(\d+)$/);
    if (
      match &&
      row
        .find("td")
        .toArray()
        .some((cell) => parseCompactCount(dom(cell).text()) !== null)
    )
      ids.add(match[1]);
  });
  return ids;
}

// Deltas describe movement of the public counter, not Play Console acquisition events.
// Missing nights and counter corrections are never spread into invented daily downloads.
export function counterDeltas(readings, key, provider, sourceUrl) {
  const sorted = [
    ...new Map(
      readings
        .filter((p) => validDay(p.date) && validCount(p.total))
        .map((p) => [p.date, p]),
    ).values(),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.flatMap((p, i) => {
    const previous = sorted[i - 1];
    if (
      !previous ||
      shiftDay(previous.date, 1) !== p.date ||
      p.total < previous.total
    )
      return [];
    return [
      {
        key,
        date: p.date,
        downloads: p.total - previous.total,
        source: PROVIDERS[provider].name,
        provider,
        sourceUrl,
        estimated: true,
        scope: "global",
        metric: "public-counter-change",
      },
    ];
  });
}

export function createPublicFetcher(fetchImpl = fetch) {
  // Keep the provider's anonymous cookies within a run; do not reset a visitor's free quota.
  const jars = new Map();
  return async (url) => {
    const host = new URL(url).host,
      jar = jars.get(host) ?? new Map();
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(25000),
      headers: {
        "User-Agent": "CheckTopGame/1.0 (public game market research)",
        ...(jar.size
          ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") }
          : {}),
      },
    });
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const pair = cookie.split(";")[0],
        index = pair.indexOf("=");
      if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    jars.set(host, jar);
    if (!response.ok) {
      const error = new Error(`Nguồn trả HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  };
}
