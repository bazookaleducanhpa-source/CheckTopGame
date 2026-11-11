import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const storePath = new URL(
  "../public/data/catalog.json",
  import.meta.url,
);
export async function loadStore() {
  try {
    return JSON.parse(await readFile(storePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      version: 1,
      updatedAt: null,
      games: [],
      observations: [],
      downloads: [],
      sources: [],
    };
  }
}
export async function saveStore(data) {
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  const temp = `${fileURLToPath(storePath)}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temp, storePath);
}
let active;
export function exclusive(task) {
  if (active) return active;
  active = task().finally(() => {
    active = null;
  });
  return active;
}
