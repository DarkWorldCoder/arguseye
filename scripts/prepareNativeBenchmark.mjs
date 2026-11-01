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
  const started = performance.now();
  const intervalMs = 5000, minimumIdleFraction = 0.75, maximumSchedulerDelayMs = 25;
  let quietSamples = 0;
  // Load averages retain earlier work and are not a CPU-utilization percentage.
  // Sample current CPU counters and timer scheduling before running the hard gates.
  for (let sample = 0; sample < 60; sample++) {
    const before = os.cpus(), since = performance.now();
    if (!before.length) throw new Error("CPU timing counters are unavailable; native benchmark readiness cannot be established.");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const elapsedMs = performance.now() - since, after = os.cpus();
    let idleMs = 0, totalMs = 0, valid = before.length === after.length;
    for (let index = 0; valid && index < before.length; index++) {
      for (const kind of ["user", "nice", "sys", "idle", "irq"]) {
        const delta = after[index].times[kind] - before[index].times[kind];
        if (!Number.isFinite(delta) || delta < 0) { valid = false; break; }
        totalMs += delta;
        if (kind === "idle") idleMs += delta;
      }
    }
    const idleFraction = valid && totalMs > 0 ? idleMs / totalMs : null;
    const schedulerDelayMs = Math.max(0, elapsedMs - intervalMs);
    const load = os.loadavg()[0];
    const quiet = idleFraction !== null && idleFraction >= minimumIdleFraction && schedulerDelayMs <= maximumSchedulerDelayMs;
    record.samples.push({ elapsedMs: Math.round(performance.now() - started), load, idleFraction, schedulerDelayMs, minimumIdleFraction, maximumSchedulerDelayMs, quiet });
    console.log(`Native timing conditions: ${(100 * (idleFraction ?? 0)).toFixed(1)}% idle, scheduler delay ${schedulerDelayMs.toFixed(1)} ms, load ${load.toFixed(2)} (${record.cores} available cores); ${quiet ? "quiet" : "waiting"}`);
    quietSamples = quiet ? quietSamples + 1 : 0;
    if (quietSamples === 3) break;
  }
  record.status = quietSamples === 3 ? "quiet" : "busy";
  record.policy = "Require three consecutive five-second intervals with >=75% CPU idle and <=25 ms scheduler delay, bounded to five minutes. Load averages are context only. Native render/live-update tests run once with unchanged 100 ms limits; no measured retries or fastest-run selection.";
  save(); console.log(record.policy);
  if (record.status !== "quiet") throw new Error("Native timing preflight remained busy for five minutes; no performance measurements were accepted. See benchmark-machine.json.");
} catch (error) { record.status = "failed"; record.error = String(error); save(); throw error; }
