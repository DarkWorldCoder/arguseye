import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, unlinkSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { get as httpGet } from "node:http";
import { createPreviewServer, type PreviewServer } from "../../src/server/createPreviewServer.js";
import { encodeContext, encodeTarget } from "../../src/server/page.js";

let dir: string, root: string, outside: string, shared: string, server: PreviewServer;
beforeEach(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "cp-file-access-"));
  root = path.join(dir, "app"); shared = path.join(dir, "shared");
  mkdirSync(path.join(root, "node_modules/@example"), { recursive: true });
  mkdirSync(path.join(root, "public")); mkdirSync(shared);
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { "@example/shared": "file:../shared" } }));
  writeFileSync(path.join(root, "component.js"), 'export const inside = "inside-project";');
  writeFileSync(path.join(root, "public/asset.txt"), "public-asset");
  writeFileSync(path.join(shared, "package.json"), JSON.stringify({ name: "@example/shared", exports: "./index.js" }));
  writeFileSync(path.join(shared, "index.js"), 'export const shared = "workspace-dependency";');
  symlinkSync(shared, path.join(root, "node_modules/@example/shared"), "junction");
  outside = path.join(dir, "private.js"); writeFileSync(outside, 'export const privateValue = "outside-canary";');
  server = await createPreviewServer({ root });
});
afterEach(async () => { await server?.close(); rmSync(dir, { recursive: true, force: true }); });
const get = (url: string, headers?: Record<string, string>) => new Promise<{ status: number; text: string }>((resolve, reject) => {
  httpGet(new URL(url, server.url), { headers }, (response) => {
    let text = ""; response.setEncoding("utf8"); response.on("data", (chunk) => { text += chunk; });
    response.on("end", () => resolve({ status: response.statusCode!, text }));
  }).on("error", reject);
});

it("serves project files, public assets and declared symlinked workspace dependencies", async () => {
  expect((await get(server.moduleUrl(path.join(root, "component.js")))).text).toContain("inside-project");
  expect(await get("/asset.txt")).toEqual({ status: 200, text: "public-asset" });
  const response = await get(server.moduleUrl(path.join(shared, "index.js")));
  expect(response.status, response.text).toBe(200);
  expect(response.text).toContain("workspace-dependency");
});

it("denies raw, transformed and encoded outside files and generated-context escape routes", async () => {
  for (const url of [
    `/@fs${outside}?raw`, `/@fs${outside}`,
    '/@fs/' + outside.slice(1).replaceAll('/', '%2F') + '?raw',
    '/?t=' + encodeTarget({ file: outside }),
    '/@context?c=' + encodeContext(outside, []),
    '/@next-font?from=' + encodeURIComponent(outside),
    '/@graph?file=' + encodeURIComponent(outside),
  ]) {
    const response = await get(url);
    expect(response.status, url + ': ' + response.text).toBe(403);
    expect(response.text).not.toContain("outside-canary");
  }
});

it("rejects symlink retargeting and path-prefix siblings without breaking internal symlinks", async () => {
  const link = path.join(root, "link.js");
  symlinkSync(path.join(root, "component.js"), link);
  expect((await get(`/@fs${link}?raw`)).status).toBe(200);
  unlinkSync(link); symlinkSync(outside, link);
  expect((await get(`/@fs${link}?raw`)).status).toBe(403);
  const sibling = path.join(dir, "app-private"); mkdirSync(sibling);
  const file = path.join(sibling, "private.txt"); writeFileSync(file, "outside-canary");
  expect((await get(`/@fs${file}?raw`)).status).toBe(403);
  symlinkSync(outside, path.join(root, "public/leak.txt"));
  expect((await get('/leak.txt')).status).toBe(403);
});

it("rejects unexpected origins and host names before serving project content", async () => {
  expect((await get('/asset.txt', { origin: 'https://other.invalid' })).status).toBe(403);
  expect((await get('/asset.txt', { host: 'other.invalid' })).status).toBe(403);
  expect((await get('/asset.txt', { origin: server.url })).status).toBe(200);
});
