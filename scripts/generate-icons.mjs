// PWA 아이콘 SVG → PNG 변환 스크립트
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

const sizes = [192, 512];

for (const size of sizes) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.17)}" fill="#030712"/>
  <text
    x="${size / 2}"
    y="${size * 0.68}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${Math.round(size * 0.5)}"
    font-weight="bold"
    fill="#4ade80"
    text-anchor="middle"
    dominant-baseline="auto"
  >FJ</text>
</svg>`;

  const outputPath = join(publicDir, `icon-${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`✓ Generated icon-${size}.png`);
}
