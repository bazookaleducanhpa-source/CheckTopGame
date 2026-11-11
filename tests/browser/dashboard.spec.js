import { test, expect } from "@playwright/test";

test("live catalog, filters, details, watchlist persistence and export", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const catalog = await (await page.request.get("/data/catalog.json")).json();
  const vnGames = catalog.games.filter((g) => g.country === "vn").length;
  const vnAndroid = catalog.games.filter(
    (g) => g.country === "vn" && g.platform === "android",
  ).length;
  await page.goto("/");
  await expect(page.locator("#game-rows tr")).toHaveCount(15);
  await expect(page.locator("#result-count")).toContainText(`${vnGames} game`);
  await page.getByRole("button", { name: "Google Play", exact: true }).click();
  await expect(page.locator("#result-count")).toContainText(
    `${vnAndroid} game`,
  );
  await page.locator("#country").selectOption("us");
  await expect(page.locator("#result-count")).toContainText("Hoa Kỳ");
  await page.getByRole("button", { name: "Tháng", exact: true }).click();
  await page.locator("#game-rows [data-detail]").first().click();
  await expect(page.locator("#detail")).toBeVisible();
  await expect(page.locator(".detail-actions a")).toHaveAttribute(
    "href",
    /https:\/\/play\.google\.com/,
  );
  await expect(page.locator("#detail-content")).toContainText("30 ngày");
  await page.locator("#detail [data-watch]").click();
  await expect(page.locator("#watch-count")).toHaveText("1");
  await page.locator("#detail .dialog-close").click();
  await page.locator('[data-view="watchlist"]').click();
  await expect(page.locator("#game-rows tr")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#watch-count")).toHaveText("1");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /checktopgame.*csv/,
  );
  await page.locator("#search").fill("this-game-does-not-exist-ctg");
  await expect(page.locator("#empty")).toBeVisible();
  await page.locator("#reset").click();
  await expect(page.locator("#game-rows tr")).toHaveCount(15);
  await page.locator('[data-view="sources"]').click();
  await expect(page.locator(".source-card")).toHaveCount(5);
  await page.locator("#help").click();
  await expect(page.locator("#method")).toBeVisible();
  expect(errors).toEqual([]);
  await page.locator("#method .dialog-close").click();
  await page.locator('[data-view="overview"]').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});

test("mobile navigation, detail and no document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#game-rows tr")).toHaveCount(15);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".spotlight [data-detail]").first().click();
  await expect(page.locator("#detail")).toBeVisible();
  await page.locator("#detail .dialog-close").click();
  await page.locator('[data-view="watchlist"]').click();
  await expect(page.locator("#empty")).toBeVisible();
  await page.locator('[data-view="overview"]').click();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("server refuses cross-origin refresh and path traversal", async ({
  request,
}) => {
  const refresh = await request.post("/api/refresh", {
    headers: { Origin: "https://example.com", "X-CheckTopGame": "refresh" },
  });
  expect(refresh.status()).toBe(403);
  const denied = await request.get("/%2e%2e%2fpackage.json");
  expect([403, 404]).toContain(denied.status());
  const wrongMethod = await request.get("/api/refresh");
  expect(wrongMethod.status()).toBe(405);
});
