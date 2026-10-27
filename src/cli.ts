import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRenderer } from "./agent/createRenderer.js";
import { createMcpServer } from "./agent/mcpServer.js";

const HELP = `component-preview: see any React component exactly as it looks in your app, no dev server

  component-preview mcp [--root DIR]
      MCP server on stdio for coding agents (render_component, list_usages, render_usages)

  component-preview shot FILE [--export NAME] [--usage ID] [--props JSON] [--viewport WxH] [--out FILE.png] [--root DIR]
      Render once: writes a PNG and prints the accessibility snapshot and errors

  component-preview usages FILE [--export NAME] [--root DIR]
      Print every usage of a component with its real props (JSON)`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string", default: process.cwd() },
    export: { type: "string" },
    usage: { type: "string" },
    props: { type: "string" },
    viewport: { type: "string" },
    out: { type: "string" },
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
} else if ((command === "shot" || command === "usages") && file) {
  const renderer = await createRenderer({ root });
  try {
    const target = { file: path.resolve(root, file), exportName: values.export };
    if (command === "usages") {
      console.log(JSON.stringify(await renderer.listUsages(target.file, target.exportName), null, 2));
    } else {
      const [width, height] = (values.viewport ?? "1280x800").split("x").map(Number);
      const result = await renderer.render({
        ...target,
        usage: values.usage,
        props: values.props ? JSON.parse(values.props) : undefined,
        viewport: { width, height },
      });
      const out = values.out ?? `${path.parse(file).name}.png`;
      await writeFile(out, result.png);
      console.log(`${out} · ${result.ms} ms\nerrors: ${result.errors.length ? "\n- " + result.errors.join("\n- ") : "none"}\n${result.snapshot}`);
      process.exitCode = result.errors.length ? 1 : 0;
    }
  } finally {
    await renderer.close();
  }
} else {
  console.error(HELP);
  process.exitCode = 2;
}
