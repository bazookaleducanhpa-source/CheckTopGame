import test from "node:test";
import assert from "node:assert/strict";
import {
  downloadMetrics,
  analyze,
  baseline,
  selectGames,
  shiftDay,
} from "../public/metrics.js";
import { validateRecords } from "../tools/import-downloads.mjs";

const day = "2026-11-11";
const game = {
  key: "ios:vn:123",
  title: "A Game",
  developer: "Studio",
  country: "vn",
  platform: "ios",
  score: 4.5,
};
function daily(values) {
  return values.flatMap((value, period) =>
    Array.from({ length: 7 }, (_, i) => ({
      key: game.key,
      date: shiftDay(day, -period * 7 - i),
      downloads: value,
      source: "Test report",
      estimated: false,
    })),
  );
}
test("compares complete rolling periods and calculates acceleration in percentage points", () => {
  const result = downloadMetrics(daily([40, 20, 10]), day, 7);
  assert.equal(result.total, 280);
  assert.equal(result.previous, 140);
  assert.equal(result.growth, 100);
  assert.equal(result.acceleration, 0);
});
test("missing day is unknown, not zero, and no invented partial totals", () => {
  const rows = daily([10, 5]).slice(1),
    result = downloadMetrics(rows, day, 7);
  assert.equal(result.total, null);
  assert.equal(result.count, 6);
  assert.equal(result.growth, null);
});
test("zero previous total never produces infinite growth", () => {
  const result = downloadMetrics(daily([10, 0, 0]), day, 7);
  assert.equal(result.total, 70);
  assert.equal(result.growth, null);
  assert.equal(result.acceleration, null);
});
test("zero downloads is a valid measured total", () => {
  const result = downloadMetrics(daily([0, 10]), day, 7);
  assert.equal(result.total, 0);
  assert.equal(result.growth, -100);
});
test("estimated comparison is disclosed even when current period is reported", () => {
  const rows = daily([20, 10]);
  rows[8].estimated = true;
  const result = downloadMetrics(rows, day, 7);
  assert.equal(result.estimated, false);
  assert.equal(result.comparisonEstimated, true);
});
test("requires history near period boundary rather than comparing an arbitrary older day", () => {
  assert.equal(baseline([{ date: "2026-10-01", rank: 20 }], day, 7), null);
  assert.equal(baseline([{ date: "2026-11-05", rank: 20 }], day, 7), null);
  assert.equal(baseline([{ date: "2026-11-03", rank: 20 }], day, 7).rank, 20);
});
test("rank improves when its number drops; country and platform snapshots remain separate", () => {
  const data = {
    observations: [
      { key: game.key, date: day, rank: 2, ratings: 30 },
      { key: game.key, date: shiftDay(day, -7), rank: 10, ratings: 20 },
      { key: "ios:us:123", date: shiftDay(day, -7), rank: 90, ratings: 400 },
    ],
    downloads: [],
  };
  const result = analyze(game, data, 7, day);
  assert.equal(result.rankChange, 8);
  assert.equal(result.ratingsChange, 10);
});
test("stale and absent chart ranks are never shown as current movements", () => {
  const result = analyze(
    game,
    {
      observations: [
        { key: game.key, date: shiftDay(day, -5), rank: 2 },
        { key: game.key, date: shiftDay(day, -7), rank: 10 },
      ],
      downloads: [],
    },
    7,
    day,
  );
  assert.equal(result.fresh, false);
  assert.equal(result.rankChange, null);
});
test("watchlist filtering, search and unknown-first sort prevention", () => {
  const a = {
    ...game,
    fresh: true,
    latest: { rank: 2 },
    downloads: { growth: null },
  };
  const b = {
    ...a,
    key: "android:vn:b",
    title: "B Game",
    platform: "android",
    downloads: { growth: 30 },
  };
  assert.deepEqual(
    selectGames([a, b], { country: "vn", sort: "growth" }).map((g) => g.key),
    [b.key, a.key],
  );
  assert.equal(selectGames([a, b], { watchOnly: true }, [a.key]).length, 1);
  assert.equal(
    selectGames([a, b], { search: "studio", platform: "ios" }).length,
    1,
  );
});
test("validates daily downloads with explicit provenance and estimate labels", () => {
  const row = {
    key: game.key,
    date: day,
    downloads: 20,
    source: "Report",
    estimated: true,
  };
  assert.equal(validateRecords([row], [game], day).length, 1);
  for (const invalid of [
    { ...row, key: "unknown" },
    { ...row, date: "2026-02-30" },
    { ...row, date: "2026-11-12" },
    { ...row, downloads: -1 },
    { ...row, downloads: 1.2 },
    { ...row, estimated: undefined },
    { ...row, source: "" },
  ]) {
    assert.throws(() => validateRecords([invalid], [game], day));
  }
  assert.throws(() => validateRecords([row, row], [game], day));
});
