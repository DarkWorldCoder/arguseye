import { chromium } from "playwright-core";
import os from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Record host conditions independently of the hard fixture gates; never retry measured renders.
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
  for (let sample = 0; sample < 3; sample++) {
    const load = os.loadavg()[0];
    record.samples.push({ elapsedMs: Math.round(performance.now() - started), load, limit });
    console.log(`Native timing conditions: load ${load.toFixed(2)}, quiet reference <= ${limit.toFixed(2)} (${record.cores} cores)`);
    if (sample < 2) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  record.status = record.samples.every((s) => s.load <= s.limit) ? "quiet" : "busy";
  record.policy = "Conditions are evidence, not an assertion bypass. Native render/live-update tests run once with unchanged 100 ms limits. Busy-run numbers are not controlled benchmarks.";
  save(); console.log(record.policy);
} catch (error) { record.status = "failed"; record.error = String(error); save(); throw error; }
