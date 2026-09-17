import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const origin = "https://patilanci-coloring-world.cozypetsbyalis.chatgpt.site";
const books = await (await import("node:fs/promises")).readFile("lib/books.ts", "utf8");
const paths = new Set(books.match(/\/books\/[^\"']+\.png/g) ?? []);
paths.add("/magic-coloring-hero.png");

for (const assetPath of [...paths].sort()) {
  const target = `public${assetPath}`;
  const response = await fetch(`${origin}${assetPath}`);
  if (!response.ok) throw new Error(`${response.status} ${assetPath}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${assetPath}`);
}
