import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/next-app");
const badge = path.join(root, "components/DealBadge.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("nested layouts and templates along the page's route", () => {
  it("wraps a component in every layout and template from app/ down to the page that uses it", async () => {
    const result = await renderer.render({ file: badge, exportName: "DealBadge", usage: "app/(shop)/deals/page.tsx:4" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Today: 15% off");
    expect(result.layoutsApplied).toEqual(["app/layout.tsx", "app/(shop)/layout.tsx", "app/(shop)/template.tsx"]);
  });

  it("uses the route of the first page that uses the component when no usage is given", async () => {
    const result = await renderer.render({ file: badge, exportName: "DealBadge", props: { label: "Any" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Any: 15% off");
  });

  it("skips inferred shells with missing runtime inputs, retains usable providers, and reports the gap on warm renders", async () => {
    const layout = path.join(root, "app/(shop)/layout.tsx");
    const target = { file: badge, exportName: "DealBadge", usage: "app/(shop)/deals/page.tsx:4" };
    try {
      for (const input of ["tenant={tenant}", "{...tenant}"]) {
        renderer.server.updateBuffer(layout, `import { TenantShell } from "@/components/TenantShell";
          export default async function Layout({ children }) {
            const tenant = await loadAuthenticatedTenant();
            return <TenantShell ${input}>{children}</TenantShell>;
          }`);
        for (let i = 0; i < 2; i++) {
          const result = await renderer.render(target);
          expect(result.errors).toEqual([]);
          expect(result.snapshot).toContain("Today: 15% off");
          expect(result.warnings.join("\n")).toContain('app/(shop)/layout.tsx: Skipped inferred wrapper TenantShell');
          expect(result.warnings.join("\n")).toContain(input);
          expect(result.complete).toBe(false);
        }
      }
      renderer.server.updateBuffer(layout, `import { TenantShell } from "@/components/TenantShell";
        export default function Layout({ children }) {
          return <TenantShell tenant={{ logo_key: "North" }}>{children}</TenantShell>;
        }`);
      const restored = await renderer.render(target);
      expect(restored.errors).toEqual([]);
      expect(restored.snapshot).toContain('region "Tenant North"');
      expect(restored.snapshot).toContain("Today: 15% off");
      expect(restored.warnings.join("\n")).not.toContain("Skipped inferred wrapper");
      renderer.server.updateBuffer(badge, 'export function DealBadge() { throw new Error("Target failed independently"); }');
      try {
        const failed = await renderer.render(target);
        expect(failed.errors.join("\n")).toContain("Target failed independently");
        expect(failed.errors.join("\n")).toContain("DealBadge.tsx");
      } finally { renderer.server.updateBuffer(badge, undefined); }
    } finally { renderer.server.updateBuffer(layout, undefined); }
  });
});
