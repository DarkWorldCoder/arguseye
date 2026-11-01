import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";

// Isolate Chromium's screenshot transport from compilation, framework work and settling.
const records = [];
for (const [name, options] of [
  ["default", {}],
  ["legacy-surface", { ignoreDefaultArgs: ["--enable-features=CDPScreenshotNewSurface"] }],
  ["compositor-flush", { args: ["--run-all-compositor-stages-before-draw"] }],
]) {
  const browser = await chromium.launch({ channel: "chromium-headless-shell", ...options });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent('<body style="margin:0"><div style="width:340px;height:200px">Screenshot transport</div></body>');
    const session = await page.context().newCDPSession(page);
    const times = [], hashes = new Map();
    for (let i = 0; i < 22; i++) {
      const color = i % 2 ? "red" : "blue";
      await page.evaluate((color) => { document.querySelector("div").style.background = color; }, color);
      const start = performance.now();
      const { data } = await session.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 340, height: 200, scale: 1 }, optimizeForSpeed: true, captureBeyondViewport: true });
      const ms = performance.now() - start;
      const hash = createHash("sha256").update(data).digest("hex");
      if (i < 2) hashes.set(color, hash);
      else {
        if (hash !== hashes.get(color) || hash === hashes.get(color === "red" ? "blue" : "red")) throw new Error(`${name}: stale or inconsistent ${color} screenshot`);
        times.push(Math.round(ms));
      }
    }
    const record = { name, p95: [...times].sort((a,b)=>a-b)[18], times };
    records.push(record); console.log("Screenshot profile", JSON.stringify(record));
  } finally { await browser.close(); }
}
mkdirSync("artifacts/native-conformance", { recursive: true });
writeFileSync("artifacts/native-conformance/capture-profile.json", JSON.stringify({ platform: os.platform(), cpu: os.cpus()[0]?.model, node: process.version, records }, null, 2));
