import { test, expect } from "@playwright/test";
import { dateKey, shiftDay } from "../../public/metrics.js";
import { downloadSeriesFor } from "../../public/metrics.js";

const end = dateKey(new Date());
const game = {
  key: "ios:vn:chart-test",
  id: "chart-test",
  title: "Download chart test",
  developer: "Test fixture",
  platform: "ios",
  country: "vn",
  genre: "Games",
  icon: "/favicon.svg",
  url: "https://apps.apple.com/",
  description: "Fixture only",
  firstSeen: end,
  lastSeen: end,
  screenshots: [],
};
function downloads() {
  return Array.from({ length: 21 }, (_, i) => ({
    key: game.key,
    date: shiftDay(end, -i),
    downloads: i < 7 ? 200 : 100,
    source: "Browser test fixture",
    estimated: i === 8,
  }));
}
async function open(page, rows) {
  await page.route("**/data/catalog.json*", (route) =>
    route.fulfill({
      json: {
        games: [game],
        observations: [{ key: game.key, date: end, rank: 1 }],
        downloads: rows,
        sources: [],
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/");
  await page.locator("#game-rows [data-detail]").click();
  await expect(page.locator("#download-heading")).toHaveText(
    "Tăng trưởng lượt tải",
  );
}

test("click game to inspect downloads, compare previous period and choose dates", async ({
  page,
}) => {
  await open(page, downloads());
  const chart = page.locator("#download-chart");
  await expect(
    chart.locator(".download-stat").nth(0).locator("strong"),
  ).toHaveText("1.400");
  await expect(
    chart.locator(".download-stat").nth(1).locator("strong"),
  ).toHaveText("+100%");
  await expect(
    chart.locator(".download-stat").nth(2).locator("strong"),
  ).toHaveText("200");
  await expect(chart).toContainText("Có dữ liệu ước tính");
  await expect(chart.locator(".download-line.current")).toHaveAttribute(
    "d",
    /^M.*L/,
  );
  await chart.locator(".download-plot").focus();
  await page.keyboard.press("Home");
  await expect(chart.locator("output")).toContainText(
    `${shiftDay(end, -6)}: 200 lượt`,
  );
  await page.keyboard.press("ArrowRight");
  await expect(chart.locator("output")).toContainText(shiftDay(end, -5));
  await chart.locator("summary").click();
  await expect(chart.locator("tbody tr")).toHaveCount(7);
  await chart.locator('[data-download-days="30"]').click();
  await expect(chart).toContainText("Có 21/30 ngày dữ liệu");
  await expect(
    chart.locator(".download-stat").first().locator("strong"),
  ).toHaveText("—");
  await page.locator("#detail [data-watch]").click();
  await expect(chart.locator('[data-download-days="30"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await chart.locator("input").fill(shiftDay(end, -7));
  await chart.locator("input").dispatchEvent("change");
  await expect(chart.locator(".download-range")).toContainText(
    shiftDay(end, -7),
  );
  await page.screenshot({ path: "test-results/download-chart.png" });
});

test("gaps are not joined and missing totals are never shown as zero", async ({
  page,
}) => {
  const rows = downloads().filter((p) => p.date !== shiftDay(end, -3));
  rows.find((p) => p.date === end).downloads = 0;
  await open(page, rows);
  const chart = page.locator("#download-chart");
  const path = await chart.locator(".download-line.current").getAttribute("d");
  expect(path.match(/M/g)).toHaveLength(2);
  await expect(chart).toContainText("Thiếu 1 ngày");
  await expect(
    chart.locator(".download-stat").first().locator("strong"),
  ).toHaveText("—");
  await expect(chart.locator("output")).toContainText(`${end}: 0 lượt`);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await chart.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
});

test("game without daily downloads clearly explains the missing source", async ({
  page,
}) => {
  await open(page, []);
  await expect(page.locator(".download-empty")).toContainText(
    "Chưa có lịch sử lượt tải",
  );
  await expect(page.locator(".download-plot")).toHaveCount(0);
  await page.locator('[data-download-days="365"]').click();
  await expect(page.locator("#download-chart")).toContainText(
    "Có 0/365 ngày dữ liệu",
  );
});

test("download history collected from public sources renders on a real game", async ({
  page,
}) => {
  const data = await (await page.request.get("/data/catalog.json")).json();
  const game = data.games.find(
    (g) =>
      g.platform === "android" &&
      g.country === "us" &&
      downloadSeriesFor(g, data).some(
        (s) => s.provider === "civcharts" && s.records.length > 14,
      ),
  );
  expect(game).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");
  await page.locator("#country").selectOption("us");
  await page.locator("#search").fill(game.title);
  await page.locator(`#game-rows [data-detail="${game.key}"]`).click();
  await expect(page.locator("#download-chart .download-plot")).toBeVisible();
  await expect(page.locator(".download-source")).toContainText("Toàn cầu");
  await expect(page.locator(".download-source")).toContainText(
    "Không phải lượt tải riêng",
  );
  await expect(page.locator(".download-source select")).toHaveValue(
    "global|civcharts",
  );
  await expect(page.locator(".download-source")).toContainText("CivCharts");
  await page.screenshot({ path: "test-results/real-download-history.png" });
});

test("choosing a provider never sums its global numbers with country reports", async ({
  page,
}) => {
  const rows = downloads();
  const global = rows.map((p) => ({
    ...p,
    key: "ios:global:chart-test",
    downloads: p.downloads * 100,
    scope: "global",
    provider: "apptrendkit",
    source: "AppTrendKit",
    metric: "download-estimate",
  }));
  await open(page, [...rows, ...global]);
  await expect(
    page.locator(".download-stat").first().locator("strong"),
  ).toHaveText("1.400");
  await page
    .locator(".download-source select")
    .selectOption("global|apptrendkit");
  await expect(
    page.locator(".download-stat").first().locator("strong"),
  ).toHaveText("140.000");
  await expect(page.locator(".download-source")).toContainText(
    "Phạm vi: Toàn cầu",
  );
});
