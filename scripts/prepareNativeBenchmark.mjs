import { chromium } from "playwright-core";
import os from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Timing tests require a quiet machine. Warm executable loading, then wait once; never retry measured renders.
const record = { sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), platform: os.platform(), cpu: os.cpus()[0]?.model, cores: os.availableParallelism(), node: process.version, status: "running", browsers: [], samples: [] };
const directory = "artifacts/native-conformance";
mkdirSync(directory, { recursive: true });
const save = () => writeFileSync(`${directory}/benchmark-machine.json`, JSON.stringify(record, null, 2));
try {
  for (const channel of ["chromium-headless-shell", "chrome"]) {
    const browser = await chromium.launch({ channel });
    try {
      const page = await browser.newPage(); await page.setContent("<p>Native benchmark readiness</p>");
      record.browsers.push({ channel, version: browser.version() });
    } finally { await browser.close(); }
  }
  const limit = record.cores * 0.75, started = performance.now();
  let stable = 0;
  while (performance.now() - started <= 300000) {
    const load = os.loadavg()[0];
    record.samples.push({ elapsedMs: Math.round(performance.now() - started), load, limit });
    console.log(`Native benchmark readiness: load ${load.toFixed(2)}, required <= ${limit.toFixed(2)} (${record.cores} cores)`);
    stable = load <= limit ? stable + 1 : 0;
    if (stable >= 3) { record.status = "ready"; save(); break; }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (record.status !== "ready") throw new Error("Native timing machine did not become quiet within five minutes; no measured render was retried. Use a quiet runner before accepting timing results.");
} catch (error) { record.status = "failed"; record.error = String(error); save(); throw error; }
