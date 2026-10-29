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

describe("preview server HTTP: dynamic imports", () => {
  it("rewrites dynamic import() specifiers with their quotes kept", async () => {
    server = await createPreviewServer({ root });
    const { body } = await get(server.moduleUrl(path.join(root, "components/Lazy.tsx")));
    expect(body).toMatch(/import\("\/@fs[^"]+\/components\/ProductCard\.tsx[^"]*"\)/);
    expect(body).toMatch(/import\("\/@fs[^"]+\/components\/format\.ts[^"]*"\)/);
    expect(body).not.toMatch(/import\(\/@fs/);
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
    const reactChunk = react.body.match(/from\s*"(\.\/_chunk-[^"]+)"/)?.[1];
    expect(reactChunk).toBeDefined();
    expect(runtime.body).toContain(reactChunk);
  });

  it("bundles packages whose ESM build is at the root and CJS under main (MUI's layout), without inventing a default export", async () => {
    server = await createPreviewServer({ root });
    const lib = await get("/@deps/esm-root-lib.js");
    expect(lib.status, lib.body).toBe(200);
    expect(lib.body).toMatch(/export\s*\{[^}]*\bGreeting\b/);
    expect(lib.body).toMatch(/export\s*\{[^}]*\bshout\b/);
    expect(lib.body).not.toMatch(/export\s*\{[^}]*\bdefault\b/);
    expect(lib.body).not.toContain("export default");
  });

  it("gives packages that reach Node built-ins an empty module instead of a browser import of 'fs'", async () => {
    server = await createPreviewServer({ root });
    const lib = await get("/@deps/uses-node-builtin.js");
    expect(lib.status, lib.body).toBe(200);
    expect(lib.body).not.toMatch(/from\s*["'](node:)?(fs|crypto)["']/);
    expect(lib.body).toMatch(/export\s*\{[^}]*\binBrowser\b/);
  });

  it("reuses a dependency bundle from disk when a previous process on the same project built it", async () => {
    const first = await createPreviewServer({ root });
    await first.prepare(card);
    await first.close();

    server = await createPreviewServer({ root });
    const second = await server.prepare(card);
    expect(second.cached).toBe(true);
    const react = await get("/@deps/react.js");
    expect(react.status).toBe(200);
    expect(react.body).toMatch(/export\s*\{[^}]*\buseState\b/);
  });

  it("resolves react to Next's vendored canary in app-router projects, as the app itself runs on it", async () => {
    server = await createPreviewServer({ root });
    const react = await get("/@deps/react.js");
    expect(react.status, react.body).toBe(200);
    expect(react.body).toMatch(/export\s*\{[^}]*\bcache\b/);
    expect(react.body).toMatch(/__vendored/);
  });

  it("rewrites barrel imports of known icon/utility packages to per-member paths, as Next's optimizePackageImports does", async () => {
    server = await createPreviewServer({ root });
    const { body } = await get(server.moduleUrl(path.join(root, "components/IconButtons.tsx")));
    expect(body).toContain('"/@deps/@mui/icons-material/Add.js"');
    expect(body).toContain('"/@deps/@mui/icons-material/Remove.js"');
    expect(body).not.toContain('"/@deps/@mui/icons-material.js"');
    const add = await get("/@deps/@mui/icons-material/Add.js");
    expect(add.status).toBe(200);
    expect(add.body).not.toContain("__HUGE_MARKER__");
  });
});
