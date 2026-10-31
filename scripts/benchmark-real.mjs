// Real-component benchmark over MCP, the way a coding agent calls Arguseye: one fresh server per project,
// then cold render, warm renders with new props, and an edit on disk followed by a render.
// Run after `npm run build` and installing the fixtures: `node scripts/benchmark-real.mjs`.
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(path.join(os.tmpdir(), "cp-bench-real-"));
const WARM = 12;

/** [project, label, file, export, props(i), edit [from, to], text that must appear after the edit] */
const CASES = [
  ["libs-app", "MUI card (MUI 7 + Emotion, ThemeProvider)", "components/MuiPlan.tsx", "MuiPlan", (i) => ({ name: "Pro", price: 10 + i }), ["/month", "/mo"], "/mo"],
  ["libs-app", "Mantine card (Mantine 8, MantineProvider)", "components/MantineProfile.tsx", "MantineProfile", (i) => ({ name: `User ${i}`, role: "Admin" }), ["Message ", "Email "], "Email "],
  ["libs-app", "Chakra stat (Chakra 3, ChakraProvider)", "components/ChakraStat.tsx", "ChakraStat", (i) => ({ label: "Revenue", value: `$${1000 + i}` }), ["View report", "Open report"], "Open report"],
  ["libs-app", "styled-components tag (themed)", "components/StyledTag.tsx", "StyledTag", (i) => ({ text: `Beta ${i}` }), ["999px", "6px"], null],
  ["libs-app", "shadcn/Radix dialog, open (portal)", "components/ConfirmDelete.tsx", "ConfirmDelete", (i) => ({ item: `file ${i}`, open: true }), ["This cannot be undone.", "This is permanent."], "This is permanent."],
  ["router-app", "React Router 7 nav (Link, hooks)", "components/NavCard.tsx", "NavCard", (i) => ({ title: `Menu ${i}` }), [">Docs<", ">Guides<"], "Guides"],
  ["svelte-app", "Svelte 5 badge (runes, scoped CSS)", "src/lib/Badge.svelte", "default", (i) => ({ label: "New", count: i }), ["({doubled})", "x{doubled}"], "x"],
  ["vue-app", "Vue 3 SFC card (script setup, scoped CSS)", "src/components/Card.vue", "default", (i) => ({ title: "Lamp", price: i }), ["Add (", "Buy ("], "Buy ("],
  ["next-app", "Next.js hero (Tailwind v4, CSS module, next/image)", "components/Hero.tsx", "Hero", (i) => ({ title: `Ship ${i}`, cta: "Start" }), ["Start free", "Begin"], null],
];

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)]; };
const imageTokens = (w, h) => Math.ceil((w * h) / 750); // Anthropic's published estimate for image input tokens

async function connect(root) {
  const started = performance.now();
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(repo, "dist/cli.mjs"), "mcp", "--root", root], cwd: root, stderr: "pipe" });
  const client = new Client({ name: "arguseye-bench-real", version: "1" });
  await client.connect(transport);
  return { client, transport, startupMs: Math.round(performance.now() - started) };
}

async function render(client, file, exportName, props) {
  const started = performance.now();
  const result = await client.callTool({ name: "render_component", arguments: { file, export: exportName, props } });
  const ms = Math.round(performance.now() - started);
  const ev = result.structuredContent ?? {};
  const image = (result.content ?? []).find((c) => c.type === "image");
  const png = image ? Buffer.from(image.data, "base64") : undefined;
  const size = png ? { width: png.readUInt32BE(16), height: png.readUInt32BE(20) } : { width: 0, height: 0 };
  const text = (result.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return { ms, ok: !result.isError && (ev.errors ?? []).length === 0, errors: ev.errors ?? [text.slice(0, 300)], snapshot: ev.snapshot ?? "", size, pngBytes: png?.length ?? 0, textChars: text.length };
}

const report = {
  date: new Date().toISOString(),
  machine: { platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, cpu: os.cpus()[0]?.model, node: process.version },
  method: [
    "Each project is copied to a temporary folder (node_modules linked) and served by a fresh `arguseye mcp` process over stdio, like an agent's MCP client.",
    "Times are the full MCP round trip measured by the client: request, render, PNG, accessibility snapshot, response.",
    `cold = the first render_component call in that process (the dependency bundle may already be on disk from earlier runs); warm = ${WARM} further calls with new props; edit = a source change written to disk, then one call.`,
    "Image tokens use Anthropic's estimate (width x height / 750); text tokens use characters / 4. Neither is a billing measurement.",
  ],
  results: [],
};

const projects = {};
try {
  for (const [project, label, file, exportName, props, [from, to], expectAfter] of CASES) {
    if (!projects[project]) {
      const root = path.join(scratch, project);
      const fixture = path.join(repo, "test/fixtures", project);
      cpSync(fixture, root, { recursive: true, filter: (p) => !p.includes("node_modules") });
      symlinkSync(path.join(fixture, "node_modules"), path.join(root, "node_modules"));
      projects[project] = { root, ...(await connect(root)), first: true };
    }
    const p = projects[project];
    const cold = await render(p.client, file, exportName, props(0));
    const coldLabel = p.first ? "cold" : "first in warm process";
    p.first = false;
    const warm = [];
    for (let i = 1; i <= WARM; i++) warm.push(await render(p.client, file, exportName, props(i)));
    const abs = path.join(p.root, file);
    const original = readFileSync(abs, "utf8");
    writeFileSync(abs, original.replace(from, to));
    const edited = await render(p.client, file, exportName, props(WARM + 1));
    writeFileSync(abs, original);
    const ok = cold.ok && warm.every((w) => w.ok) && edited.ok && (!expectAfter || edited.snapshot.includes(expectAfter));
    const last = warm.at(-1);
    report.results.push({
      project, component: label, file, ok, errors: [...cold.errors, ...edited.errors].slice(0, 3),
      startupMs: cold === undefined ? null : p.startupMs, firstRender: coldLabel, firstMs: cold.ms,
      warmP50Ms: pct(warm.map((w) => w.ms), 0.5), warmP95Ms: pct(warm.map((w) => w.ms), 0.95), warmSamples: warm.map((w) => w.ms),
      editToPixelsMs: edited.ms, editVerified: !expectAfter || edited.snapshot.includes(expectAfter),
      image: last.size, pngBytes: last.pngBytes, imageTokens: imageTokens(last.size.width, last.size.height),
      snapshotChars: last.snapshot.length, textTokens: Math.ceil(last.textChars / 4),
    });
    const r = report.results.at(-1);
    console.log(`${ok ? "ok  " : "FAIL"} ${label}: first ${r.firstMs} ms (${coldLabel}), warm p50 ${r.warmP50Ms} / p95 ${r.warmP95Ms} ms, edit ${r.editToPixelsMs} ms, ${r.image.width}x${r.image.height} ~${r.imageTokens} img + ${r.textTokens} text tokens`);
  }
} finally {
  for (const p of Object.values(projects)) await p.client.close().catch(() => {});
  rmSync(scratch, { recursive: true, force: true });
}
await writeFile(path.join(repo, "benchmarks/real-components.json"), JSON.stringify(report, null, 2) + "\n");
console.log("wrote benchmarks/real-components.json");
