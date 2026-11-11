import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { root, loadStore } from "./tools/storage.mjs";
import { collect } from "./tools/collect.mjs";
const config = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url), "utf8"),
);
const port = Number(process.env.PORT ?? 3000);
const publicDir = resolve(root, "public");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
let lastRun = 0;
const server = createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(body));
  };
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-cache");
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === "/api/status")
      return send(200, { local: true, intervalHours: config.intervalHours });
    if (url.pathname === "/api/refresh") {
      if (req.method !== "POST")
        return send(405, { error: "Dùng POST để cập nhật." });
      const hosts = new Set([
        `127.0.0.1:${port}`,
        `localhost:${port}`,
        `[::1]:${port}`,
      ]);
      if (
        !hosts.has(req.headers.host) ||
        (req.headers.origin && !hosts.has(new URL(req.headers.origin).host)) ||
        req.headers["x-checktopgame"] !== "refresh"
      )
        return send(403, { error: "Yêu cầu không hợp lệ." });
      if (Date.now() - lastRun < 60000)
        return send(429, {
          error: "Vui lòng chờ 60 giây giữa các lần cập nhật.",
        });
      lastRun = Date.now();
      return send(200, await collect());
    }
    if (!["GET", "HEAD"].includes(req.method))
      return send(405, { error: "Method not allowed" });
    const path = resolve(
      publicDir,
      `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
    );
    if (!path.startsWith(publicDir + sep))
      return send(403, { error: "Forbidden" });
    const body = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (error) {
    send(error.code === "ENOENT" ? 404 : 500, {
      error: error.code === "ENOENT" ? "Not found" : "Không thể xử lý yêu cầu.",
    });
  }
});
server.listen(port, "127.0.0.1", async () => {
  console.log(`CheckTopGame: http://localhost:${port}`);
  if (!(await loadStore()).updatedAt) collect().catch(console.error);
});
const timer = setInterval(
  () => collect().catch(console.error),
  config.intervalHours * 3600000,
);
timer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => process.exit(0));
  });
