import { expect, it } from "vitest";
import path from "node:path";
import { createRenderer } from "../../src/agent/createRenderer.js";

it("returns opt-in accessibility findings with review-needed checks and element source references", async () => {
  const root = path.resolve("test/fixtures/react-app"), file = path.join(root, "components/Inspection.tsx");
  const renderer = await createRenderer({ root });
  try {
    const ordinary = await renderer.render({ file, exportName: "Inspection" });
    expect(ordinary.accessibility).toBeUndefined();
    expect(ordinary.elements).toBeUndefined();
    const result = await renderer.render({ file, exportName: "Inspection", inspection: { accessibility: true, sources: true } });
    expect(result.errors).toEqual([]);
    expect(result.accessibility?.engine).toMatch(/^axe-core /);
    expect(result.accessibility?.violations.map((r) => r.id)).toEqual(expect.arrayContaining(["image-alt", "button-name"]));
    expect(result.accessibility?.incomplete).toEqual(expect.any(Array));
    expect(result.accessibility?.scope).toBe("#root");
    expect(result.elements?.some((el) => el.source?.file === file)).toBe(true);
    expect(result.environment).toMatchObject({ clock: "system", random: "runtime", locale: expect.any(String), timezoneId: expect.any(String) });
  } finally { await renderer.close(); }
});

it("maps a thrown error to the original TypeScript source without inventing generated-source line numbers", async () => {
  const root = path.resolve("test/fixtures/react-app"), file = path.join(root, "components/Inspection.tsx");
  const renderer = await createRenderer({ root });
  try {
    const result = await renderer.render({ file, exportName: "Inspection", props: { fail: true } });
    expect(result.errors.join()).toContain("Original source inspection failure");
    expect(result.errorLocations?.some((ref) => ref.original?.file === file && ref.original.line === 3)).toBe(true);
  } finally { await renderer.close(); }
});

it("inspects Vue imported macro props, literal defaults, events and slots without mounting the component", async () => {
  const root = path.resolve("test/fixtures/vue-app"), file = path.join(root, "src/Metadata.vue");
  const renderer = await createRenderer({ root });
  try {
    const result = await renderer.describeProps(file);
    expect(result.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "title", kind: "string", required: true }),
      expect.objectContaining({ name: "tone", kind: "enum", required: false, default: "quiet", options: ["quiet", "loud"] }),
      expect.objectContaining({ name: "count", kind: "number", required: false, default: 2 }),
    ]));
    expect(result.metadata).toMatchObject({ framework: "vue", events: ["save"], slots: ["default"] });
    expect(result.sample).toEqual({ title: "Title" });
    const rendered = await renderer.render({ file });
    expect(rendered.errors).toEqual([]);
    expect(rendered.snapshot).toContain("Title / quiet / 2");
    renderer.server.updateBuffer(path.join(root, "src/MetadataProps.ts"), 'export interface MetadataProps { title: number; tone?: "quiet" | "loud"; count?: number }');
    expect((await renderer.describeProps(file)).sample).toEqual({ title: 0 });
    const updated = await renderer.render({ file });
    expect(updated.errors).toEqual([]);
    expect(updated.snapshot).toContain("0 / quiet / 2");
    expect(updated.warnings.join()).not.toContain("Invalid prop");
  } finally { await renderer.close(); }
});
