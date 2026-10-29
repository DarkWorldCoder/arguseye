import path from "node:path";
import { VIEWPORTS, parseViewport } from "./viewports.js";
import { renderEvidence, diffEvidence } from "./renderEvidence.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRenderer, type RenderRequest, type RenderResult } from "./createRenderer.js";

/** Cap for render_usages so one call stays cheap on tokens. */
const MAX_USAGES = 12;

const target = {
  file: z.string().describe("Component file, relative to the project root or absolute"),
  export: z.string().optional().describe('Export to render; defaults to "default"'),
};
const output = z.enum(["image", "summary", "both"]).optional().describe("Return images, compact evidence, or both (default)");
const look = {
  output,
  viewport: z.string().optional().describe('"mobile", "tablet", "desktop" (default) or "WIDTHxHEIGHT"'),
};

/** Exposes the headless renderer as MCP tools so a coding agent can see what it built in one call. */
export async function createMcpServer(options: { root: string; warmup?: boolean }) {
  const root = path.resolve(options.root);
  const renderer = await createRenderer({ root, warmup: options.warmup ?? true });
  const server = new McpServer({ name: "arguseye", version: "0.0.1" });
  const abs = (file: string) => path.resolve(root, file);
  const rel = (file: string) => path.relative(root, file);

  const viewport = (value: string | undefined) => parseViewport(value);

  /** One line of context, the errors, then the accessibility snapshot. */
  function describe(request: RenderRequest, result: RenderResult): string {
    const size = request.viewport ?? VIEWPORTS.desktop;
    const head = [
      request.exportName ?? "default",
      rel(request.file),
      request.usage ? `usage ${request.usage}` : `props: ${result.propsSource}`,
      `${size.width}x${size.height}`,
      `${result.ms} ms`,
    ].filter(Boolean);
    const errors = result.errors.length
      ? `errors:\n${result.errors.map((e) => `- ${tidy(e)}`).join("\n")}`
      : "errors: none";
    return `${head.join(" · ")}\n${errors}\n${result.warnings.map((w) => "warning: " + w).join("\n")}\n${result.snapshot}`;
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

  async function renderContent(request: RenderRequest, output = "both") {
    const result = await renderer.render(request);
    return {
      result,
      content: [
        ...(output === "summary" ? [] : [{ type: "image" as const, data: result.png.toString("base64"), mimeType: "image/png" }]),
        ...(output === "image" ? [] : [{ type: "text" as const, text: describe(request, result) }]),
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
        "See a component exactly as it looks in the app, without a dev server: returns a PNG cropped to the component and its accessibility tree. Pass `usage` (from list_usages) to use the props from a real call site, or `props` as JSON; with neither, required props are filled with samples from the TypeScript type (see describe_props).",
      inputSchema: {
        ...target,
        usage: z.string().optional().describe('Usage id from list_usages, e.g. "app/page.tsx:9"'),
        in_context: z.boolean().optional().describe("With usage: render inside the call site's JSX ancestors, so the parent's size, layout and background apply (the capture is the parent box)"),
        frame: z.object({ width: z.number(), height: z.number(), background: z.string().optional(), padding: z.number().optional() }).optional().describe("Render inside a stand-in parent box of this size and background"),
        actions: z.array(z.record(z.string(), z.unknown())).optional().describe('Steps before capture, e.g. [{"click":{"role":"button","name":"Open"}},{"fill":{"label":"Email"},"value":"a@b.c"},{"hover":{"text":"Save"}},{"press":"Enter"},{"wait":300}]. Targets: role+name, text, label, placeholder, testId, selector.'),
        storage: z.object({ local: z.record(z.string(), z.string()).optional(), session: z.record(z.string(), z.string()).optional() }).optional().describe("localStorage/sessionStorage seeded before mount (auth tokens, flags); cleared after"),
        props: z.record(z.string(), z.unknown()).optional().describe("Props to render with (merged over the usage's props)"),
        ...look,
      },
    },
    async (args) => {
      try {
        const request = { file: abs(args.file), exportName: args.export, usage: args.usage, inContext: args.in_context, frame: args.frame, actions: args.actions as any, storage: args.storage, props: args.props, viewport: viewport(args.viewport) };
        const { result, content } = await renderContent(request, args.output);
        return { isError: result.errors.length > 0, content, structuredContent: renderEvidence(result) };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool("render_diff", {
    description: "Compare current source against an immutable captureId returned by render_component. Reuses the original resolved props and viewport; changed pixels are evidence, not a correctness verdict.",
    inputSchema: { baselineId: z.string(), output },
  }, async (args) => {
    try {
      const result = await renderer.diff(args.baselineId);
      const content = [
        ...(args.output === "summary" ? [] : [result.before.png, result.after.png, result.diffPng].map((png) => ({ type: "image" as const, data: png.toString("base64"), mimeType: "image/png" }))),
        ...(args.output === "image" ? [] : [{ type: "text" as const, text: `${result.status}: ${result.changedPercent.toFixed(2)}% changed pixels; accessibility changed: ${result.snapshotChanged}\n${result.after.warnings.join("\n")}\n${result.newErrors.join("\n")}` }]),
      ];
      return { isError: result.after.errors.length > 0, content, structuredContent: diffEvidence(result) };
    } catch (error) { return failure(error); }
  });

  server.registerTool(
    "describe_props",
    {
      description:
        "What props a component accepts, read from its TypeScript type: name, kind (string, number, boolean, enum with options, array, object with fields, function, node), required, default, description. Includes `sample`, the props render_component uses when you pass none.",
      inputSchema: target,
    },
    async (args) => {
      try {
        const schema = await renderer.describeProps(abs(args.file), args.export);
        return { content: [{ type: "text" as const, text: JSON.stringify(schema, null, 1) }] };
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
      description: `After changing a component, render it at every place it is used (up to ${MAX_USAGES}) with each call site's real props, to inspect isolated literal-prop variants. These are not full-page integration tests.`,
      inputSchema: { ...target, ...look, cursor: z.string().optional(), limit: z.number().int().min(1).max(MAX_USAGES).optional() },
    },
    async (args) => {
      try {
        const file = abs(args.file);
        if (args.cursor && !/^\d+$/.test(args.cursor)) throw new Error(`Invalid usage cursor "${args.cursor}"`);
        const page = await renderer.renderUsages({ file, exportName: args.export, viewport: viewport(args.viewport), offset: Number(args.cursor ?? 0), limit: args.limit });
        const content = page.results.flatMap((result) => [
          ...(args.output === "summary" ? [] : [{ type: "image" as const, data: result.png.toString("base64"), mimeType: "image/png" }]),
          ...(args.output === "image" ? [] : [{ type: "text" as const, text: describe({ ...result.target, usage: result.usage, viewport: result.viewport }, result) }]),
        ]);
        if (!page.total) content.push({ type: "text", text: "No usages found in the project." });
        if (page.nextOffset !== null) content.push({ type: "text", text: `${page.total - page.nextOffset} more usages; continue with cursor ${page.nextOffset}` });
        return { isError: page.results.some((r) => r.errors.length > 0), content, structuredContent: { results: page.results.map((r) => ({ ...renderEvidence(r), usage: r.usage })), total: page.total, nextCursor: page.nextOffset === null ? null : String(page.nextOffset), coverage: "Isolated component renders with discovered literal props; surrounding pages are not exercised." } };
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
