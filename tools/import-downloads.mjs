import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadStore, saveStore } from "./storage.mjs";

export function validateRecords(
  rows,
  games,
  today = new Date().toISOString().slice(0, 10),
) {
  if (!Array.isArray(rows) || !rows.length)
    throw new Error("Cần một mảng JSON chứa dữ liệu hằng ngày.");
  const keys = new Set(games.map((g) => g.key)),
    seen = new Set();
  return rows.map((row, i) => {
    const fail = (message) => {
      throw new Error(`Dòng ${i + 1}: ${message}`);
    };
    if (!keys.has(row.key)) fail("key không có trong danh mục game.");
    if (
      typeof row.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !Number.isFinite(Date.parse(row.date)) ||
      new Date(row.date).toISOString().slice(0, 10) !== row.date ||
      row.date > today
    )
      fail("date không hợp lệ hoặc nằm trong tương lai.");
    if (!Number.isSafeInteger(row.downloads) || row.downloads < 0)
      fail("downloads phải là số nguyên không âm, là lượt tải trong ngày.");
    if (typeof row.source !== "string" || !row.source.trim())
      fail("cần tên nguồn source.");
    if (typeof row.estimated !== "boolean")
      fail("estimated phải là true hoặc false.");
    const id = `${row.key}|${row.date}`;
    if (seen.has(id)) fail("trùng game và ngày trong file nhập.");
    seen.add(id);
    return {
      key: row.key,
      date: row.date,
      downloads: row.downloads,
      source: row.source.trim(),
      estimated: row.estimated,
    };
  });
}

async function main() {
  if (!process.argv[2])
    throw new Error("Cách dùng: npm run import -- duong-dan/downloads.json");
  const data = await loadStore();
  const rows = validateRecords(
    JSON.parse(await readFile(process.argv[2], "utf8")),
    data.games,
  );
  const map = new Map(data.downloads.map((p) => [`${p.key}|${p.date}`, p]));
  for (const row of rows) map.set(`${row.key}|${row.date}`, row);
  data.downloads = [...map.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  await saveStore(data);
  console.log(`Đã nhập ${rows.length} bản ghi lượt tải hằng ngày.`);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
