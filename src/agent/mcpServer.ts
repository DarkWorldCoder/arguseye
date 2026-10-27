import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRenderer, type RenderRequest, type RenderResult } from "./createRenderer.js";

const VIEWPORTS: Record<string, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1280, height: 800 },
};
/** Cap for render_usages so one call stays cheap on tokens. */
const MAX_USAGES = 12;

const target = {
  file: z.string().describe("Component file, relative to the project root or absolute"),
  export: z.string().optional().describe('Export to render; defaults to "default"'),
};
const look = {
  viewport: z.string().optional().describe('"mobile", "tablet", "desktop" (default) or "WIDTHxHEIGHT"'),
};

/** Exposes the headless renderer as MCP tools so a coding agent can see what it built in one call. */
export async function createMcpServer(options: { root: string }) {
  const root = path.resolve(options.root);
  const renderer = await createRenderer({ root });
  const server = new McpServer({ name: "component-preview", version: "0.0.1" });
  const abs = (file: string) => path.resolve(root, file);
  const rel = (file: string) => path.relative(root, file);

  function viewport(value: string | undefined) {
    if (!value) return undefined;
    if (VIEWPORTS[value]) return VIEWPORTS[value];
    const [width, height] = value.split("x").map(Number);
    if (!width || !height) throw new Error(`Unknown viewport "${value}"`);
    return { width, height };
  }

  /** One line of context, the errors, then the accessibility snapshot. */
  function describe(request: RenderRequest, result: RenderResult): string {
    const size = request.viewport ?? VIEWPORTS.desktop;
    const head = [
      request.exportName ?? "default",
      rel(request.file),
      request.usage ? `usage ${request.usage}` : undefined,
      `${size.width}x${size.height}`,
      `${result.ms} ms`,
    ].filter(Boolean);
    const errors = result.errors.length
      ? `errors:\n${result.errors.map((e) => `- ${tidy(e)}`).join("\n")}`
      : "errors: none";
    return `${head.join(" · ")}\n${errors}\n${result.snapshot}`;
  }

  /** Short stacks with project-relative paths instead of preview-server URLs. */
  function tidy(error: string): string {
    return error
      .split("\n")
      .slice(0, 6)
      .join("\n  ")
      .replaceAll(`${renderer.server.url}/@fs`, "")
      .replace(/\?e=\d+(&v=\d+)?/g, "")
      .replaceAll(root + path.sep, "");
  }

  async function renderContent(request: RenderRequest) {
    const result = await renderer.render(request);
    return {
      result,
      content: [
        { type: "image" as const, data: result.png.toString("base64"), mimeType: "image/png" },
        { type: "text" as const, text: describe(request, result) },
      ],
    };
  }

  const failure = (error: unknown) => ({
    isError: true,
    content: [{ type: "text" as const, text: `error: ${(error as Error).message}` }],
  });

  server.registerTool(
    "render_component",
    {
      description:
        "See a component exactly as it looks in the app, without a dev server: returns a PNG cropped to the component and its accessibility tree. Pass `usage` (from list_usages) to use the props from a real call site, or `props` as JSON.",
      inputSchema: {
        ...target,
        usage: z.string().optional().describe('Usage id from list_usages, e.g. "app/page.tsx:9"'),
        props: z.record(z.string(), z.unknown()).optional().describe("Props to render with (merged over the usage's props)"),
        ...look,
      },
    },
    async (args) => {
      try {
        const request = { file: abs(args.file), exportName: args.export, usage: args.usage, props: args.props, viewport: viewport(args.viewport) };
        const { result, content } = await renderContent(request);
        return { isError: result.errors.length > 0, content };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "list_usages",
    {
      description: "List every place a component is used in the project, with the literal props each call site passes (and the ones that depend on runtime values).",
      inputSchema: target,
    },
    async (args) => {
      try {
        const usages = await renderer.listUsages(abs(args.file), args.export);
        return { content: [{ type: "text" as const, text: JSON.stringify(usages, null, 1) }] };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "render_usages",
    {
      description: `After changing a component, render it at every place it is used (up to ${MAX_USAGES}) with each call site's real props, to see the blast radius in one call.`,
      inputSchema: { ...target, ...look },
    },
    async (args) => {
      try {
        const file = abs(args.file);
        const usages = await renderer.listUsages(file, args.export);
        const content = [];
        let failed = false;
        for (const usage of usages.slice(0, MAX_USAGES)) {
          const rendered = await renderContent({ file, exportName: args.export, usage: usage.id, viewport: viewport(args.viewport) });
          failed ||= rendered.result.errors.length > 0;
          content.push(...rendered.content);
        }
        if (usages.length > MAX_USAGES) content.push({ type: "text" as const, text: `${usages.length - MAX_USAGES} more usages not rendered` });
        if (!usages.length) content.push({ type: "text" as const, text: "No usages found in the project." });
        return { isError: failed, content };
      } catch (error) {
        return failure(error);
      }
    },
  );

  return {
    server,
    async close() {
      await server.close();
      await renderer.close();
    },
  };
}
