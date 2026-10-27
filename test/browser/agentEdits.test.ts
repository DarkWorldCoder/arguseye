import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

/** A throwaway copy of the fixture, so tests can edit files on disk like an agent does. */
function copyFixture(): string {
  const src = path.resolve("test/fixtures/react-app");
  const dir = mkdtempSync(path.join(os.tmpdir(), "cp-agent-"));
  cpSync(src, dir, { recursive: true, filter: (p) => !p.includes("node_modules") });
  symlinkSync(path.join(src, "node_modules"), path.join(dir, "node_modules"));
  return dir;
}

let root: string;
let renderer: Renderer;
beforeAll(async () => {
  root = copyFixture();
  renderer = await createRenderer({ root });
});
afterAll(async () => {
  await renderer?.close();
  rmSync(root, { recursive: true, force: true });
});

describe("agent edits files on disk between renders", () => {
  it("renders the saved version immediately after an edit, with no restart", async () => {
    const card = path.join(root, "components/ProductCard.tsx");
    const format = path.join(root, "components/format.ts");
    const target = { file: card, exportName: "ProductCard", props: { title: "Desk", price: 3 } };
    expect((await renderer.render(target)).snapshot).toContain('button "Add to cart (0)"');

    writeFileSync(card, readFileSync(card, "utf8").replace("Add to cart", "Buy now"));
    expect((await renderer.render(target)).snapshot).toContain('button "Buy now (0)"');

    writeFileSync(format, readFileSync(format, "utf8").replace("`$${price.toFixed(2)}`", "`€${price.toFixed(2)}`"));
    expect((await renderer.render(target)).snapshot).toContain("€3.00");
  });
});
