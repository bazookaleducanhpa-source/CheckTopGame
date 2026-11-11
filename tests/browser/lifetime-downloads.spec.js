import { test, expect } from "@playwright/test";
test("table and game detail show lifetime total separately from period downloads", async ({
  page,
}) => {
  const game = {
    key: "android:vn:com.example.game",
    id: "com.example.game",
    title: "Lifetime Test Game",
    developer: "Example",
    platform: "android",
    country: "vn",
    publicInstalls: 123456789,
    lastSeen: new Date().toISOString(),
    url: "https://play.google.com/store/apps/details?id=com.example.game",
    genre: "Games",
  };
  await page.route("**/data/catalog.json*", (route) =>
    route.fulfill({
      json: {
        games: [game],
        downloads: [],
        sources: [],
        observations: [],
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("columnheader", { name: "TỔNG LƯỢT TẢI", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#game-rows .lifetime-value")).toHaveText(
    "123.456.789",
  );
  await page.locator("#game-rows [data-detail]").click();
  await expect(page.locator(".lifetime-card")).toContainText("123.456.789");
  await expect(page.locator(".lifetime-card")).toContainText("toàn cầu");
  await expect(
    page.locator(".download-stat").first().locator("strong"),
  ).toHaveText("—");
});
