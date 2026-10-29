// Renders an SVG file to PNG with the bundled Chromium: node scripts/render-svg.mjs in.svg out.png [width] [height]
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const [, , svgPath, outPath, w = "256", h = w] = process.argv;
const svg = readFileSync(svgPath, "utf8").replace(/\swidth="\d+"\sheight="\d+"/, ` width="${w}" height="${h}"`);
const browser = await chromium.launch({ channel: "chromium-headless-shell" }).catch(() => chromium.launch({ channel: "chrome" }));
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.waitForTimeout(Number(process.env.WAIT ?? 100));
await page.screenshot({ path: outPath, omitBackground: true, clip: { x: 0, y: 0, width: Number(w), height: Number(h) } });
await browser.close();
console.log("wrote", outPath);
