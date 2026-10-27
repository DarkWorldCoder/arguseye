import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
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

describe("MCP tools (what a coding agent calls)", () => {
  it("offers render, usage and blast-radius tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["describe_props", "list_usages", "render_component", "render_diff", "render_usages"]);
  });

  it("render_component returns a PNG and a compact text snapshot for a real usage, by project-relative path", async () => {
    const result = await client.callTool({
      name: "render_component",
      arguments: { file: "components/ProductCard.tsx", export: "ProductCard", usage: "app/page.tsx:9" },
    });
    const content = result.content as Content;

    expect(result.isError).toBeFalsy();
    expect(content[0]).toMatchObject({ type: "image", mimeType: "image/png" });
    expect(Buffer.from(content[0].data!, "base64").subarray(1, 4).toString()).toBe("PNG");
    const text = content[1].text!;
    expect(text).toContain("ProductCard · components/ProductCard.tsx · usage app/page.tsx:9");
    expect(text).toContain("errors: none");
    expect(text).toContain('heading "Wireless Headphones"');
  });

  it("list_usages returns each usage id with its real props", async () => {
    const result = await client.callTool({ name: "list_usages", arguments: { file: "components/ProductCard.tsx", export: "ProductCard" } });
    const usages = JSON.parse((result.content as Content)[0].text!);
    expect(usages.map((u: { id: string }) => u.id)).toEqual(["app/page.tsx:9", "app/page.tsx:10", "app/shop/page.tsx:7"]);
  });

  it("render_usages renders the component at every place it is used, in one call", async () => {
    const result = await client.callTool({ name: "render_usages", arguments: { file: "components/ProductCard.tsx", export: "ProductCard" } });
    const content = result.content as Content;

    expect(content.filter((c) => c.type === "image")).toHaveLength(3);
    const texts = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    expect(texts).toContain("usage app/page.tsx:9");
    expect(texts).toContain('heading "USB-C Cable"');
  });

  it("reports render errors as readable results, not crashes", async () => {
    const result = await client.callTool({ name: "render_component", arguments: { file: "components/ProductCard.tsx", export: "Missing" } });
    const text = (result.content as Content).find((c) => c.type === "text")!.text!;
    expect(result.isError).toBe(true);
    expect(text).toContain('No component export "Missing"');
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
  expect(evidence.captureId).toBeTruthy();
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
  expect(page.total).toBe(3);
  expect(page.results).toHaveLength(1);
  expect(page.results[0].captureId).toBeTruthy();
  expect(page.nextCursor).toBeTruthy();
  const next = await client.callTool({ name: "render_usages", arguments: { ...args, cursor: page.nextCursor } });
  expect((next.structuredContent as any).results[0].target.props.title).toBe("USB-C Cable");
  expect((next.structuredContent as any).nextCursor).toBe("2");
  const last = await client.callTool({ name: "render_usages", arguments: { ...args, cursor: "2" } });
  expect((last.structuredContent as any).nextCursor).toBeNull();
});
