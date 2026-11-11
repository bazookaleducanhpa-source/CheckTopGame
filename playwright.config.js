import { defineConfig } from "@playwright/test";
const port = process.env.CTG_TEST_PORT ?? "3111";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "msedge",
  },
  webServer: {
    command: "node server.mjs",
    env: { PORT: port },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
