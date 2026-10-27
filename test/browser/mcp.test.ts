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
    expect(tools.map((t) => t.name).sort()).toEqual(["list_usages", "render_component", "render_usages"]);
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
    expect(usages.map((u: { id: string }) => u.id)).toEqual(["app/page.tsx:9", "app/page.tsx:10"]);
  });

  it("render_usages renders the component at every place it is used, in one call", async () => {
    const result = await client.callTool({ name: "render_usages", arguments: { file: "components/ProductCard.tsx", export: "ProductCard" } });
    const content = result.content as Content;

    expect(content.filter((c) => c.type === "image")).toHaveLength(2);
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
});
