import test from "node:test";
import assert from "node:assert/strict";
import { downloadTimeline, shiftDay } from "../public/metrics.js";

test("aligns each day to the same position in the previous period and isolates the window", () => {
  const records = [
    { date: "2026-11-11", downloads: 120, source: "Current", estimated: false },
    { date: "2026-11-04", downloads: 80, source: "Older", estimated: true },
    {
      date: "2026-01-01",
      downloads: 99999,
      source: "Outside",
      estimated: true,
    },
  ];
  const model = downloadTimeline(records, "2026-11-11", 7);
  assert.equal(model.start, "2026-11-05");
  assert.equal(model.points.length, 7);
  assert.equal(model.points[6].current.downloads, 120);
  assert.equal(model.points[6].previousDate, "2026-11-04");
  assert.equal(model.points[6].previous.downloads, 80);
  assert.deepEqual(model.sources.sort(), ["Current", "Older"]);
  assert.equal(model.estimated, true);
  assert.equal(model.peak, 120);
  assert.equal(model.metrics.total, null);
});

test("preserves missing days as null and distinguishes measured zero", () => {
  const model = downloadTimeline(
    [{ date: "2026-11-10", downloads: 0, source: "Report", estimated: false }],
    "2026-11-11",
    7,
  );
  assert.equal(model.points[5].current.downloads, 0);
  assert.equal(model.points[6].current, null);
  assert.equal(model.metrics.count, 1);
  assert.equal(model.peak, 0);
});

test("supports complete annual window across leap day and selected historical end", () => {
  const end = "2024-12-31";
  const records = Array.from({ length: 730 }, (_, i) => ({
    date: shiftDay(end, -i),
    downloads: i < 365 ? 20 : 10,
    source: "Report",
    estimated: false,
  }));
  const model = downloadTimeline(records, end, 365);
  assert.equal(model.points.length, 365);
  assert.ok(model.points.some((p) => p.date === "2024-02-29"));
  assert.equal(model.metrics.total, 7300);
  assert.equal(model.metrics.growth, 100);
});
