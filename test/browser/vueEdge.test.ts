import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

/**
 * Vue components as real apps write them: plugins installed in src/main.ts (Pinia, vue-router, vue-i18n,
 * Element Plus), app.provide and directives, Teleport, async components, top-level await, data on mount.
 */
const root = path.resolve("test/fixtures/vue-edge-app");
const at = (f: string) => path.join(root, "src/components", f);
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

const CASES: Array<[string, string]> = [
  ["StoreCounter.vue", "Store count 41"],
  ["RouteName.vue", "Route ready: yes"],
  ["I18nHello.vue", "Hello, Asha!"],
  ["ElSave.vue", "Save changes"],
  ["TeleportModal.vue", "Dialog in body"],
  ["AsyncPanel.vue", "Async part loaded"],
  ["AwaitSetup.vue", "Awaited user"],
  ["InjectTheme.vue", "Accent from app.provide"],
  ["FocusInput.vue", "Search"],
  ["FetchUser.vue", "Could not load user"],
  ["EnvBadge.vue", "API https://api.example.test (development)"],
  ["MouseInfo.vue", "Window measured"],
  ["ScssBox.vue", "SCSS scoped box"],
];

describe("Vue edge cases: plugins from main.ts and the rest", () => {
  it.each(CASES)("%s", async (file, text) => {
    const result = await renderer.render({ file: at(file) });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain(text);
  });
});
