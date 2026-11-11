import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  PROVIDERS,
  PUBLIC_IOS_DIRECTORIES,
  parseCivCharts,
  parseAppCurves,
  parseTrendKit,
  publicTrendKitApps,
  counterDeltas,
  createPublicFetcher,
} from "./download-providers.mjs";
import { loadStore, saveStore, exclusive } from "./storage.mjs";
import { dateKey, shiftDay } from "../public/metrics.js";

export async function collectDownloadData(
  data,
  { now = new Date().toISOString(), fetchPublic = createPublicFetcher() } = {},
) {
  const day = dateKey(now),
    cutoff = shiftDay(day, -1100);
  const config = JSON.parse(
    await readFile(new URL("../config.json", import.meta.url), "utf8"),
  );
  data.installReadings ??= [];
  data.downloadChecks ??= [];
  const daily = new Map(
    data.downloads.map((p) => [
      `${p.key}|${p.provider ?? "manual"}|${p.date}`,
      p,
    ]),
  );
  const readings = new Map(
    data.installReadings.map((p) => [`${p.id}|${p.provider}|${p.date}`, p]),
  );
  const apps = new Map(data.games.map((g) => [`${g.platform}:${g.id}`, g]));
  const statuses = [];
  const checkFor = (provider, id) =>
    data.downloadChecks.find((p) => p.provider === provider && p.id === id);
  const checkedToday = (provider, id) =>
    checkFor(provider, id)?.checkedAt?.slice(0, 10) === day;
  function checked(provider, id, status, count, error) {
    const entry = {
      provider,
      id,
      checkedAt: now,
      status,
      count,
      ...(error ? { error } : {}),
    };
    const index = data.downloadChecks.findIndex(
      (p) => p.provider === provider && p.id === id,
    );
    if (index < 0) data.downloadChecks.push(entry);
    else data.downloadChecks[index] = entry;
  }
  function storeReadings(id, provider, rows, sourceUrl) {
    for (const row of rows)
      readings.set(`${id}|${provider}|${row.date}`, {
        ...row,
        id,
        provider,
        sourceUrl,
        collectedAt: row.collectedAt ?? now,
      });
    // Recompute this provider's series so corrections cannot leave an obsolete delta behind.
    for (const [idKey, row] of daily)
      if (row.key === `android:global:${id}` && row.provider === provider)
        daily.delete(idKey);
    const history = [...readings.values()].filter(
      (p) => p.id === id && p.provider === provider,
    );
    for (const row of counterDeltas(
      history,
      `android:global:${id}`,
      provider,
      sourceUrl,
    ))
      daily.set(`${row.key}|${provider}|${row.date}`, row);
  }
  const android = [...apps.values()]
    .filter((g) => g.platform === "android")
    .sort(
      (a, b) =>
        String(b.lastSeen ?? "").localeCompare(String(a.lastSeen ?? "")) ||
        (a.rank ?? Infinity) - (b.rank ?? Infinity),
    );
  // Our own counter observations continue even when external archives are unavailable.
  for (const game of android) {
    const observed = data.games
      .filter(
        (g) =>
          g.platform === "android" &&
          g.id === game.id &&
          g.publicInstalls != null,
      )
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))[0];
    if (observed?.lastSeen?.slice(0, 10) === day)
      storeReadings(
        game.id,
        "google-play",
        [
          {
            date: day,
            total: observed.publicInstalls,
            collectedAt: observed.lastSeen,
          },
        ],
        observed.url,
      );
  }
  for (const provider of ["civcharts", "appcurves"]) {
    let stopped = false;
    let consecutiveErrors = 0;
    for (const game of android.slice(
      0,
      config.downloads?.maxAndroidApps ?? 250,
    )) {
      if (checkedToday(provider, game.id)) continue;
      // AppCurves is a fallback archive; do not request it when CivCharts already has history.
      if (
        provider === "appcurves" &&
        [...daily.values()].some(
          (p) =>
            p.key === `android:global:${game.id}` && p.provider === "civcharts",
        )
      )
        continue;
      if (stopped) break;
      try {
        const sourceUrl =
          provider === "civcharts"
            ? `https://civcharts.com/api/app?store=android&appId=${encodeURIComponent(game.id)}`
            : `https://appcurves.com/app/${encodeURIComponent(game.id)}.md`;
        const url =
          provider === "civcharts"
            ? `https://civcharts.com/api/app?store=android&appId=${encodeURIComponent(game.id)}`
            : sourceUrl;
        const response = await fetchPublic(url);
        const rows =
          provider === "civcharts"
            ? parseCivCharts(await response.json(), game.id)
            : parseAppCurves(await response.text(), game.id);
        storeReadings(game.id, provider, rows, sourceUrl);
        checked(
          provider,
          game.id,
          rows.length ? "ok" : "unavailable",
          rows.length,
        );
        consecutiveErrors = 0;
      } catch (error) {
        checked(
          provider,
          game.id,
          error.status === 404 ? "unavailable" : "error",
          0,
          error.message,
        );
        consecutiveErrors = error.status === 404 ? 0 : consecutiveErrors + 1;
        if (
          [401, 402, 403, 429].includes(error.status) ||
          consecutiveErrors >= 3
        )
          stopped = true;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, config.downloads?.requestDelayMs ?? 350),
      );
    }
  }
  // Discover only apps whose numerical estimates are public in the Games directory.
  // Pages advertising a paid plan are not used to reconstruct paid or hidden data.
  const ios = [...apps.values()].filter((g) => g.platform === "ios");
  if (ios.some((g) => !checkedToday("apptrendkit", g.id))) {
    try {
      let publicIds;
      if (
        data.publicIosDownloadApps?.date === day &&
        PUBLIC_IOS_DIRECTORIES.every((url) =>
          data.publicIosDownloadApps.sources?.includes(url),
        )
      )
        publicIds = new Set(data.publicIosDownloadApps.ids);
      else {
        publicIds = new Set(
          data.publicIosDownloadApps?.date === day
            ? data.publicIosDownloadApps.ids
            : [],
        );
        const sources = [];
        for (const url of PUBLIC_IOS_DIRECTORIES) {
          const ids = publicTrendKitApps(await (await fetchPublic(url)).text());
          for (const id of ids) publicIds.add(id);
          sources.push(url);
        }
        data.publicIosDownloadApps = {
          date: day,
          ids: [...publicIds],
          sources,
        };
      }
      let consecutiveErrors = 0;
      for (const game of ios
        .filter((g) => publicIds.has(g.id))
        .slice(0, config.downloads?.maxIosApps ?? 200)) {
        if (checkedToday("apptrendkit", game.id)) continue;
        const provider = "apptrendkit",
          sourceUrl = `https://www.apptrendkit.com/apps/ios/${game.id}`;
        try {
          const rows = parseTrendKit(
            await (await fetchPublic(sourceUrl)).text(),
            game.id,
          );
          for (const row of rows) {
            const record = {
              ...row,
              key: `ios:global:${game.id}`,
              provider,
              scope: "global",
              source: PROVIDERS.apptrendkit.name,
              sourceUrl,
              metric: "download-estimate",
              estimated: true,
              collectedAt: now,
            };
            daily.set(`${record.key}|${provider}|${row.date}`, record);
          }
          checked(
            provider,
            game.id,
            rows.length ? "ok" : "unavailable",
            rows.length,
          );
          consecutiveErrors = 0;
        } catch (error) {
          checked(
            provider,
            game.id,
            error.status === 404 ? "unavailable" : "error",
            0,
            error.message,
          );
          consecutiveErrors = error.status === 404 ? 0 : consecutiveErrors + 1;
          if (
            [401, 402, 403, 429].includes(error.status) ||
            consecutiveErrors >= 3
          )
            break;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, config.downloads?.requestDelayMs ?? 350),
        );
      }
    } catch (error) {
      checked("apptrendkit", "directory", "error", 0, error.message);
    }
  }
  data.downloads = [...daily.values()]
    .filter((p) => p.date >= cutoff)
    .map((p) =>
      p.provider === "civcharts"
        ? {
            ...p,
            sourceUrl: `https://civcharts.com/api/app?store=android&appId=${encodeURIComponent(p.key.split(":").slice(2).join(":"))}`,
          }
        : p,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  data.installReadings = [...readings.values()].filter((p) => p.date >= cutoff);
  for (const [provider, metadata] of Object.entries(PROVIDERS)) {
    const checks = data.downloadChecks.filter((p) => p.provider === provider);
    const records = data.downloads.filter((p) => p.provider === provider);
    const matched = new Set(records.map((p) => p.key)).size;
    const failures = checks.filter((p) => p.status === "error");
    const successAt =
      checks
        .filter((p) => p.status === "ok")
        .map((p) => p.checkedAt)
        .sort()
        .at(-1) ??
      (provider === "google-play"
        ? [...readings.values()]
            .filter((p) => p.provider === provider)
            .map((p) => p.collectedAt)
            .sort()
            .at(-1)
        : null);
    statuses.push({
      id: `downloads:${provider}`,
      kind: "downloads",
      name: metadata.name,
      platform: metadata.platform,
      country: "global",
      sourceUrl: metadata.url,
      checkedAt: now,
      status: failures.length
        ? records.length
          ? "partial"
          : "error"
        : records.length
          ? "ok"
          : "partial",
      lastSuccessAt: successAt ?? null,
      count: matched,
      records: records.length,
      warning: `${matched} game có dữ liệu; ${records.length} ngày/game. ${checks.filter((p) => p.status === "unavailable").length} game chưa có lịch sử tại nguồn.${failures.length ? ` ${failures.length} yêu cầu lỗi; giữ dữ liệu đã có.` : ""}`,
    });
  }
  data.sources = [
    ...data.sources.filter((s) => s.kind !== "downloads"),
    ...statuses,
  ];
  data.downloadsUpdatedAt = now;
  return {
    providers: statuses,
    records: data.downloads.length,
    games: new Set(data.downloads.map((p) => p.key)).size,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  exclusive(async () => {
    const data = await loadStore();
    const result = await collectDownloadData(data);
    await saveStore(data);
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
