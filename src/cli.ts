import { parseViewport } from "./agent/viewports.js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { saveCapture, loadCapture, saveDiff } from "./agent/captureFiles.js";
import { renderEvidence, diffEvidence } from "./agent/renderEvidence.js";
import { createRenderer } from "./agent/createRenderer.js";
import { createMcpServer } from "./agent/mcpServer.js";
import { createPreviewServer } from "./server/createPreviewServer.js";
import { findUsages } from "./usages/findUsages.js";
import { routeFor } from "./project/routeFor.js";
import { audit } from "./agent/audit.js";
import { inspectProject } from "./project/inspectProject.js";

const HELP = `arguseye: inspect React and Vue components and verify UI edits, no dev server

  arguseye mcp [--root DIR] [--build-mode native|vite]
      MCP server on stdio for coding agents (render_component, list_usages, render_usages)

  arguseye doctor [--root DIR] [--json]
      Check installed framework packages and compiler limitations without starting a browser

  arguseye shot FILE [--export NAME] [--usage ID] [--props JSON] [--viewport WxH] [--theme light|dark] [--out FILE.png] [--root DIR]
      Render once: writes a PNG and prints the accessibility snapshot and errors
      --in-context renders inside the usage's parent elements; --frame WxH[:background] inside a stand-in box

  arguseye shot FILE [--build-mode native|vite] [--capture-dir DIR] [--json] [--output image|summary|both]
      Save an immutable baseline and optional PNG; JSON reports metadata without image bytes
      --fixtures FILE.json replays explicit browser inputs; --timeout-ms N bounds execution

  arguseye diff --baseline DIR --out DIR [--json] [--root DIR]
      Compare current source against a saved baseline; writes before/after/diff PNGs and JSON

  arguseye usages FILE [--export NAME] [--root DIR]
      Print every usage of a component with its real props (JSON)

  arguseye install <claude|codex|gemini|cursor|windsurf|vscode|antigravity|copilot|print|all> [--project DIR] [--dry-run]
      Write the MCP server entry and the skill where that agent reads them (merges existing config)

  arguseye audit [DIR] [--limit N] [--cursor TOKEN] [--json] [--out report.json] [--root DIR]
      Render every component under DIR once with sample props: what renders, what errors, what comes out empty

  arguseye serve FILE [--export NAME] [--usage ID] [--props JSON] [--port N] [--root DIR]
      Start the preview server and print a URL that shows the component live (updates as files change)`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "build-mode": { type: "string", default: "native" },
    root: { type: "string", default: process.cwd() },
    export: { type: "string" },
    usage: { type: "string" },
    props: { type: "string" },
    viewport: { type: "string" },
    theme: { type: "string" },
    out: { type: "string" },
    port: { type: "string" },
    "in-context": { type: "boolean" },
    frame: { type: "string" },
    project: { type: "string" },
    "dry-run": { type: "boolean" },
    json: { type: "boolean" },
    output: { type: "string", default: "both" },
    "capture-dir": { type: "string" },
    baseline: { type: "string" },
    limit: { type: "string" },
    cursor: { type: "string" },
    fixtures: { type: "string" },
    "timeout-ms": { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});
const [command, file] = positionals;
const root = path.resolve(values.root!);
const buildMode = values["build-mode"] as "native" | "vite";
if (!["native", "vite"].includes(buildMode)) throw new Error(`Unknown build mode "${buildMode}"`);

if (values.help || !command) {
  console.log(HELP);
} else if (command === "doctor") {
  const report = inspectProject(root, buildMode);
  console.log(values.json ? JSON.stringify(report) : `${report.root}\n${report.packages.map((p) => `${p.name}: ${p.installed ?? "not installed"}`).join("\n")}\n${report.diagnostics.map((d) => `${d.code}: ${d.message}\n  ${d.recovery}`).join("\n")}`);
  process.exitCode = report.errors.length ? 1 : 0;
} else if (command === "mcp") {
  const mcp = await createMcpServer({ root, buildMode });
  await mcp.server.connect(new StdioServerTransport());
  const stop = async () => { await mcp.close(); process.exit(0); };
  process.stdin.on("close", stop);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else if (command === "install" && file) {
  const { install, CLIENTS } = await import("./install.js");
  const client = file as any;
  if (client !== "all" && !CLIENTS.includes(client)) { console.error(`Unknown client "${file}". One of: ${CLIENTS.join(", ")}, all`); process.exitCode = 2; }
  else {
    const steps = install({ client, project: path.resolve(values.project ?? root), dryRun: values["dry-run"] });
    if (client === "print") console.log(steps[0].note);
    else {
      for (const s of steps) console.log(`${values["dry-run"] ? "would " : ""}${s.action.padEnd(5)} ${s.file}${s.note ? `  (${s.note})` : ""}`);
      console.log(values["dry-run"] ? "Dry run: nothing written." : "Done. Restart the agent so it picks up the new MCP server and skill.");
    }
  }
} else if (command === "serve" && file) {
  const server = await createPreviewServer({ root, buildMode, port: values.port ? Number(values.port) : undefined, watch: true, warmup: true });
  const target = { file: path.resolve(root, file), exportName: values.export };
  let props = values.props ? JSON.parse(values.props) : undefined;
  if (values.usage) props = { ...(await findUsages(root, target.file, target.exportName)).find((u) => u.id === values.usage)?.props, ...props };
  const route = await routeFor(root, target.file, target.exportName, values.usage, (f, e) => findUsages(root, f, e));
  console.log(`${server.url}${server.pageUrl({ ...target, props, route })}`);
  const stop = async () => { await server.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else if (command === "diff" && values.baseline && values.out) {
  const baseline = await loadCapture(values.baseline);
  const renderer = await createRenderer({ root, buildMode: baseline.build?.mode ?? buildMode });
  try {
    const result = await renderer.diff(renderer.restoreCapture(baseline));
    await saveDiff(values.out, result);
    console.log(values.json ? JSON.stringify(diffEvidence(result)) : `${result.status}: ${result.changedPercent.toFixed(2)}% changed pixels; evidence in ${values.out}`);
    process.exitCode = result.status === "incomplete" ? 1 : 0;
  } finally { await renderer.close(); }
} else if (command === "audit") {
  const renderer = await createRenderer({ root, buildMode });
  try {
    const report = await audit(renderer, root, file ? path.resolve(root, file) : root, {
      limit: values.limit ? Number(values.limit) : 200, cursor: values.cursor,
      onEntry: (e) => { if (!values.json) console.log(`${e.status.padEnd(7)} ${e.file}${e.export && e.export !== "default" ? "#" + e.export : ""}${e.ms !== undefined ? ` · ${e.ms} ms` : ""}${e.errors ? "\n        " + e.errors[0] : ""}`); },
    });
    if (values.out) await writeFile(values.out, JSON.stringify(report, null, 2));
    if (values.json) console.log(JSON.stringify(report));
    else console.log(`\n${report.total} components: ${report.ok} ok, ${report.error} with errors, ${report.empty} empty, ${report.skipped} skipped${report.topErrors.length ? "\nMost common errors:\n" + report.topErrors.map((t) => `  ${t.count}× ${t.message}`).join("\n") : ""}`);
    process.exitCode = report.error ? 1 : 0;
  } finally {
    await renderer.close();
  }
} else if ((command === "shot" || command === "usages") && file) {
  const renderer = await createRenderer({ root, buildMode });
  try {
    const target = { file: path.resolve(root, file), exportName: values.export };
    if (command === "usages") {
      console.log(JSON.stringify(await renderer.listUsages(target.file, target.exportName), null, 2));
    } else {
      const { width, height } = parseViewport(values.viewport);
      if (values.theme !== undefined && values.theme !== "light" && values.theme !== "dark") throw new Error(`Unknown theme "${values.theme}"; use light or dark`);
      const result = await renderer.render({
        theme: values.theme as "light" | "dark" | undefined,
        ...target,
        fixtures: values.fixtures ? JSON.parse(await readFile(values.fixtures, "utf8")) : undefined,
        usage: values.usage,
        inContext: values["in-context"],
        frame: values.frame ? (([size, background]) => { const [width, height] = size.split("x").map(Number); return { width, height, background }; })(values.frame.split(":")) : undefined,
        props: values.props ? JSON.parse(values.props) : undefined,
        viewport: { width, height },
      }, { timeoutMs: values["timeout-ms"] ? Number(values["timeout-ms"]) : undefined });
      if (!["image", "summary", "both"].includes(values.output!)) throw new Error(`Unknown output "${values.output}"`);
      if (values["capture-dir"]) await saveCapture(values["capture-dir"], result);
      const out = values.out ?? `${path.parse(file).name}.png`;
      if (values.output !== "summary") await writeFile(out, result.png);
      if (values.json) console.log(JSON.stringify({ ...renderEvidence(result), ...(values.output !== "summary" ? { image: path.resolve(out) } : {}) }));
      else console.log(`${out} · ${result.ms} ms\nerrors: ${result.errors.length ? "\n- " + result.errors.join("\n- ") : "none"}\n${result.snapshot}`);
      process.exitCode = result.errors.length ? 1 : 0;
    }
  } catch (error) {
    // A clean one-line error (no Node stack) that names what to pass instead, for people and agents alike.
    console.error(`error: ${(error as Error).message ?? error}`);
    process.exitCode = 1;
  } finally {
    await renderer.close();
  }
} else {
  console.error(HELP);
  process.exitCode = 2;
}
