import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync, symlinkSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../src/agent/mcpServer.js";

const root = path.resolve("test/fixtures/react-app");
let client: Client;
let close: () => Promise<void>;

beforeAll(async () => {
  const mcp = await createMcpServer({ root });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.server.connect(serverSide);
  client = new Client({ name: "test-agent", version: "0" });
  await client.connect(clientSide);
  close = async () => { await client.close(); await mcp.close(); };
});
afterAll(async () => close?.());

type Content = Array<{ type: string; text?: string; data?: string; mimeType?: string }>;

it("exports and replays regression checks with explicit failed outcomes in text and structured evidence", async () => {
  const rendered = await client.callTool({ name: "render_component", arguments: {
    file: "components/VerificationPanel.tsx", export: "VerificationPanel", props: {}, output: "summary",
    expectations: [{ target: { role: "button", name: "Save", exact: true }, state: "count", value: 3, timeoutMs: 20 }],
  } });
  expect(rendered.isError).toBe(true);
  expect((rendered.structuredContent as any).errors).toEqual([]);
  expect((rendered.content as Content)[0].text).toContain("1 failed");
  const saved = await client.callTool({ name: "capture_recipe", arguments: { captureId: (rendered.structuredContent as any).captureId } });
  expect(saved.isError).toBeFalsy();
  const replay = await client.callTool({ name: "render_recipe", arguments: { recipe: (saved.structuredContent as any).recipe, output: "summary" } });
  expect(replay.isError).toBe(true);
  expect((replay.structuredContent as any).expectations[0].status).toBe("failed");
  expect((replay.content as Content)[0].text).toContain("1 failed");
});

it("reports real render phases when the client requests progress", async () => {
  const progress: Array<{ progress: number; message?: string }> = [];
  const result = await client.callTool({ name: "render_component", arguments: { file: "components/ProductCard.tsx", export: "ProductCard", props: { title: "Progress", price: 3 }, output: "summary", capturePolicy: { scroll: {} }, inspection: { layout: true, fonts: true } } }, undefined, { onprogress: (event) => { progress.push(event); } });
  expect(result.isError).toBeFalsy();
  expect(progress.map((event) => event.message)).toEqual(expect.arrayContaining(["Reading component", "Rendering preview", "Checking fonts and images", "Capturing preview"]));
  expect(progress.every((event, i) => i === 0 || event.progress > progress[i - 1].progress)).toBe(true);
  expect((result.structuredContent as any).scrollCapture).toMatchObject({ complete: true, restored: true });
  expect((result.structuredContent as any).elements.some((element: any) => element.font?.status === "available" && element.bounds?.width > 0)).toBe(true);
});

it("distinguishes a successful audit mount from complete render evidence", async () => {
  const result = await client.callTool({ name: "audit_components", arguments: { dir: "audit-cases" } });
  const report = result.structuredContent as any;
  expect(result.isError).toBeFalsy();
  expect(report).toMatchObject({ total: 2, ok: 2, complete: 1, incomplete: 1 });
  expect(report.entries.find((entry: any) => entry.file.endsWith("Complete.tsx"))).toMatchObject({ status: "ok", complete: true, unresolved: [] });
  const sampled = report.entries.find((entry: any) => entry.file.endsWith("Sampled.tsx"));
  expect(sampled).toMatchObject({ status: "ok", complete: false, unresolved: [] });
  expect(sampled.warnings.join()).toContain("Sample props were generated from types");
  expect((result.content as Content).find((block) => block.type === "text")?.text).toContain("1 complete, 1 incomplete");
});

it("continues a bounded audit without repeating components and rejects malformed cursors", async () => {
  const first = await client.callTool({ name: "audit_components", arguments: { dir: "components", limit: 1 } });
  const a = first.structuredContent as any;
  expect(a.total).toBe(1);
  expect(a.nextCursor).toEqual(expect.any(String));
  const next = await client.callTool({ name: "audit_components", arguments: { dir: "components", limit: 1, cursor: a.nextCursor } });
  const b = next.structuredContent as any;
  expect(b.total).toBe(1);
  expect(b.entries[0].file).not.toBe(a.entries[0].file);
  expect(b.available).toBe(a.available);
  const bad = await client.callTool({ name: "audit_components", arguments: { cursor: "not-a-cursor" } });
  expect(bad.isError).toBe(true);
  expect((bad.structuredContent as any).errors.join()).toMatch(/audit cursor/i);
});

describe("MCP tools (what a coding agent calls)", () => {
  it("offers render, usage and blast-radius tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["audit_components", "capture_recipe", "describe_props", "inspect_project", "list_usages", "render_component", "render_diff", "render_recipe", "render_usages"]);
  });

  it("distinguishes static inspection from rendering project code with possible external effects", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const staticTool = ["capture_recipe", "describe_props", "list_usages", "inspect_project"].includes(tool.name);
      expect(tool.annotations, tool.name).toMatchObject({ readOnlyHint: staticTool, idempotentHint: staticTool, destructiveHint: !staticTool, openWorldHint: !staticTool });
    }
  });

  it("announces the installed package version and versioned output schemas", async () => {
    expect(client.getServerVersion()?.version).toBe(JSON.parse(readFileSync(path.resolve("package.json"), "utf8")).version);
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.outputSchema?.type, tool.name).toBe("object");
      expect((tool.outputSchema?.properties as any)?.schemaVersion.const, tool.name).toBe(1);
      expect(tool.outputSchema?.required, tool.name).toContain("errors");
    }
  });

  it("inspects actual project packages without claiming a browser mount", async () => {
    const result = await client.callTool({ name: "inspect_project", arguments: {} });
    const evidence = result.structuredContent as any;
    expect(result.isError).toBeFalsy();
    expect(evidence.root).toBe(root);
    expect(evidence.packages.find((p: any) => p.name === "react").installed).toBe(JSON.parse(readFileSync(path.join(root, "node_modules/react/package.json"), "utf8")).version);
    expect(evidence.build.mode).toBe("native");
    expect(evidence.build.executesVitePlugins).toBe(false);
    expect(evidence.browser.probed).toBe(false);
  });

  it("offers recovery diagnostics before browser startup and never executes project config", async () => {
    const broken = mkdtempSync(path.join(os.tmpdir(), "arguseye-doctor-"));
    writeFileSync(path.join(broken, "package.json"), JSON.stringify({ dependencies: { vue: "3.5.13", vite: "6.0.0" } }));
    writeFileSync(path.join(broken, "vite.config.ts"), 'throw new Error("PROJECT CONFIG MUST NOT RUN"); export default {};');
    let mcp: Awaited<ReturnType<typeof createMcpServer>> | undefined;
    let inspector: Client | undefined;
    try {
      mcp = await createMcpServer({ root: broken });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await mcp.server.connect(b);
      inspector = new Client({ name: "doctor-test", version: "0" });
      await inspector.connect(a);
      const result = await inspector.callTool({ name: "inspect_project", arguments: {} });
      const evidence = result.structuredContent as any;
      expect(result.isError).toBe(true);
      expect(evidence.root).toBe(broken);
      expect(evidence.packages.find((p: any) => p.name === "vue").installed).toBeNull();
      expect(evidence.diagnostics).toContainEqual(expect.objectContaining({ code: "PACKAGE_NOT_INSTALLED", recovery: expect.stringContaining("Install") }));
      expect(evidence.diagnostics).toContainEqual(expect.objectContaining({ code: "VITE_PLUGINS_NOT_EXECUTED" }));
      expect(evidence.browser.probed).toBe(false);
    } finally {
      await inspector?.close(); await mcp?.close(); rmSync(broken, { recursive: true, force: true });
    }
  });

  it.each(["native", "vite"] as const)("does not speculatively mount the app or execute its CSS config for static prop inspection in %s mode", async (buildMode) => {
    const isolated = mkdtempSync(path.join(os.tmpdir(), "arguseye-static-effects-"));
    const canary = path.join(isolated, "config-executed");
    writeFileSync(path.join(isolated, "package.json"), JSON.stringify({ dependencies: { react: "19.2.0", "react-dom": "19.2.0", postcss: "8.5.0" } }));
    symlinkSync(path.resolve("test/fixtures/tw3-app/node_modules"), path.join(isolated, "node_modules"), "junction");
    writeFileSync(path.join(isolated, "Card.tsx"), 'export default function Card({title}: {title: string}) {return <h1>{title}</h1>}');
    writeFileSync(path.join(isolated, "postcss.config.cjs"), `require("node:fs").writeFileSync(${JSON.stringify(canary)}, "executed"); module.exports={plugins:{}};`);
    // app/layout is an inferred entry; its global CSS would execute PostCSS on a speculative warm page.
    mkdirSync(path.join(isolated, "app"));
    writeFileSync(path.join(isolated, "app/layout.tsx"), 'import "./global.css"; export default function Layout({children}) {return <main>{children}</main>}');
    writeFileSync(path.join(isolated, "app/global.css"), 'h1 {color: red}');
    const mcp = await createMcpServer({ root: isolated, buildMode });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const inspector = new Client({ name: "static-effects-test", version: "0" });
    try {
      await mcp.server.connect(b); await inspector.connect(a);
      expect((await inspector.callTool({ name: "list_usages", arguments: { file: "Card.tsx" } })).isError).toBeFalsy();
      const result = await inspector.callTool({ name: "describe_props", arguments: { file: "Card.tsx" } });
      expect((result.structuredContent as any).sample).toEqual({ title: "Title" });
      await delay(3000);
      expect(existsSync(canary)).toBe(false);
    } finally { await inspector.close(); await mcp.close(); rmSync(isolated, { recursive: true, force: true }); }
  });

  it("tells a connecting agent when to use it, without being asked", () => {
    const instructions = client.getInstructions()!;
    expect(instructions).toMatch(/whenever you create or change a UI component/);
    expect(instructions).toContain("render_component");
  });

  it("audit_components renders a folder once and lists what is not ok", async () => {
    const result = await client.callTool({ name: "audit_components", arguments: { dir: "components", limit: 50 } });
    const report = result.structuredContent as any;
    expect(report.total).toBeGreaterThan(0);
    expect(report.ok).toBeGreaterThan(0);
    expect((result.content as Content)[0].text).toMatch(/^\d+ components: \d+ mounted/);
  });

  it("render_component returns a PNG and a compact text snapshot for a real usage, by project-relative path", async () => {
    const result = await client.callTool({
      name: "render_component",
      arguments: { file: "components/ProductCard.tsx", export: "ProductCard", usage: "app/page.tsx:9" },
    });
    const content = result.content as Content;

    expect(result.isError).toBeFalsy();
    expect(content[0]).toMatchObject({ type: "image", mimeType: "image/png" });
    expect((result.structuredContent as any).environment.reducedMotion).toBe("reduce");
    expect(Buffer.from(content[0].data!, "base64").subarray(1, 4).toString()).toBe("PNG");
    const text = content[1].text!;
    expect(text).toContain("ProductCard · components/ProductCard.tsx · usage app/page.tsx:9");
    expect(text).toContain("errors: none");
    expect(text).toContain('heading "Wireless Headphones"');
  });

  it("list_usages returns each usage id with its real props", async () => {
    const result = await client.callTool({ name: "list_usages", arguments: { file: "components/ProductCard.tsx", export: "ProductCard" } });
    const usages = JSON.parse((result.content as Content)[0].text!).map(({ id, props, unresolved }: any) => ({ id, props, unresolved }));
    expect(usages.map((u: { id: string }) => u.id)).toEqual(["app/deals/page.tsx:7", "app/page.tsx:9", "app/page.tsx:10", "app/shop/page.tsx:7"]);
  });

  it("render_usages renders the component at every place it is used, in one call", async () => {
    const result = await client.callTool({ name: "render_usages", arguments: { file: "components/ProductCard.tsx", export: "ProductCard" } });
    const content = result.content as Content;

    expect(content.filter((c) => c.type === "image")).toHaveLength(4);
    const texts = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    expect(texts).toContain("usage app/page.tsx:9");
    expect(texts).toContain('heading "USB-C Cable"');
  });

  it("reports render errors as readable results, not crashes", async () => {
    const result = await client.callTool({ name: "render_component", arguments: { file: "components/ProductCard.tsx", export: "Missing" } });
    const text = (result.content as Content).find((c) => c.type === "text")!.text!;
    expect(result.isError).toBe(true);
    expect(text).toContain('No component export "Missing"');
    expect((result.structuredContent as any).schemaVersion).toBe(1);
    expect((result.structuredContent as any).errors[0]).toContain('No component export "Missing"');
  });

  it("returns an actionable structured boundary error for outside source inspection", async () => {
    const result = await client.callTool({ name: "describe_props", arguments: { file: "../outside.tsx" } });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as any).errors[0]).toContain("outside.tsx");
    expect((result.structuredContent as any).diagnostics[0].code).toBe("ACCESS_DENIED");
  });

  it("describe_props tells an agent what a component accepts, from its TypeScript type", async () => {
    const result = await client.callTool({ name: "describe_props", arguments: { file: "components/Alert.tsx", export: "Alert" } });
    const schema = JSON.parse((result.content as Content)[0].text!);
    expect(schema.props.map((p: { name: string; kind: string; required: boolean }) => `${p.name}${p.required ? "" : "?"}:${p.kind}`)).toEqual([
      "title:string", "tone?:enum", "count?:number", "dismissible?:boolean", "tags?:array", "action?:object", "onClose?:function", "children?:node",
    ]);
    expect(schema.props[1].options).toEqual(["info", "success", "danger"]);
    expect(schema.sample).toEqual({ title: "Title" });
  });

  it("render_component with no props and no usage fills the required props from the type", async () => {
    const result = await client.callTool({ name: "render_component", arguments: { file: "components/Alert.tsx", export: "Alert" } });
    const text = (result.content as Content)[1].text!;
    expect(result.isError).toBeFalsy();
    expect(text).toContain("errors: none");
    expect(text).toContain("Title");
    expect(text).toContain("props: sample");
  });
});

it("returns structured evidence without images when summary output is requested", async () => {
  const result = await client.callTool({ name: "render_component", arguments: { file: "components/ProductCard.tsx", export: "ProductCard", usage: "app/page.tsx:9", output: "summary" } });
  expect((result.content as Content).some((c) => c.type === "image")).toBe(false);
  const evidence = result.structuredContent as any;
  expect(evidence.schemaVersion).toBe(1);
  expect(evidence.captureId).toBeTruthy();
  expect((result.content as Content).find((c) => c.type === "text")?.text).toContain(evidence.captureId);
  expect(evidence.target.props.title).toBe("Wireless Headphones");
  expect(evidence.errors).toEqual([]);
  const diff = await client.callTool({ name: "render_diff", arguments: { baselineId: evidence.captureId, output: "summary" } });
  expect((diff.structuredContent as any).status).toBe("unchanged");
  expect((diff.content as Content).some((c) => c.type === "image")).toBe(false);
});

it("paginates usage renders and returns structured per-usage evidence", async () => {
  const args = { file: "components/ProductCard.tsx", export: "ProductCard", output: "summary", limit: 1 };
  const first = await client.callTool({ name: "render_usages", arguments: args });
  const page = first.structuredContent as any;
  expect(page.total).toBe(4);
  expect(page.results).toHaveLength(1);
  expect(page.results[0].captureId).toBeTruthy();
  expect(page.nextCursor).toBeTruthy();
  const next = await client.callTool({ name: "render_usages", arguments: { ...args, cursor: page.nextCursor } });
  expect((next.structuredContent as any).results[0].target.props.title).toBe("Wireless Headphones");
  expect((next.structuredContent as any).nextCursor).toBe("2");
  const last = await client.callTool({ name: "render_usages", arguments: { ...args, cursor: "3" } });
  expect((last.structuredContent as any).nextCursor).toBeNull();
});
