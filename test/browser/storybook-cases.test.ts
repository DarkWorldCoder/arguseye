import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { openPreview } from "./openPreview.js";

/**
 * Storybook's own renderer test components (MIT, see test/fixtures/storybook-cases/NOTICE.md), rendered with the
 * args from Storybook's stories and checked the way their play functions check them.
 */
const root = path.resolve("test/fixtures/storybook-cases");
const at = (file: string) => path.join(root, file);
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("Storybook's React template components", () => {
  it("Button renders its label (prop-types, classic React import)", async () => {
    const result = await renderer.render({ file: at("react/Button.jsx"), exportName: "Button", props: { label: "Click Me" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('button "Click Me"');
  });

  it("hooks story: state survives two clicks", async () => {
    const result = await renderer.render({ file: at("react/ButtonWithState.tsx"), exportName: "ButtonWithState", actions: [{ click: { role: "button" } }, { click: { role: "button" } }] });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('button "count: 2"');
  });

  it("interaction story: fill, submit, and the delayed 'Completed!!' state", async () => {
    const result = await renderer.render({
      file: at("react/Form.jsx"), exportName: "Form", props: { onSuccess: { $fn: "() => {}" } },
      actions: [{ fill: { label: "Enter Value" }, value: "hello" }, { click: { role: "button", name: "Submit" } }, { wait: 700 }],
    });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Completed!!");
  });

  it("Html renders markup from a string; Pre renders an object as JSON", async () => {
    const html = await renderer.render({ file: at("react/Html.jsx"), exportName: "Html", props: { content: "<p>Hello <b>world</b></p>" } });
    expect(html.errors).toEqual([]);
    expect(html.snapshot).toContain("Hello world");
    const pre = await renderer.render({ file: at("react/Pre.jsx"), exportName: "Pre", props: { object: { a: 1, b: [2, 3] } } });
    expect(pre.errors).toEqual([]);
    expect(pre.snapshot).toMatch(/\\?"a\\?": 1/);
  });

  it("errors story: an unrenderable component comes back as a structured error, not a crash", async () => {
    const result = await renderer.render({ file: at("react/BadComponent.tsx"), exportName: "BadComponent" });
    expect(result.errors.join("\n")).toMatch(/Objects are not valid as a React child/);
  });
});

describe("Storybook's Svelte template components", () => {
  it("Button: primary, large, with the component's scoped styles", async () => {
    const preview = await openPreview(root, { file: at("svelte/Button.svelte"), props: { primary: true, size: "large", label: "Button" } });
    try {
      expect(preview.errors).toEqual([]);
      expect(await preview.style("button", "background-color")).toBe("rgb(85, 90, 185)");
      expect(await preview.style("button", "font-size")).toBe("16px");
    } finally { await preview.close(); }
  });

  it("settled story (Sync): an $effect has run before the capture", async () => {
    const result = await renderer.render({ file: at("svelte/SyncComponent.svelte"), props: { onEffect: { $fn: "() => {}" } } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("shown after the component's effect runs");
  });

  it("settled story (Async): a top-level await (svelte.config.js experimental.async) resolves before the capture", async () => {
    const result = await renderer.render({ file: at("svelte/AsyncComponent.svelte"), props: { onEffect: { $fn: "() => {}" } } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("shown after the component's effect runs");
  });
});

describe("Storybook's Vue 3 template components", () => {
  it("Button (Options API, imports button.css from its script) gets its primary styles", async () => {
    const result = await renderer.render({ file: at("vue/Button.vue"), props: { label: "Button", primary: true } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('button "Button"');
    const preview = await openPreview(root, { file: at("vue/Button.vue"), props: { label: "Button", primary: true } });
    try {
      expect(await preview.style("button", "background-color")).toBe("rgb(85, 90, 185)");
    } finally { await preview.close(); }
  });
});
