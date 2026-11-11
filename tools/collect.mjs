import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { apple, google } from "./providers.mjs";
import { loadStore, saveStore, exclusive } from "./storage.mjs";
import { dateKey, shiftDay } from "../public/metrics.js";
import { collectDownloadData } from "./collect-downloads.mjs";

export async function collect() {
  return exclusive(async () => {
    const config = JSON.parse(
      await readFile(new URL("../config.json", import.meta.url), "utf8"),
    );
    const data = await loadStore();
    const now = new Date().toISOString(),
      date = dateKey(now);
    const jobs = config.countries.flatMap((country) =>
      ["android", "ios"].map((platform) => ({ country, platform })),
    );
    const results = await Promise.all(
      jobs.map(async ({ country, platform }) => {
        const old = data.sources.find(
          (s) => s.country === country && s.platform === platform,
        );
        try {
          const result = await (platform === "ios" ? apple : google)(
            country,
            config.limit,
          );
          return {
            country,
            platform,
            status: result.warning ? "partial" : "ok",
            checkedAt: now,
            lastSuccessAt: now,
            count: result.games.length,
            ...result,
          };
        } catch (error) {
          return {
            country,
            platform,
            status: "error",
            checkedAt: now,
            lastSuccessAt: old?.lastSuccessAt ?? null,
            count: 0,
            sourceUrl:
              old?.sourceUrl ??
              (platform === "ios"
                ? `https://itunes.apple.com/${country}/rss/topfreeapplications/limit=${config.limit}/genre=6014/json`
                : `https://play.google.com/store/games?gl=${country}&hl=en`),
            error: error.message,
            games: [],
          };
        }
      }),
    );
    for (const result of results) {
      for (const game of result.games) {
        const previous = data.games.find((g) => g.key === game.key);
        const index = data.games.findIndex((g) => g.key === game.key);
        // Keep older details when a provider temporarily returns chart-only data.
        const next = {
          ...game,
          firstSeen: previous?.firstSeen ?? now,
          lastSeen: now,
        };
        if (previous && !game.version) {
          for (const field of [
            "screenshots",
            "description",
            "version",
            "released",
            "updated",
            "ratings",
            "minInstalls",
            "installs",
          ]) {
            if (game[field] == null || game[field]?.length === 0)
              next[field] = previous[field];
          }
        }
        if (index < 0) data.games.push(next);
        else data.games[index] = next;
        const observation = {
          key: game.key,
          date,
          rank: game.rank,
          ratings: game.ratings,
          minInstalls: game.minInstalls,
          score: game.score,
          collectedAt: now,
        };
        const oi = data.observations.findIndex(
          (p) => p.key === game.key && p.date === date,
        );
        if (oi < 0) data.observations.push(observation);
        else data.observations[oi] = observation;
      }
      if (result.status !== "error") {
        // A game missing from today's top chart has no known rank, rather than its stale old rank.
        const seen = new Set(result.games.map((g) => g.key));
        for (const game of data.games.filter(
          (g) =>
            g.country === result.country &&
            g.platform === result.platform &&
            !seen.has(g.key),
        )) {
          const observation = {
            key: game.key,
            date,
            rank: null,
            ratings: null,
            minInstalls: null,
            score: null,
            collectedAt: now,
          };
          const oi = data.observations.findIndex(
            (p) => p.key === game.key && p.date === date,
          );
          if (oi < 0) data.observations.push(observation);
          else data.observations[oi] = observation;
        }
      }
    }
    data.sources = results.map(({ games, ...source }) => source);
    data.observations = data.observations.filter(
      (p) => p.date >= shiftDay(date, -1100),
    );
    data.updatedAt = now;
    await collectDownloadData(data, { now });
    await saveStore(data);
    const summary = {
      updatedAt: now,
      games: data.games.length,
      sources: data.sources,
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await collect();
    if (result.sources.some((s) => s.status === "error")) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
