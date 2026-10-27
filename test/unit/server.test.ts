import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";

const root = path.resolve("test/fixtures/react-app");
const card = path.join(root, "components/ProductCard.tsx");
let server: PreviewServer | undefined;
afterEach(async () => server?.close());

async function get(url: string) {
  const res = await fetch(new URL(url, server!.url));
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
}

describe("preview server HTTP", () => {
  it("serves a component as browser ESM with types stripped and imports rewritten", async () => {
    server = await createPreviewServer({ root });
    const { status, type, body } = await get(server.moduleUrl(card));

    expect(status).toBe(200);
    expect(type).toContain("javascript");
    expect(body).not.toContain("ProductCardProps =");
    expect(body).toMatch(/from "\/@deps\/react\.js"/);
    expect(body).toMatch(/from "\/@deps\/clsx\.js"/);
    expect(body).toContain(`"/@fs${path.join(root, "components/format.ts")}`);
    expect(body).toContain(`/@fs${path.join(root, "components/ProductCard.css")}?import`);
  });
});

describe("dependency pre-bundling", () => {
  it("serves npm packages as ESM with their named exports, sharing one React instance", async () => {
    server = await createPreviewServer({ root });
    await get(server.moduleUrl(card)); // discovers react, clsx

    const react = await get("/@deps/react.js");
    expect(react.status).toBe(200);
    expect(react.body).toMatch(/export\s*\{[^}]*\buseState\b/);
    expect(react.body).toMatch(/export\s*\{[^}]*\bdefault\b|export default/);

    const runtime = await get("/@deps/react/jsx-dev-runtime.js");
    expect(runtime.body).toMatch(/\bjsxDEV\b/);
    // react and its jsx runtime import the same shared chunk instead of each bundling React
    const reactChunk = react.body.match(/from "(\.\/_chunk-[^"]+)"/)?.[1];
    expect(reactChunk).toBeDefined();
    expect(runtime.body).toContain(reactChunk);
  });
});
