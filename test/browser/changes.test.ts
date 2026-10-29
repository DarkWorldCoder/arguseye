import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

function copyFixture(): string {
  const src = path.resolve("test/fixtures/react-app");
  const dir = mkdtempSync(path.join(os.tmpdir(), "cp-changes-"));
  cpSync(src, dir, { recursive: true, filter: (p) => !p.includes("node_modules") });
  symlinkSync(path.join(src, "node_modules"), path.join(dir, "node_modules"));
  return dir;
}

let root: string;
let renderer: Renderer;
beforeAll(async () => { root = copyFixture(); renderer = await createRenderer({ root }); });
afterAll(async () => { await renderer?.close(); rmSync(root, { recursive: true, force: true }); });

describe("what changed since the last render of the same target", () => {
  it("reports no changes on an identical re-render, then the change after an edit", async () => {
    const card = path.join(root, "components/ProductCard.tsx");
    const target = { file: card, exportName: "ProductCard", props: { title: "Lamp", price: 5 } };

    const first = await renderer.render(target);
    expect(first.changes).toBeUndefined();

    const same = await renderer.render(target);
    expect(same.changes).toMatchObject({ status: "unchanged", changedPercent: 0, snapshotChanged: false });

    writeFileSync(card, readFileSync(card, "utf8").replace("Add to cart", "Buy now"));
    const edited = await renderer.render(target);
    expect(edited.changes?.status).toBe("changed");
    expect(edited.changes?.changedPercent).toBeGreaterThan(0);
    expect(edited.changes?.snapshotChanged).toBe(true);
    expect(edited.changes?.snapshotDiff).toContain("Buy now");
  });
});
