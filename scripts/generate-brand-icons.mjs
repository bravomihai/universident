import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Next already provides sharp for its image pipeline; reuse that exact version.
const requireFromNext = createRequire(import.meta.resolve("next/package.json"));
const sharp = requireFromNext("sharp");
const publicFile = (path) => new URL(`../public/${path}`, import.meta.url);
const source = publicFile("branding/favicon-light.png");
const background = "#E3EFFF";

for (const [size, name] of [
  [180, "universident-apple-touch-icon.png"],
  [192, "universident-icon-192.png"],
  [512, "universident-icon-512.png"],
]) {
  const png = await sharp(fileURLToPath(source))
    .resize(size, size)
    .flatten({ background })
    .png()
    .toBuffer();
  await writeFile(publicFile(`branding/${name}`), png);
  if (size === 180) await writeFile(publicFile("apple-touch-icon.png"), png);
  console.log(`${name}: ${size} x ${size}`);
}

// Legacy browsers may request /favicon.ico without reading the themed links.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) =>
  sharp(fileURLToPath(source)).resize(size, size).ensureAlpha().png().toBuffer(),
));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (const [index, png] of images.entries()) {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await writeFile(publicFile("favicon.ico"), Buffer.concat([header, ...images]));
console.log("favicon.ico: 16, 32 and 48 px");
