import path from "node:path";
import { VIEWPORTS, parseViewport } from "./viewports.js";
import { renderEvidence, diffEvidence } from "./renderEvidence.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRenderer, type Renderer, type RenderRequest, type RenderResult } from "./createRenderer.js";
import { inspectProject } from "../project/inspectProject.js";
import { audit } from "./audit.js";
import { packageVersion } from "../packageVersion.js";
import { FileAccessError } from "../server/createFileAccess.js";
import { toolOutputSchema, projectOutputSchema, renderOutputSchema, diffOutputSchema, propsOutputSchema, usagesOutputSchema, usageRendersOutputSchema, auditOutputSchema } from "./evidenceSchemas.js";

/** Sent to the agent when it connects: when to reach for these tools, so it uses them without being asked. */
const INSTRUCTIONS = `Arguseye shows you UI you cannot otherwise see: it renders React (incl. browser-compatible Next.js, React Router, Remix), Vue, Svelte, Preact and Solid components from source with project packages and supported layout, provider, style and font context. Missing inputs and runtime approximations remain explicit. No application server or authored stories are required.

Use it whenever you create or change a UI component, its styles or its props:
- Call inspect_project if setup or rendering fails: it checks the selected project and installed framework packages without starting a browser or executing project config.
- After the edit, call render_component on the file (pass usage from list_usages for real props). Read errors first, then the accessibility snapshot, then the image.
- Before saying a UI change is done, render it again and read \`changes\`; for a shared component, render_usages checks every call site.
- Use theme "dark" when the app has a dark mode, viewport "mobile" for responsive work, actions to open menus, dialogs or tabs.
- After a refactor or dependency upgrade, audit_components renders everything once and lists what broke.
Rendering runs trusted project code in a browser. Project code and actions can contact external services or change application state; rendering is not an offline sandbox. Missing context, sampled props and unsettled assets remain limitations even when pixels render.`;

/** Static inspection reads source without mounting project code or running component actions. */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
/** Rendering executes user code and handlers; these conservative hints do not enforce a network policy. */
const EXECUTES_CODE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;

/** Cap for render_usages so one call stays cheap on tokens. */
const MAX_USAGES = 12;

const target = {
  file: z.string().describe("Component file, relative to the project root or absolute"),
  export: z.string().optional().describe('Export to render; defaults to "default"'),
};
const output = z.enum(["image", "summary", "both"]).optional().describe("Return images, compact evidence, or both (default)");
const fixtureSchema = z.object({
  now: z.string().optional(), randomSeed: z.number().int().min(0).max(0xffffffff).optional(), locale: z.string().optional(), timezoneId: z.string().optional(),
  network: z.object({ policy: z.enum(["passthrough", "block-unmatched"]), responses: z.array(z.object({ url: z.string(), method: z.string().optional(), status: z.number().int().min(200).max(599).optional(), contentType: z.string().optional(), body: z.string() })).max(50) }).optional(),
}).optional().describe("Explicit time/random/browser/network inputs replayed in a fresh context. Timers and crypto randomness remain real. Exact path/URL mocks; block-unmatched rejects other application requests.");
const deadline = z.number().int().min(1).max(120000).optional().describe("Execution deadline in ms (default 30000); queued time is excluded");
const look = {
  output,
  viewport: z.string().optional().describe('"mobile", "tablet", "desktop" (default) or "WIDTHxHEIGHT"'),
  theme: z.enum(["light", "dark"]).optional().describe('Force a colour scheme: "dark" adds the dark class to <html>, sets color-scheme and emulates prefers-color-scheme; "light" removes the class. Default: the app as written'),
};

/** Exposes the headless renderer as MCP tools so a coding agent can see what it built in one call. */
export async function createMcpServer(options: { root: string; warmup?: boolean; buildMode?: "native" | "vite" }) {
  const root = path.resolve(options.root);
  let pendingRenderer: Promise<Renderer> | undefined;
  let staticRenderer: Promise<Renderer> | undefined;
  let previewUrl: string | undefined;
  let closed = false;
  const getRenderer = (warmup = options.warmup ?? true) => {
    if (closed) throw new Error("Arguseye session is closed");
    return pendingRenderer ??= createRenderer({ root, warmup, buildMode: options.buildMode }).then((renderer) => {
      previewUrl = renderer.server.url;
      return renderer;
    }).catch((error) => { pendingRenderer = undefined; throw error; });
  };
  const getStaticRenderer = () => options.buildMode === "vite" ? staticRenderer ??= createRenderer({ root, warmup: false }) : getRenderer(false);
  const server = new McpServer({ name: "arguseye", version: packageVersion }, { instructions: INSTRUCTIONS });
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
      request.theme && `${request.theme} theme`,
      `${result.ms} ms`,
      result.complete ? "complete" : "incomplete",
      result.captureId && `captureId: ${result.captureId}`,
    ].filter(Boolean);
    const errors = result.errors.length
      ? `errors:\n${result.errors.map((e) => `- ${tidy(e)}`).join("\n")}`
      : "errors: none";
    const logged = (result.console ?? []).map((l) => "console.error: " + tidy(l)).join("\n");
    return `${head.join(" · ")}\n${errors}\n${logged ? logged + "\n" : ""}${result.warnings.map((w) => "warning: " + w).join("\n")}${result.unresolved.length ? "\nunresolved: " + result.unresolved.join("; ") : ""}\n${result.snapshot}`;
  }

  /** Short stacks with project-relative paths instead of preview-server URLs. */
  function tidy(error: string): string {
    return error
      .split("\n")
      .slice(0, 6)
      .join("\n  ")
      .replaceAll(`${previewUrl ?? "arguseye:not-started"}/@fs`, "")
      .replace(/\?e=\d+(&v=\d+)?/g, "")
      .replaceAll(root + path.sep, "");
  }

  async function renderContent(request: RenderRequest, output = "both", control?: import("./createRenderer.js").RenderControl) {
    const result = await (await getRenderer()).render(request, control);
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
    structuredContent: { schemaVersion: 1, errors: [(error as Error).message], diagnostics: [{ code: error instanceof FileAccessError ? "ACCESS_DENIED" : "TOOL_FAILED", severity: "error", phase: "request", message: (error as Error).message }] },
  });

  server.registerTool("inspect_project", {
    annotations: READ_ONLY, outputSchema: toolOutputSchema(projectOutputSchema),
    description: "Diagnose the selected project before rendering: actual installed framework versions, native compiler limits and actionable missing-package/config diagnostics. Does not launch Chromium, execute project configuration or test full-app fidelity.",
    inputSchema: {},
  }, async () => {
    try {
      const report = inspectProject(root, options.buildMode);
      return { isError: report.errors.length > 0, structuredContent: report, content: [{ type: "text" as const, text: `${report.root}\n${report.packages.map((p) => `${p.name}: ${p.installed ?? "not installed"}`).join("\n")}\n${report.diagnostics.map((d) => `${d.code}: ${d.message} ${d.recovery}`).join("\n")}` }] };
    } catch (error) { return failure(error); }
  });

  server.registerTool(
    "render_component",
    {
      annotations: EXECUTES_CODE,
      outputSchema: toolOutputSchema(renderOutputSchema),
      description:
        "Inspect a UI edit using actual source, project packages and supported context, without starting the application: returns a cropped PNG, accessibility text and explicit completeness evidence. Pass `usage` (from list_usages) for discovered call-site props, or `props` as JSON; with neither, required props are sampled from the type (see describe_props). A successful mount does not establish full-app fidelity.",
      inputSchema: {
        ...target,
        usage: z.string().optional().describe('Usage id from list_usages, e.g. "app/page.tsx:9"'),
        in_context: z.boolean().optional().describe("With usage: render inside the call site's JSX ancestors, so the parent's size, layout and background apply (the capture is the parent box)"),
        frame: z.object({ width: z.number(), height: z.number(), background: z.string().optional(), padding: z.number().optional() }).optional().describe("Render inside a stand-in parent box of this size and background"),
        actions: z.array(z.record(z.string(), z.unknown())).optional().describe('Steps before capture, e.g. [{"click":{"role":"button","name":"Open"}},{"fill":{"label":"Email"},"value":"a@b.c"},{"hover":{"text":"Save"}},{"press":"Enter"},{"wait":300}]. Targets: role+name, text, label, placeholder, testId, selector.'),
        storage: z.object({ local: z.record(z.string(), z.string()).optional(), session: z.record(z.string(), z.string()).optional() }).optional().describe("localStorage/sessionStorage seeded before mount (auth tokens, flags); cleared after"),
        fixtures: fixtureSchema, timeoutMs: deadline,
        props: z.record(z.string(), z.unknown()).optional().describe("Props to render with (merged over the usage's props)"),
        ...look,
      },
    },
    async (args, extra) => {
      try {
        const request = { file: abs(args.file), exportName: args.export, usage: args.usage, inContext: args.in_context, frame: args.frame, actions: args.actions as any, storage: args.storage, fixtures: args.fixtures, props: args.props, viewport: viewport(args.viewport), theme: args.theme };
        const { result, content } = await renderContent(request, args.output, { signal: extra.signal, timeoutMs: args.timeoutMs });
        return { isError: result.errors.length > 0, content, structuredContent: renderEvidence(result) };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool("render_diff", {
    annotations: EXECUTES_CODE,
    outputSchema: toolOutputSchema(diffOutputSchema),
    description: "Compare current source against an immutable captureId returned by render_component. Reuses the original resolved props and viewport; changed pixels are evidence, not a correctness verdict.",
    inputSchema: { baselineId: z.string(), output, timeoutMs: deadline },
  }, async (args, extra) => {
    try {
      const result = await (await getRenderer()).diff(args.baselineId, { signal: extra.signal, timeoutMs: args.timeoutMs });
      const content = [
        ...(args.output === "summary" ? [] : [result.before.png, result.after.png, result.diffPng].map((png) => ({ type: "image" as const, data: png.toString("base64"), mimeType: "image/png" }))),
        ...(args.output === "image" ? [] : [{ type: "text" as const, text: `${result.status}: ${result.changedPercent.toFixed(2)}% changed pixels${result.changedRegion ? ` in ${result.changedRegion.width}x${result.changedRegion.height} at ${result.changedRegion.x},${result.changedRegion.y}` : ""}; accessibility changed: ${result.snapshotChanged}\nbaselineId: ${args.baselineId}; captureId: ${result.after.captureId ?? "none"}\ncontext: before ${result.before.complete ? "complete" : "incomplete"}, after ${result.after.complete ? "complete" : "incomplete"}\n${result.after.warnings.join("\n")}\n${result.resolvedWarnings.map((w) => "resolved warning: " + w).join("\n")}\n${result.newErrors.join("\n")}` }]),
      ];
      return { isError: result.after.errors.length > 0, content, structuredContent: diffEvidence(result) };
    } catch (error) { return failure(error); }
  });

  server.registerTool(
    "describe_props",
    {
      annotations: READ_ONLY,
      outputSchema: toolOutputSchema(propsOutputSchema),
      description:
        "What props a component accepts, read from its TypeScript type: name, kind (string, number, boolean, enum with options, array, object with fields, function, node), required, default, description. Includes `sample`, the props render_component uses when you pass none.",
      inputSchema: target,
    },
    async (args) => {
      try {
        const schema = await (await getStaticRenderer()).describeProps(abs(args.file), args.export);
        return { content: [{ type: "text" as const, text: JSON.stringify(schema, null, 1) }], structuredContent: { schemaVersion: 1 as const, errors: [], ...schema } };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "list_usages",
    {
      annotations: READ_ONLY,
      outputSchema: toolOutputSchema(usagesOutputSchema),
      description: "List every place a component is used in the project, with the literal props each call site passes (and the ones that depend on runtime values).",
      inputSchema: target,
    },
    async (args) => {
      try {
        const usages = await (await getStaticRenderer()).listUsages(abs(args.file), args.export);
        return { content: [{ type: "text" as const, text: JSON.stringify(usages, null, 1) }], structuredContent: { schemaVersion: 1 as const, errors: [], usages } };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "render_usages",
    {
      annotations: EXECUTES_CODE,
      outputSchema: toolOutputSchema(usageRendersOutputSchema),
      description: `After changing a component, render it at every place it is used (up to ${MAX_USAGES}) with each call site's real props, to inspect isolated literal-prop variants. These are not full-page integration tests.`,
      inputSchema: { ...target, ...look, timeoutMs: deadline, cursor: z.string().optional(), limit: z.number().int().min(1).max(MAX_USAGES).optional() },
    },
    async (args, extra) => {
      try {
        const file = abs(args.file);
        if (args.cursor && !/^\d+$/.test(args.cursor)) throw new Error(`Invalid usage cursor "${args.cursor}"`);
        const page = await (await getRenderer()).renderUsages({ file, exportName: args.export, viewport: viewport(args.viewport), theme: args.theme, offset: Number(args.cursor ?? 0), limit: args.limit }, { signal: extra.signal, timeoutMs: args.timeoutMs });
        const content = page.results.flatMap((result) => [
          ...(args.output === "summary" ? [] : [{ type: "image" as const, data: result.png.toString("base64"), mimeType: "image/png" }]),
          ...(args.output === "image" ? [] : [{ type: "text" as const, text: describe({ ...result.target, usage: result.usage, viewport: result.viewport }, result) }]),
        ]);
        if (!page.total) content.push({ type: "text", text: "No usages found in the project." });
        if (page.nextOffset !== null) content.push({ type: "text", text: `${page.total - page.nextOffset} more usages; continue with cursor ${page.nextOffset}` });
        return { isError: page.results.some((r) => r.errors.length > 0), content, structuredContent: { schemaVersion: 1 as const, errors: page.results.flatMap((r) => r.errors), results: page.results.map((r) => ({ ...renderEvidence(r), usage: r.usage })), total: page.total, nextCursor: page.nextOffset === null ? null : String(page.nextOffset), coverage: "Isolated component renders with discovered literal props; surrounding pages are not exercised." } };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "audit_components",
    {
      annotations: EXECUTES_CODE,
      outputSchema: toolOutputSchema(auditOutputSchema),
      description: "Render every component in the project (or a folder) once with sample props and report which render, which throw and which come out empty. Use after a refactor, a dependency upgrade or a shared-style change, or to get to know a new codebase's UI. Text only; render_component shows any one of them.",
      inputSchema: { cursor: z.string().optional().describe("Continuation from a previous bounded audit of the same unchanged source"), dir: z.string().optional().describe("Folder to audit, relative to the project root; default the whole project"), limit: z.number().int().min(1).max(500).optional().describe("Most components to render (default 200)") },
    },
    async (args, extra) => {
      try {
        const report = await audit(await getRenderer(), root, args.dir ? abs(args.dir) : root, { limit: args.limit ?? 200, cursor: args.cursor, signal: extra.signal });
        const lines = report.entries.filter((e) => e.status !== "ok").map((e) => `${e.status} ${e.file}${e.export && e.export !== "default" ? "#" + e.export : ""}${e.errors ? ": " + tidy(e.errors[0]) : ""}`);
        const text = `${report.nextCursor ? `Continue with cursor ${report.nextCursor}\n` : ""}${report.cancelled ? "Audit cancelled; completed entries preserved.\n" : ""}${report.total} components: ${report.ok} ok, ${report.error} with errors, ${report.empty} empty, ${report.skipped} skipped\n${lines.join("\n")}`;
        return { isError: report.error > 0, content: [{ type: "text" as const, text }], structuredContent: { schemaVersion: 1 as const, errors: report.topErrors.map((e) => e.message), ...report } };
      } catch (error) {
        return failure(error);
      }
    },
  );

  return {
    server,
    async close() {
      closed = true;
      await server.close();
      await staticRenderer?.then((renderer) => renderer.close(), () => {});
      await pendingRenderer?.then((renderer) => renderer.close(), () => {});
    },
  };
}
