import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { routerPackage } from "../../src/project/routerPackage.js";

const root = path.resolve("test/fixtures/router-app");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("components that use React Router", () => {
  it("detects the project's data-router package", () => {
    expect(routerPackage(root)).toBe("react-router");
    expect(routerPackage(path.resolve("test/fixtures/react-app"))).toBeUndefined();
  });

  it("renders Link, NavLink and router hooks inside a memory router", async () => {
    const result = await renderer.render({ file: path.join(root, "components/NavCard.tsx"), exportName: "NavCard", props: { title: "Main menu" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('link "Docs"');
    expect(result.snapshot).toContain('link "Home"');
    expect(result.snapshot).toContain("/");
  });

  it("renders with the props from a real call site", async () => {
    const result = await renderer.render({ file: path.join(root, "components/NavCard.tsx"), exportName: "NavCard", usage: "app/page.tsx:5" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain('navigation "Main menu"');
  });

  it("renders a Remix v2 component: @remix-run/react routes through the project's router, document-only exports render nothing", async () => {
    const result = await renderer.render({ file: path.join(root, "components/RemixBanner.tsx"), exportName: "RemixBanner", props: { text: "Spring sale" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Spring sale");
    expect(result.snapshot).toContain('link "See pricing"');
  });
});
