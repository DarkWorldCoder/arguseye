import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

/** unplugin-auto-import and unplugin-vue-components (Nuxt works the same way): names and components used without imports. */
const root = path.resolve("test/fixtures/vue-auto-app");
const at = (f: string) => path.join(root, "src/components", f);
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

it("auto-imported functions (Vue APIs, a package default, VueUse, a project composable) resolve", async () => {
  const result = await renderer.render({ file: at("AutoCounter.vue") });
  expect(result.errors).toEqual([]);
  expect(result.snapshot).toContain("Hi Asha: 2 doubled is 4, 15 Jan 2026, window measured");
});

it("auto-registered components render where the template uses them", async () => {
  const result = await renderer.render({ file: at("ProductPanel.vue") });
  expect(result.errors).toEqual([]);
  expect(result.snapshot).toContain("Desk lamp");
  expect(result.snapshot).toContain("$49.00");
});
