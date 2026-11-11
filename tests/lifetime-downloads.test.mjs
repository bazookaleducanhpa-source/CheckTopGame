import test from "node:test";
import assert from "node:assert/strict";
import { lifetimeDownloadsFor } from "../public/metrics.js";
const game = {
  key: "android:vn:com.example.game",
  id: "com.example.game",
  platform: "android",
  country: "vn",
  installs: "100,000,000+",
  minInstalls: 100000000,
  url: "https://play.google.com/store/apps/details?id=com.example.game",
};
test("lifetime uses the latest raw counter rather than the largest historical value", () => {
  const data = {
    installReadings: [
      {
        id: game.id,
        date: "2026-11-10",
        total: 150000000,
        provider: "civcharts",
      },
      {
        id: game.id,
        date: "2026-11-11",
        total: 149900000,
        provider: "google-play",
      },
      {
        id: "other.game",
        date: "2026-11-11",
        total: 999999999,
        provider: "google-play",
      },
    ],
  };
  const total = lifetimeDownloadsFor(game, data, "2026-11-11");
  assert.equal(total.value, 149900000);
  assert.equal(total.kind, "counter");
  assert.equal(total.scope, "global");
});
test("fresh direct counter overrides older archives and supports real zero", () => {
  const direct = {
    ...game,
    publicInstalls: 0,
    lastSeen: "2026-11-11T10:00:00Z",
  };
  const total = lifetimeDownloadsFor(
    direct,
    {
      installReadings: [
        { id: game.id, date: "2026-11-10", total: 100, provider: "civcharts" },
      ],
    },
    "2026-11-11",
  );
  assert.equal(total.value, 0);
  assert.equal(total.source, "Google Play");
});
test("rounded store bands stay marked as lower bounds", () => {
  const total = lifetimeDownloadsFor(game, {}, "2026-11-11");
  assert.equal(total.value, 100000000);
  assert.equal(total.kind, "lower-bound");
  assert.equal(
    lifetimeDownloadsFor({ ...game, minInstalls: undefined }, {}, "2026-11-11")
      .value,
    100000000,
  );
});
test("iOS daily estimates are never added up and passed off as lifetime downloads", () => {
  const total = lifetimeDownloadsFor(
    { ...game, platform: "ios", publicInstalls: 999999 },
    {
      downloads: [{ key: game.key, downloads: 12345 }],
      installReadings: [{ id: game.id, date: "2026-11-11", total: 12345 }],
    },
    "2026-11-11",
  );
  assert.equal(total.value, null);
  assert.equal(total.kind, "unavailable");
});
