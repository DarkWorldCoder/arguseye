import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
let root: string;
let renderer: Renderer;
beforeAll(async () => {
  const fixture = path.resolve("test/fixtures/react-app");
  root = mkdtempSync(path.join(os.tmpdir(), "cp-usages-"));
  cpSync(fixture, root, { recursive: true, filter: (p) => !p.includes("node_modules") });
  symlinkSync(path.join(fixture, "node_modules"), path.join(root, "node_modules"));
  writeFileSync(path.join(root, "components/index.ts"), 'export { ProductCard as Tile } from "./ProductCard";');
  writeFileSync(path.join(root, "components/again.ts"), 'export * from "./index";');
  writeFileSync(path.join(root, "app/aliases.tsx"), 'import {Tile as X} from "../components/again";\nexport default () => <><X title="First" price={1}/><X title="Second" price={2}/></>;');
  writeFileSync(path.join(root, "app/runtime.tsx"), 'import {ProductCard as X} from "../components/ProductCard";\nexport default () => <X title={user.name} price={1}/>;');
  renderer = await createRenderer({ root });
});
afterAll(async () => { await renderer?.close(); if (root) rmSync(root, { recursive: true, force: true }); });
describe("real usages through aliases and barrels", () => {
  it("finds aliased barrel exports and disambiguates two usages on one line", async () => {
    const usages = await renderer.listUsages(path.join(root, "components/ProductCard.tsx"), "ProductCard");
    const aliases = usages.filter((u) => u.id.startsWith("app/aliases"));
    expect(aliases.map((u) => u.props.title)).toEqual(["First", "Second"]);
    expect(aliases[0].id).toMatch(/^app\/aliases.tsx:2:\d+$/);
    expect(aliases[0].id).not.toBe(aliases[1].id);
  });
  it("reports unresolved runtime props even if the component renders", async () => {
    const result = await renderer.render({ file: path.join(root, "components/ProductCard.tsx"), exportName: "ProductCard", usage: "app/runtime.tsx:2" });
    expect(result.errors).toEqual([]);
    expect(result.unresolved).toEqual(["title={user.name}"]);
    expect(result.complete).toBe(false);
    expect(result.warnings.join()).toContain("Runtime");
  });
  it("updates the index after edits, additions, deletions and unsaved buffers", async () => {
    const file = path.join(root, "components/ProductCard.tsx");
    const caller = path.join(root, "app/aliases.tsx");
    const source = readFileSync(caller, "utf8");
    renderer.server.updateBuffer(caller, source.replace("First", "Buffered"));
    expect((await renderer.listUsages(file, "ProductCard")).some((u) => u.props.title === "Buffered")).toBe(true);
    renderer.server.updateBuffer(caller, undefined);
    writeFileSync(caller, source.replace("First", "Saved"));
    expect((await renderer.listUsages(file, "ProductCard")).some((u) => u.props.title === "Saved")).toBe(true);
    rmSync(caller);
    expect((await renderer.listUsages(file, "ProductCard")).some((u) => u.id.startsWith("app/aliases"))).toBe(false);
  });
});
