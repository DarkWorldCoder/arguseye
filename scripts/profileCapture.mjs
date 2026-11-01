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
  ["software-gpu", { args: ["--disable-gpu"] }],
  ["swiftshader", { args: ["--use-angle=swiftshader"] }],
  ["unlimited-frames", { args: ["--disable-frame-rate-limit"] }],
  ["viewport-painted", {}],
  ["view-painted", {}],
  ["full-chromium", { channel: "chromium" }],
  ["system-chrome", { channel: "chrome" }],
  ["unclipped", {}],
  ["unclipped-unlimited", { args: ["--disable-frame-rate-limit"] }],
]) {
  if (process.argv.length > 2 && !process.argv.slice(2).includes(name)) continue;
  let browser;
  try {
    browser = await chromium.launch({ channel: "chromium-headless-shell", ...options });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent('<body style="margin:0"><div style="width:340px;height:200px">Screenshot transport</div></body>');
    const session = await page.context().newCDPSession(page);
    const times = [], pings = [], hashes = new Map();
    const loadBefore = os.loadavg();
    for (let i = 0; i < 22; i++) {
      const color = i % 2 ? "red" : "blue";
      const ping = performance.now();
      await page.evaluate((color) => { document.querySelector("div").style.background = color; }, color);
      if (i >= 2) pings.push(Math.round(performance.now() - ping));
      const start = performance.now();
      if (name.endsWith("-painted")) await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const { data } = await session.send("Page.captureScreenshot", { format: "png", ...(!name.startsWith("unclipped") ? { clip: { x: 0, y: 0, width: 340, height: 200, scale: 1 } } : {}), optimizeForSpeed: true, captureBeyondViewport: !name.endsWith("-painted") && !name.startsWith("unclipped"), ...(name === "view-painted" ? { fromSurface: false } : {}) });
      const ms = performance.now() - start;
      const hash = createHash("sha256").update(data).digest("hex");
      if (i < 2) hashes.set(color, hash);
      else {
        if (hash !== hashes.get(color) || hash === hashes.get(color === "red" ? "blue" : "red")) throw new Error(`${name}: stale or inconsistent ${color} screenshot`);
        times.push(Math.round(ms));
      }
    }
    const record = { name, version: browser.version(), p95: [...times].sort((a,b)=>a-b)[18], times, pings, loadBefore, loadAfter: os.loadavg() };
    records.push(record); console.log("Screenshot profile", JSON.stringify(record));
  } catch (error) {
    const record = { name, error: String(error) }; records.push(record); console.log("Screenshot profile", JSON.stringify(record));
  } finally { await browser?.close(); }
}
mkdirSync("artifacts/native-conformance", { recursive: true });
writeFileSync("artifacts/native-conformance/capture-profile.json", JSON.stringify({ platform: os.platform(), cpu: os.cpus()[0]?.model, node: process.version, records }, null, 2));
