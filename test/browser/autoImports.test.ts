import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("Nuxt components (auto-imports, composables and built-in components from .nuxt)", () => {
  const nuxtRoot = path.resolve("test/fixtures/nuxt-app");
  let nuxt: Renderer;
  beforeAll(async () => { nuxt = await createRenderer({ root: nuxtRoot }); });
  afterAll(async () => nuxt?.close());

  it("renders a component using useFetch, useState, useRoute, useHead, NuxtLink, ClientOnly and NuxtImg without Nuxt", async () => {
    const result = await nuxt.render({ file: path.join(nuxtRoot, "components/ProductCard.vue") });
    expect(result.errors).toEqual([]);
    for (const text of ["Desk lamp", "$49", "Cart 3", 'link "View cart"', "Lamp photo", "starred", "route /"]) expect(result.snapshot).toContain(text);
  });

  it("renders a page that calls definePageMeta", async () => {
    const result = await nuxt.render({ file: path.join(nuxtRoot, "pages/index.vue") });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Desk lamp");
  });
});
