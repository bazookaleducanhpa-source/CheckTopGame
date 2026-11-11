import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesSearch,
  normalizeSearch,
  searchTerm,
} from "../public/metrics.js";
import { searchStores, playSearchIds } from "../tools/search.mjs";

test("search handles Vietnamese accents, spaces, IDs and store links", () => {
  const game = {
    key: "android:vn:com.garena.game",
    id: "com.garena.game",
    title: "Garena Liên Quân Mobile",
    developer: "Đội Ngũ",
  };
  for (const q of [
    "lien quan",
    "  LIÊN   QUÂN ",
    "doi ngu",
    "com.garena.game",
    "https://play.google.com/store/apps/details?id=com.garena.game&hl=en",
  ])
    assert.equal(matchesSearch(game, q), true, q);
  assert.equal(matchesSearch(game, "??"), false);
  assert.equal(matchesSearch(game, "unrelated"), false);
  assert.equal(
    searchTerm("https://apps.apple.com/us/app/example/id12345678?l=en"),
    "12345678",
  );
  assert.equal(normalizeSearch("Đấu Trường®"), "dau truong");
});
test("Play public search extracts unique packages and excludes unrelated URLs", () => {
  assert.deepEqual(
    playSearchIds(
      '<a href="/store/apps/details?id=com.supercell.brawlstars">A</a><a href="/store/apps/details?id=com.supercell.brawlstars&gl=us">B</a><a href="https://evil.example/store/apps/details?id=com.fake.app">C</a>',
    ),
    ["com.supercell.brawlstars"],
  );
});
test("store search merges countries/platforms, deduplicates keys and retains partial successes", async () => {
  const ios = async (q, country) => [
    { key: `ios:${country}:123`, title: q },
    { key: `ios:${country}:123`, title: q },
  ];
  const android = async () => {
    throw new Error("Temporary source failure");
  };
  const result = await searchStores("Brawl Stars", { ios, android });
  assert.equal(result.games.length, 2);
  assert.equal(result.warnings.length, 2);
  assert.equal(result.query, "Brawl Stars");
  await assert.rejects(() => searchStores("a", { ios, android }));
});
test("store URLs and IDs use the matching platform only", async () => {
  let googleCalls = 0,
    appleCalls = 0;
  const android = async () => {
      googleCalls++;
      return [];
    },
    ios = async () => {
      appleCalls++;
      return [];
    };
  await searchStores(
    "https://play.google.com/store/apps/details?id=com.example.game",
    { android, ios },
  );
  assert.equal(googleCalls, 2);
  assert.equal(appleCalls, 0);
  await searchStores("https://apps.apple.com/us/app/game/id1234567", {
    android,
    ios,
  });
  assert.equal(googleCalls, 2);
  assert.equal(appleCalls, 2);
});
