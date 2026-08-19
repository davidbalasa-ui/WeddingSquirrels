import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const jobs = [
  { out: "icon-192.png", src: "icon-192.svg", size: 192 },
  { out: "icon-512.png", src: "icon-512.svg", size: 512 },
  // The source artwork already has a full-bleed background with a centered
  // motif inside the safe zone, so it works as maskable as-is.
  { out: "icon-maskable-512.png", src: "icon-512.svg", size: 512 },
  { out: "apple-touch-icon.png", src: "icon-512.svg", size: 180 },
];

for (const job of jobs) {
  const input = path.join(publicDir, job.src);
  const output = path.join(publicDir, job.out);
  await sharp(input).resize(job.size, job.size).png().toFile(output);
  console.log(`Generated ${job.out}`);
}
