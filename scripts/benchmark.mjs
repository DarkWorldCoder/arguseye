import { cpSync, mkdtempSync, symlinkSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(path.join(os.tmpdir(), "cp-benchmark-"));
const fixture = path.join(repo, "test/fixtures/react-app");
const cpRoot = path.join(scratch, "arguseye"), pwRoot = path.join(scratch, "playwright");
for (const root of [cpRoot, pwRoot]) {
  cpSync(fixture, root, { recursive: true, filter: (p) => !p.includes("node_modules") });
  symlinkSync(path.join(fixture, "node_modules"), path.join(root, "node_modules"));
}
writeFileSync(path.join(pwRoot, "index.html"), '<html><body style="margin:0"><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
writeFileSync(path.join(pwRoot, "entry.tsx"), 'import React from "react"; import {createRoot} from "react-dom/client"; import {ProductCard} from "./components/ProductCard"; createRoot(document.getElementById("root")).render(React.createElement(ProductCard,{title:"Desk",price:3}));');
const clients = [], transports = [];
let vite;
const report = { date: new Date().toISOString(), machine: { platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, cpu: os.cpus()[0]?.model, node: process.version }, task: "Capture ProductCard(title=Desk, price=3), edit its button label, inspect the rendered result", limitations: ["Scripted tool workflows; no LLM reasoning or model image-token consumption is measured.", "Playwright gets a minimal Vite app with a known URL and no authentication; this is not a universal app-startup comparison.", "Cold means a fresh browser/server process; installed packages and OS caches remain warm.", "Text characters include text blocks and structured JSON evidence. Approximate text tokens use characters/4, exclude images and are not a billing measurement."], results: [] };
async function connect(args, cwd) {
  const started = performance.now();
  const transport = new StdioClientTransport({ command: process.execPath, args, cwd, stderr: "pipe" });
  transports.push(transport);
  const client = new Client({ name: "arguseye-benchmark", version: "1" }); clients.push(client);
  await client.connect(transport);
  return { client, startupMs: Math.round(performance.now() - started) };
}
function metrics() { return { calls: 0, responseBytes: 0, textCharacters: 0, images: 0, toolNames: [] }; }
async function call(client, m, name, args) {
  m.calls++; m.toolNames.push(name);
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${JSON.stringify(result.content).slice(0, 2000)}`);
  m.responseBytes += Buffer.byteLength(JSON.stringify(result));
  if (result.structuredContent) m.textCharacters += JSON.stringify(result.structuredContent).length;
  for (const item of result.content ?? []) {
    if (item.type === "text") m.textCharacters += item.text.length;
    if (item.type === "image") m.images++;
  }
  return result;
}
try {
  const cp = await connect([path.join(repo, "dist/cli.mjs"), "mcp", "--root", cpRoot], cpRoot);
  const viteStart = performance.now();
  vite = await createServer({ configFile: false, root: pwRoot, resolve: { alias: { "@": pwRoot } }, server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  await vite.listen();
  const viteStartupMs = Math.round(performance.now() - viteStart);
  const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const pw = await connect([path.join(repo, "node_modules/@playwright/mcp/cli.js"), "--headless", "--isolated", "--browser", "chrome", "--viewport-size", "1280x800", "--output-dir", path.join(scratch, "images")], pwRoot);
  for (const [index, phase] of ["cold", "warm"].entries()) {
    const wanted = index === 0 ? "Buy now" : "Add to cart";
    const cpMetrics = metrics(), cpStart = performance.now();
    const baseline = await call(cp.client, cpMetrics, "render_component", { file: "components/ProductCard.tsx", export: "ProductCard", props: { title: "Desk", price: 3 } });
    const cpFile = path.join(cpRoot, "components/ProductCard.tsx");
    writeFileSync(cpFile, readFileSync(cpFile, "utf8").replace(index === 0 ? "Add to cart" : "Buy now", wanted));
    const diff = await call(cp.client, cpMetrics, "render_diff", { baselineId: baseline.structuredContent.captureId });
    const verified = diff.structuredContent.after.errors.length === 0 && diff.structuredContent.after.snapshot.includes(wanted);
    report.results.push({ engine: "Arguseye MCP", phase, startupMs: phase === "cold" ? cp.startupMs : 0, workflowMs: Math.round(performance.now() - cpStart), verified, status: diff.structuredContent.status, ...cpMetrics, approximateTextTokens: Math.ceil(cpMetrics.textCharacters / 4) });
    const pwMetrics = metrics(), pwStart = performance.now();
    let navigation = await call(pw.client, pwMetrics, phase === "cold" ? "browser_navigate" : "browser_snapshot", phase === "cold" ? { url } : {});
    let snapshot = navigation.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (!snapshot.includes("Desk")) {
      navigation = await call(pw.client, pwMetrics, "browser_wait_for", { text: "Desk" });
      navigation = await call(pw.client, pwMetrics, "browser_snapshot", {});
      snapshot = navigation.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    }
    const beforeVerified = snapshot.includes("Desk") && snapshot.includes(index === 0 ? "Add to cart" : "Buy now");
    const ref = snapshot.match(/article\s*\[ref=(\w+)\]/)?.[1];
    const shot = { type: "png", ...(ref ? { ref, element: "ProductCard article" } : {}) };
    await call(pw.client, pwMetrics, "browser_take_screenshot", shot);
    const pwFile = path.join(pwRoot, "components/ProductCard.tsx");
    writeFileSync(pwFile, readFileSync(pwFile, "utf8").replace(index === 0 ? "Add to cart" : "Buy now", wanted));
    const changed = await call(pw.client, pwMetrics, "browser_wait_for", { text: wanted + " (0)" });
    await call(pw.client, pwMetrics, "browser_take_screenshot", shot);
    report.results.push({ engine: "Playwright MCP + Vite", phase, startupMs: phase === "cold" ? pw.startupMs + viteStartupMs : 0, workflowMs: Math.round(performance.now() - pwStart), verified: beforeVerified && changed.content.some((c) => c.type === "text" && c.text.includes(wanted)), screenshot: ref ? "component article" : "viewport", ...pwMetrics, approximateTextTokens: Math.ceil(pwMetrics.textCharacters / 4) });
  }
  const samplesMs = [];
  for (let i = 0; i < 20; i++) {
    const sample = await cp.client.callTool({ name: "render_component", arguments: { file: "components/ProductCard.tsx", export: "ProductCard", props: { title: "Desk", price: 3 }, output: "summary" } });
    if (sample.isError) throw new Error("Warm render sample failed");
    samplesMs.push(sample.structuredContent.ms);
  }
  const p95Ms = [...samplesMs].sort((a, b) => a - b)[18];
  report.renderPerformance = { samplesMs, p95Ms, thresholdMs: 100, passed: p95Ms <= 100 };
  const output = path.join(repo, "benchmarks/latest.json");
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!report.renderPerformance.passed || report.results.some((r) => !r.verified)) process.exitCode = 1;
} finally {
  for (const client of clients.reverse()) await client.close().catch(() => {});
  for (const transport of transports.reverse()) await transport.close().catch(() => {});
  await vite?.close(); rmSync(scratch, { recursive: true, force: true });
}
