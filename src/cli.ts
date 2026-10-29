import { parseViewport } from "./agent/viewports.js";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { saveCapture, loadCapture, saveDiff } from "./agent/captureFiles.js";
import { renderEvidence, diffEvidence } from "./agent/renderEvidence.js";
import { createRenderer } from "./agent/createRenderer.js";
import { createMcpServer } from "./agent/mcpServer.js";
import { createPreviewServer } from "./server/createPreviewServer.js";
import { findUsages } from "./usages/findUsages.js";

const HELP = `arguseye: inspect React and Vue components and verify UI edits, no dev server

  arguseye mcp [--root DIR]
      MCP server on stdio for coding agents (render_component, list_usages, render_usages)

  arguseye shot FILE [--export NAME] [--usage ID] [--props JSON] [--viewport WxH] [--out FILE.png] [--root DIR]
      Render once: writes a PNG and prints the accessibility snapshot and errors
      --in-context renders inside the usage's parent elements; --frame WxH[:background] inside a stand-in box

  arguseye shot FILE [--capture-dir DIR] [--json] [--output image|summary|both]
      Save an immutable baseline and optional PNG; JSON reports metadata without image bytes

  arguseye diff --baseline DIR --out DIR [--json] [--root DIR]
      Compare current source against a saved baseline; writes before/after/diff PNGs and JSON

  arguseye usages FILE [--export NAME] [--root DIR]
      Print every usage of a component with its real props (JSON)

  arguseye install <claude|codex|cursor|windsurf|vscode|antigravity|all> [--project DIR] [--dry-run]
      Write the MCP server entry and the skill where that agent reads them (merges existing config)

  arguseye serve FILE [--export NAME] [--usage ID] [--props JSON] [--port N] [--root DIR]
      Start the preview server and print a URL that shows the component live (updates as files change)`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string", default: process.cwd() },
    export: { type: "string" },
    usage: { type: "string" },
    props: { type: "string" },
    viewport: { type: "string" },
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
    help: { type: "boolean", short: "h" },
  },
});
const [command, file] = positionals;
const root = path.resolve(values.root!);

if (values.help || !command) {
  console.log(HELP);
} else if (command === "mcp") {
  const mcp = await createMcpServer({ root });
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
    for (const s of steps) console.log(`${values["dry-run"] ? "would " : ""}${s.action.padEnd(5)} ${s.file}${s.note ? `  (${s.note})` : ""}`);
    console.log(values["dry-run"] ? "Dry run: nothing written." : "Done. Restart the agent so it picks up the new MCP server and skill.");
  }
} else if (command === "serve" && file) {
  const server = await createPreviewServer({ root, port: values.port ? Number(values.port) : undefined, watch: true, warmup: true });
  const target = { file: path.resolve(root, file), exportName: values.export };
  let props = values.props ? JSON.parse(values.props) : undefined;
  if (values.usage) props = { ...(await findUsages(root, target.file, target.exportName)).find((u) => u.id === values.usage)?.props, ...props };
  console.log(`${server.url}${server.pageUrl({ ...target, props })}`);
  const stop = async () => { await server.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else if (command === "diff" && values.baseline && values.out) {
  const baseline = await loadCapture(values.baseline);
  const renderer = await createRenderer({ root });
  try {
    const result = await renderer.diff(renderer.restoreCapture(baseline));
    await saveDiff(values.out, result);
    console.log(values.json ? JSON.stringify(diffEvidence(result)) : `${result.status}: ${result.changedPercent.toFixed(2)}% changed pixels; evidence in ${values.out}`);
    process.exitCode = result.status === "incomplete" ? 1 : 0;
  } finally { await renderer.close(); }
} else if ((command === "shot" || command === "usages") && file) {
  const renderer = await createRenderer({ root });
  try {
    const target = { file: path.resolve(root, file), exportName: values.export };
    if (command === "usages") {
      console.log(JSON.stringify(await renderer.listUsages(target.file, target.exportName), null, 2));
    } else {
      const { width, height } = parseViewport(values.viewport);
      const result = await renderer.render({
        ...target,
        usage: values.usage,
        inContext: values["in-context"],
        frame: values.frame ? (([size, background]) => { const [width, height] = size.split("x").map(Number); return { width, height, background }; })(values.frame.split(":")) : undefined,
        props: values.props ? JSON.parse(values.props) : undefined,
        viewport: { width, height },
      });
      if (!["image", "summary", "both"].includes(values.output!)) throw new Error(`Unknown output "${values.output}"`);
      if (values["capture-dir"]) await saveCapture(values["capture-dir"], result);
      const out = values.out ?? `${path.parse(file).name}.png`;
      if (values.output !== "summary") await writeFile(out, result.png);
      if (values.json) console.log(JSON.stringify({ ...renderEvidence(result), ...(values.output !== "summary" ? { image: path.resolve(out) } : {}) }));
      else console.log(`${out} · ${result.ms} ms\nerrors: ${result.errors.length ? "\n- " + result.errors.join("\n- ") : "none"}\n${result.snapshot}`);
      process.exitCode = result.errors.length ? 1 : 0;
    }
  } finally {
    await renderer.close();
  }
} else {
  console.error(HELP);
  process.exitCode = 2;
}
