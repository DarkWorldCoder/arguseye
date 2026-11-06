import { expect, it } from "vitest";
import path from "node:path";
import { createRenderer } from "../../src/agent/createRenderer.js";

it("focuses inspection beyond the first 100 nodes and reports missing targets without losing the render", async () => {
  const root = path.resolve("test/fixtures/react-app"), file = path.join(root, "components/Inspection.tsx");
  const renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(file, 'export function Inspection(){return <section>{Array.from({length:110},(_,i)=><div key={i}>Item {i}</div>)}<button id="inspect-me" style={{width:137}}>Inspect this</button></section>}');
    const inspection = { selector: "#inspect-me", fonts: true, sources: true };
    const result = await renderer.render({ file, exportName: "Inspection", inspection });
    expect(result.errors).toEqual([]);
    expect(result.elements).toHaveLength(1);
    expect(result.elements![0]).toMatchObject({ text: "Inspect this", bounds: { width: 137 }, font: { status: "available" }, source: { file } });
    expect(result.styleInspection).toMatchObject({ selector: "#inspect-me", total: 1, inspected: 1, complete: true });
    const replay = await renderer.diff(result.captureId!);
    expect(replay.after.target.inspection).toEqual(inspection);
    expect(replay.after.elements).toHaveLength(1);
    const missing = await renderer.render({ file, exportName: "Inspection", inspection: { selector: "head, #missing" } });
    expect(missing.errors).toEqual([]);
    expect(missing.snapshot).toContain("Inspect this");
    expect(missing.elements).toEqual([]);
    expect(missing.complete).toBe(false);
    expect(missing.warnings.join()).toContain("No elements matched");
    const invalid = await renderer.render({ file, exportName: "Inspection", inspection: { selector: "[" } });
    expect(invalid.errors).toEqual([]);
    expect(invalid.complete).toBe(false);
    expect(invalid.warnings.join()).toContain("Requested inspection did not complete");
  } finally { await renderer.close(); }
});

it("keeps font selectors addressable when portal inspection includes the preview root", async () => {
  const root = path.resolve("test/fixtures/react-app"), file = path.join(root, "components/Inspection.tsx");
  const renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(file, 'import {createPortal} from "react-dom"; export function Inspection(){return <><p>Inside root</p>{createPortal(<aside>Portal text</aside>,document.body)}</>}');
    const result = await renderer.render({ file, exportName: "Inspection", inspection: { fonts: true } });
    expect(result.errors).toEqual([]);
    expect(result.styleInspection?.scope).toBe("body");
    expect(result.elements?.find((element) => element.selector === "#root")?.font?.status).toBe("available");
    expect(result.elements?.find((element) => element.text === "Portal text" && element.tag === "aside")?.font?.status).toBe("available");
  } finally { await renderer.close(); }
});

it("reports geometry and intentional clipping as observations rather than correctness failures", async () => {
  const root = path.resolve("test/fixtures/react-app"), file = path.join(root, "components/Inspection.tsx");
  const renderer = await createRenderer({ root });
  try {
    renderer.server.updateBuffer(file, 'export function Inspection(){return <section><div style={{width:80,overflow:"hidden"}}><span style={{display:"block",width:160}}>Wide child</span></div><p style={{display:"none"}}>Hidden</p></section>}');
    const result = await renderer.render({ file, exportName: "Inspection", inspection: { layout: true } });
    expect(result.errors).toEqual([]);
    expect(result.elements?.find((element) => element.tag === "div" && element.text === "Wide child")).toMatchObject({ bounds: { width: 80 }, observations: expect.arrayContaining(["horizontal-overflow"]) });
    expect(result.elements?.find((element) => element.tag === "span")?.observations).toContain("clipped-by-ancestor");
    expect(result.elements?.find((element) => element.tag === "p")?.observations).toEqual(expect.arrayContaining(["hidden", "zero-size"]));
    expect(result.styleInspection).toMatchObject({ scope: "#root", limit: 100, complete: true });
    expect(result.complete).toBe(true);
  } finally { await renderer.close(); }
});

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
