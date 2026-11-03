import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";

const root = path.resolve("test/fixtures/react-app");
const card = path.join(root, "components/ProductCard.tsx");
let server: PreviewServer | undefined;
afterEach(async () => server?.close());

async function get(url: string) {
  const res = await fetch(new URL(url, server!.url));
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
}

it("invalidates native aliases and dependency generations when build inputs change", async () => {
  const project = mkdtempSync(path.join(os.tmpdir(), "cp-native-config-"));
  writeFileSync(path.join(project, "package.json"), '{"type":"module","dependencies":{"react":"*","react-dom":"*"}}');
  symlinkSync(path.join(root, "node_modules"), path.join(project, "node_modules"), "dir");
  for (const name of ["one", "two"]) writeFileSync(path.join(project, name + ".ts"), `export default ${JSON.stringify(name)};`);
  const config = (name: string) => `export default {resolve:{alias:{"@value":${JSON.stringify(path.join(project, name + ".ts"))}}}};`;
  writeFileSync(path.join(project, "vite.config.ts"), config("one"));
  const file = path.join(project, "Card.tsx");
  writeFileSync(file, 'import value from "@value"; export default function Card(){return <p>{value}</p>}');
  try {
    server = await createPreviewServer({ root: project });
    const generation = (await server.prepare(file)).generation;
    expect((await get(server.moduleUrl(file))).body).toContain("one.ts");
    writeFileSync(path.join(project, "vite.config.ts"), config("two"));
    server.syncDisk();
    expect((await get(server.moduleUrl(file))).body).toContain("two.ts");
    expect((await server.prepare(file)).generation).not.toBe(generation);
    const afterConfig = (await server.prepare(file)).generation;
    writeFileSync(path.join(project, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    server.syncDisk();
    expect((await server.prepare(file)).generation).not.toBe(afterConfig);
  } finally { await server?.close(); server = undefined; rmSync(project, { recursive: true, force: true }); }
});

it("serves real component filenames with spaces and URL metacharacters without treating them as a query", async () => {
  const project = mkdtempSync(path.join(os.tmpdir(), "cp-url-paths-"));
  writeFileSync(path.join(project, "package.json"), '{"type":"module"}');
  // Question marks are not valid Windows filenames; spaces and # are valid on both platforms.
  const file = path.join(project, "A card #1.tsx");
  writeFileSync(file, 'export default function Card(){ return "Real filename" }');
  try {
    server = await createPreviewServer({ root: project });
    expect(server.moduleUrl(file)).toContain("%20");
    expect(server.moduleUrl(file)).toContain("%23");
    const response = await get(server.moduleUrl(file));
    expect(response.status).toBe(200);
    expect(response.body).toContain("Real filename");
  } finally { await server?.close(); server = undefined; rmSync(project, { recursive: true, force: true }); }
});

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
    const response = await fetch(new URL(server.moduleUrl(card), server.url));
    expect(response.headers.get("server-timing")).toMatch(/^transform;dur=\d+(\.\d+)?$/);
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


it("uses the same-origin bounded native template bridge and recovers after crash, deadline and invalid replies", async () => {
  const root = path.resolve("test/fixtures/template-app");
  server = await createPreviewServer({ root });
  server.updateBuffer(path.join(root, "arguseye.templates.json"), JSON.stringify({ version: 1, limits: { timeoutMs: 1000 }, adapters: { bridge: { command: [process.execPath, path.join(root, "protocol.cjs")], suffixes: [".bridge"] } } }));
  const url = server.url + "/@template";
  const request = (name: string, mode?: string) => ({ file: path.join(root, "protocol.bridge"), props: { name, mode } });
  const post = async (body: unknown, signal?: AbortSignal) => {
    const result = await fetch(url, { method: "POST", headers: { Origin: server!.url }, body: JSON.stringify(body), signal });
    return result.json() as Promise<any>;
  };
  expect((await fetch(url, { method: "POST", body: JSON.stringify(request("Ada")) })).status).toBe(403);
  const [a, b] = await Promise.all([post(request("Ada")), post(request("Grace"))]);
  expect(a.html).toContain("Hello Ada"); expect(b.html).toContain("Hello Grace");
  expect(a.template.runtime).toBe("custom");
  const crashed = await post(request("Crash", "crash")); expect(crashed.errors.join(" ")).toContain("exited");
  const invalid = await post(request("Bad", "invalid")); expect(invalid.errors.join(" ")).toContain("protocol");
  const slow = await post(request("Slow", "hang")); expect(slow.errors.join(" ")).toContain("1000 ms");
  const controller = new AbortController();
  const cancelled = post(request("Cancelled", "hang"), controller.signal);
  setTimeout(() => controller.abort(), 50);
  await expect(cancelled).rejects.toThrow();
  const recovered = await post(request("Recovered")); expect(recovered.errors).toEqual([]); expect(recovered.html).toContain("Hello Recovered");
});
