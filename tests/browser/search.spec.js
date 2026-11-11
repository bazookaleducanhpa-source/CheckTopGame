import { test, expect } from "@playwright/test";
const fixture = {
  updatedAt: new Date().toISOString(),
  sources: [],
  observations: [],
  downloads: [],
  games: [
    {
      key: "android:vn:com.garena.game",
      id: "com.garena.game",
      title: "Garena Liên Quân Mobile",
      developer: "Đội Ngũ",
      platform: "android",
      country: "vn",
      genre: "Action",
      url: "https://play.google.com/store/apps/details?id=com.garena.game",
    },
    {
      key: "ios:us:1234567",
      id: "1234567",
      title: "US Exclusive Game",
      developer: "Example Studio",
      platform: "ios",
      country: "us",
      genre: "Games",
      url: "https://apps.apple.com/us/app/id1234567",
    },
  ],
};
const found = {
  key: "ios:us:9999999",
  id: "9999999",
  title: "Brawl Stars",
  developer: "Supercell",
  platform: "ios",
  country: "us",
  genre: "Action",
  screenshots: [],
  url: "https://apps.apple.com/us/app/id9999999",
  discoveredBy: "search",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/data/catalog.json*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.route("**/api/search?*", (route) =>
    route.fulfill({ json: { games: [found], warnings: [] } }),
  );
});
test("accent-free local search and global results bypass stale ranking filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-platform="ios"]').click();
  await page.locator("#search").fill("lien quan");
  await expect(page.locator("#game-rows")).toContainText(
    "Garena Liên Quân Mobile",
  );
  await expect(page.locator(".ranking-panel .filters")).toBeHidden();
  await page.locator("#search").fill("us exclusive");
  await expect(page.locator("#game-rows")).toContainText("US Exclusive Game");
  await expect(page.locator("#result-count")).toContainText("Mọi thị trường");
  await page
    .locator("#search")
    .fill("https://apps.apple.com/us/app/example/id1234567");
  await expect(page.locator("#game-rows")).toContainText("US Exclusive Game");
  await page.locator("#search").fill("");
  await expect(page.locator(".ranking-panel .filters")).toBeVisible();
});
test("Enter finds a game outside the catalog and saved results survive a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#search").fill("Brawl Stars");
  await page.locator("#search").press("Enter");
  await expect(page.locator("#game-rows")).toContainText("Brawl Stars");
  await expect(page.locator("#search-message")).toContainText("Đã tìm");
  await page.locator("#game-rows [data-detail]").click();
  await expect(page.locator("#detail")).toContainText("Supercell");
  await page.locator("#detail [data-watch]").click();
  await page.locator("#detail .dialog-close").click();
  await page.reload();
  await page.locator('[data-view="watchlist"]').click();
  await page.locator("#country").selectOption("us");
  await expect(page.locator("#game-rows")).toContainText("Brawl Stars");
});
test("a late response cannot replace a newer search", async ({ page }) => {
  await page.unroute("**/api/search?*");
  await page.route("**/api/search?*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q === "old query")
      await new Promise((resolve) => setTimeout(resolve, 500));
    await route
      .fulfill({ json: { games: [{ ...found, title: q }], warnings: [] } })
      .catch(() => {});
  });
  await page.goto("/");
  await page.locator("#search").fill("old query");
  await page.locator("#search").press("Enter");
  await page.locator("#search").fill("new query");
  await page.locator("#search").press("Enter");
  await expect(page.locator("#game-rows")).toContainText("new query");
  await expect(page.locator("#game-rows")).not.toContainText("old query");
});
test("search endpoint validates requests before contacting stores", async ({
  request,
}) => {
  expect((await request.get("/api/search?q=a")).status()).toBe(400);
  expect((await request.post("/api/search?q=game")).status()).toBe(405);
  expect(
    (
      await request.get("/api/search?q=game", {
        headers: { Origin: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
});
