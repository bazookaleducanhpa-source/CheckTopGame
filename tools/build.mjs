import { cp, mkdir, access } from "node:fs/promises";
await access(new URL("../public/data/catalog.json", import.meta.url));
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await cp(
  new URL("../public/", import.meta.url),
  new URL("../dist/", import.meta.url),
  { recursive: true },
);
console.log("Static website ready in dist/");
