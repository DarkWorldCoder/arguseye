import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { openPreview } from "./openPreview.js";

/** SvelteKit components: $app/*, $env/*, $lib and kit.alias imports, and global CSS from the root +layout.svelte. */
const root = path.resolve("test/fixtures/sveltekit-app");
const at = (f: string) => path.join(root, "src/lib/components", f);
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

const CASES: Array<[string, string]> = [
  ["PageInfo.svelte", "Path / status 200"],
  ["StatePage.svelte", "State route /"],
  ["NavButton.svelte", "Go to cart"],
  ["EnvLabel.svelte", "Kit Shop / Kit Shop browser=true dev=true"],
  ["LibImport.svelte", "Price $12.00"],
  ["AliasIcon.svelte", "Starred"],
  ["EnhancedForm.svelte", "Subscribe"],
  ["BaseLink.svelte", "About us"],
];

describe("SvelteKit components render without Kit running", () => {
  it.each(CASES)("%s", async (file, text) => {
    const result = await renderer.render({ file: at(file) });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain(text);
  });

  it("navigation calls are harmless no-ops", async () => {
    const result = await renderer.render({ file: at("NavButton.svelte"), actions: [{ click: { role: "button" } }] });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Navigated");
  });

  it("applies the global CSS the root +layout.svelte imports", async () => {
    const preview = await openPreview(root, { file: at("Badge.svelte"), props: { text: "Hi" } });
    try {
      expect(preview.errors).toEqual([]);
      expect(await preview.style("body", "font-family")).toBe("Georgia, serif");
    } finally { await preview.close(); }
  });
});
