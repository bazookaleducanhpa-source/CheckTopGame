import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCivCharts,
  parseAppCurves,
  parseCompactCount,
  parseTrendKit,
  publicTrendKitApps,
  counterDeltas,
  createPublicFetcher,
} from "../tools/download-providers.mjs";
import { collectDownloadData } from "../tools/collect-downloads.mjs";
import {
  analyze,
  downloadSeriesFor,
  dateKey,
  shiftDay,
} from "../public/metrics.js";

const today = dateKey(new Date()),
  id = "com.example.game";
test("CivCharts archive accepts only the matching Android app and valid counters", () => {
  const payload = {
    app: { store: "android", appId: id },
    series: {
      android: {
        installs: [
          { date: "2026-01-01", maxInstalls: 12345 },
          { date: "2026-02-30", maxInstalls: 20000 },
          { date: "2026-01-02", maxInstalls: -2 },
          { date: shiftDay(today, 1), maxInstalls: 999999 },
        ],
      },
    },
  };
  assert.deepEqual(parseCivCharts(payload, id), [
    { date: "2026-01-01", total: 12345 },
  ]);
  assert.throws(() => parseCivCharts(payload, "com.different.game"));
});
test("AppCurves reads only visible Markdown observations and verifies the package", () => {
  const text =
    "Package: `com.example.game`\n| 2026-01-01 | 1,234,567 | — |\n| 2026-01-02 | 1,234,567 | held |";
  assert.deepEqual(parseAppCurves(text, id), [
    { date: "2026-01-01", total: 1234567 },
    { date: "2026-01-02", total: 1234567 },
  ]);
  assert.throws(() => parseAppCurves(text, "com.other"));
});
test("counter changes never distribute missing days or turn revisions into downloads", () => {
  const rows = counterDeltas(
    [
      { date: "2026-01-01", total: 100 },
      { date: "2026-01-02", total: 120 },
      { date: "2026-01-04", total: 200 },
      { date: "2026-01-05", total: 180 },
      { date: "2026-01-06", total: 180 },
    ],
    `android:global:${id}`,
    "civcharts",
    "https://civcharts.com/",
  );
  assert.deepEqual(
    rows.map((p) => [p.date, p.downloads]),
    [
      ["2026-01-02", 20],
      ["2026-01-06", 0],
    ],
  );
  assert.ok(
    rows.every(
      (p) =>
        p.scope === "global" &&
        p.estimated &&
        p.metric === "public-counter-change",
    ),
  );
});
test("iOS public daily table preserves rounded estimates, confidence and real zeros", () => {
  const html =
    '<link rel="canonical" href="https://www.apptrendkit.com/apps/ios/123"><table><caption>Daily app metrics</caption><tbody><tr><th>Jan 2, 2026</th><td>36.4K</td><td>H<!-- -->igh</td></tr><tr><th>Jan 1, 2026</th><td>0</td><td>Low</td></tr><tr><th>Dec 31, 2025</th><td>—</td><td>Low</td></tr></tbody></table>';
  assert.deepEqual(parseTrendKit(html, "123"), [
    { date: "2026-01-02", downloads: 36400, confidence: "high" },
    { date: "2026-01-01", downloads: 0, confidence: "low" },
  ]);
  assert.equal(parseCompactCount("1.2M"), 1200000);
  assert.equal(parseCompactCount("not enough data"), null);
  assert.equal(parseCompactCount("-2"), null);
  assert.throws(() => parseTrendKit(html, "456"));
  assert.deepEqual(parseTrendKit("<p>Pro required</p>", "123"), []);
});
test("discovery ignores locked iOS apps rather than requesting paid data", () => {
  const ids = publicTrendKitApps(
    '<table><tbody><tr><td><a href="/apps/ios/123">A</a></td><td>3.4M</td></tr><tr><td><a href="/apps/ios/456">B</a></td><td>Downloads are part of Pro</td></tr></tbody></table>',
  );
  assert.deepEqual([...ids], ["123"]);
});
test("global series is available to country game cards without double-counting or joining providers", () => {
  const game = {
    key: `android:vn:${id}`,
    id,
    country: "vn",
    platform: "android",
  };
  const records = ["civcharts", "appcurves"].flatMap((provider) =>
    Array.from({ length: 14 }, (_, i) => ({
      key: `android:global:${id}`,
      date: shiftDay(today, -1 - i),
      downloads: i < 7 ? 200 : 100,
      provider,
      source: provider,
      scope: "global",
      estimated: true,
      metric: "public-counter-change",
    })),
  );
  const data = { downloads: records, observations: [] };
  const result = analyze(game, data, 7, today);
  assert.equal(result.downloadScope, "global");
  assert.equal(result.downloadAsOf, shiftDay(today, -1));
  assert.equal(result.downloads.total, 1400);
  assert.equal(result.downloads.growth, 100);
  assert.equal(result.downloadSeries.length, 2);
  const us = analyze(
    { ...game, country: "us", key: `android:us:${id}` },
    data,
    7,
    today,
  );
  assert.equal(us.downloads.total, 1400);
  data.downloads.push({
    key: game.key,
    date: today,
    downloads: 12,
    source: "Private report",
    estimated: false,
  });
  const groups = downloadSeriesFor(game, data, today);
  assert.equal(groups[0].scope, "vn");
  assert.equal(groups[0].records.length, 1);
  assert.equal(groups[1].records.length, 14);
});
test("public request keeps visitor cookies and reports rate limits without bypassing them", async () => {
  const seen = [];
  const get = createPublicFetcher(async (url, options) => {
    seen.push(options.headers);
    return new Response("ok", {
      headers: { "Set-Cookie": "visitor=example; Path=/" },
    });
  });
  await get("https://example.com/a");
  await get("https://example.com/b");
  assert.equal(seen[1].Cookie, "visitor=example");
  const limited = createPublicFetcher(
    async () => new Response("", { status: 429 }),
  );
  await assert.rejects(
    () => limited("https://example.com/"),
    (error) => error.status === 429,
  );
});
test("same-day download collection reuses archive checks and does not remove imported reports", async () => {
  const now = `${today}T12:00:00.000Z`;
  const record = {
    key: `android:global:${id}`,
    provider: "civcharts",
    date: shiftDay(today, -1),
    downloads: 100,
    estimated: true,
    source: "CivCharts",
  };
  const manual = {
    key: `android:vn:${id}`,
    date: today,
    downloads: 12,
    estimated: false,
    source: "Report",
  };
  const data = {
    games: [{ key: manual.key, id, platform: "android", country: "vn" }],
    downloads: [record, manual],
    installReadings: [],
    sources: [],
    downloadChecks: [
      { id, provider: "civcharts", status: "ok", checkedAt: now },
    ],
  };
  await collectDownloadData(data, {
    now,
    fetchPublic: async () => {
      throw new Error("Unexpected network request");
    },
  });
  assert.equal(data.downloads.length, 2);
  assert.deepEqual(
    data.downloads.find((p) => p.source === "Report"),
    manual,
  );
  assert.equal(
    data.sources.find((s) => s.id === "downloads:civcharts").count,
    1,
  );
});
