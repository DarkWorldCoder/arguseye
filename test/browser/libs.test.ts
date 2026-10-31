import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { openPreview } from "./openPreview.js";

/** Real component libraries with their real providers from the root layout (MUI, Mantine, Chakra, styled-components, Radix/shadcn). */
const root = path.resolve("test/fixtures/libs-app");
const file = (name: string) => path.join(root, "components", name);
const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("popular component libraries, each inside its provider", () => {
  it.each([
    ["MuiPlan.tsx", "app/page.tsx:10", 'button "Choose Pro"'],
    ["MantineProfile.tsx", "app/page.tsx:11", 'button "Message Asha Rai"'],
    ["ChakraStat.tsx", "app/page.tsx:12", 'heading "$48,210"'],
    ["StyledTag.tsx", "app/page.tsx:13", "Beta"],
  ])("%s renders from its call site with no errors", async (name, usage, expected) => {
    const result = await renderer.render({ file: file(name), usage });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain(expected);
    expect(result.portals).toBeUndefined();
  });

  it("applies the theme from the layout's MUI ThemeProvider and styled-components ThemeProvider", async () => {
    const mui = await openPreview(root, { file: file("MuiPlan.tsx"), exportName: "MuiPlan", props: { name: "Pro", price: 19 } });
    try {
      expect(mui.errors).toEqual([]);
      expect(await mui.style(".MuiButton-contained", "background-color")).toBe("rgb(124, 58, 237)");
    } finally { await mui.close(); }
    const tag = await openPreview(root, { file: file("StyledTag.tsx"), exportName: "StyledTag", props: { text: "Beta" } });
    try {
      expect(await tag.style("span", "background-color")).toBe("rgb(234, 88, 12)");
    } finally { await tag.close(); }
  });

  it("a closed Radix dialog shows its trigger only", async () => {
    const result = await renderer.render({ file: file("ConfirmDelete.tsx"), props: { item: "project" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('button "Delete project"');
    expect(result.portals).toBeUndefined();
  });

  it("an open dialog in a portal is part of the capture and the snapshot", async () => {
    const result = await renderer.render({ file: file("ConfirmDelete.tsx"), usage: "app/page.tsx:14" });
    expect(result.errors).toEqual([]);
    expect(result.portals).toBeGreaterThan(0);
    expect(result.snapshot).toContain('dialog "Delete project?"');
    expect(result.snapshot).toContain('button "Cancel"');
    // The modal overlay covers the viewport, so the capture is the whole screen the user sees.
    expect(pngSize(result.png)).toEqual({ width: 1280, height: 800 });
  });

  it("an unknown usage id names the usages that exist", async () => {
    await expect(renderer.render({ file: file("MuiPlan.tsx"), usage: "app/page.tsx:6" })).rejects.toThrow(/Usages: app\/page\.tsx:10/);
  });
});
