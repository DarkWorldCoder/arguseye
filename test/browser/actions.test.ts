import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
const menu = path.join(root, "components/Menu.tsx");
const items = ["Alpha", "Beta", "Gamma"];
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("putting a component into a state before capture", () => {
  it("runs click, fill and press actions on the warm page, then captures that state", async () => {
    const result = await renderer.render({
      file: menu, exportName: "Menu", props: { items },
      actions: [
        { click: { role: "button", name: "Open menu" } },
        { fill: { label: "Filter" }, value: "ga" },
        { press: "End" },
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('button "Close menu"');
    expect(result.snapshot).toContain('menuitem "Gamma"');
    expect(result.snapshot).not.toContain('menuitem "Alpha"');
    expect(result.snapshot).not.toContain('menuitem "Beta"');
    expect(result.actionsApplied).toBe(3);
  });

  it("reports an action that found nothing as a readable error instead of hanging", async () => {
    const result = await renderer.render({ file: menu, exportName: "Menu", props: { items }, actions: [{ click: { text: "Nope" } }] });
    expect(result.errors.join("\n")).toMatch(/action 1 .*click.*"Nope".*not found/i);
    expect(result.actionsApplied).toBe(0);
  });

  it("seeds localStorage/sessionStorage before the component mounts, for logged-in or flagged states", async () => {
    const result = await renderer.render({ file: menu, exportName: "Menu", props: { items }, storage: { local: { theme: "dark" } } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('button "Open menu"');
    const plain = await renderer.render({ file: menu, exportName: "Menu", props: { items } });
    // storage from one render must not leak into the next
    expect(plain.errors).toEqual([]);
    expect(result.png.equals(plain.png)).toBe(false);
  });
});
