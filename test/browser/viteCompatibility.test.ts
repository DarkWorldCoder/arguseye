import { expect, it } from "vitest";
import path from "node:path";
import { readFileSync, mkdtempSync, symlinkSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import { createRenderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/vite-plugin-app");
const file = path.join(root, "Card.vue");

it("uses the project's actual Vite plugins, styles and unsaved source without mixing runtime copies", async () => {
  const renderer = await createRenderer({ root, buildMode: "vite" });
  try {
    const first = await renderer.render({ file });
    expect(first.errors).toEqual([]);
    expect(first.snapshot).toContain("Actual plugin output");
    expect(first.complete).toBe(true);
    expect(first.build).toMatchObject({ mode: "vite", executesVitePlugins: true });
    expect((await renderer.diff(first.captureId!)).changedPixels).toBe(0);
    renderer.server.updateBuffer(file, readFileSync(file, "utf8").replace("{{ label || brand }}", "Unsaved plugin preview"));
    const edited = await renderer.diff(first.captureId!);
    expect(edited.after.errors).toEqual([]);
    expect(edited.after.snapshot).toContain("Unsaved plugin preview");
    expect(edited.changedPixels).toBeGreaterThan(0);
    const timings = [];
    for (let i = 0; i < 20; i++) timings.push((await renderer.render({ file })).ms);
    console.log("Vite compatibility warm p95", timings.sort((a,b)=>a-b)[18], "ms (measured separately from native mode)");
    expect(renderer.resources().pages).toBe(1);
  } finally { await renderer.close(); }
});

it("restarts compatibility compilation after config and lockfile edits without changing the parent cwd", async () => {
  const project = mkdtempSync(path.join(os.tmpdir(), "cp-vite-config-"));
  for (const name of ["package.json", "vite.config.ts", "Card.vue"]) copyFileSync(path.join(root, name), path.join(project, name));
  symlinkSync(path.join(root, "node_modules"), path.join(project, "node_modules"), "dir");
  const cwd = process.cwd();
  const renderer = await createRenderer({ root: project, buildMode: "vite" });
  try {
    const first = await renderer.render({ file: path.join(project, "Card.vue") });
    expect(first.snapshot).toContain("Actual plugin output");
    writeFileSync(path.join(project, "vite.config.ts"), readFileSync(path.join(project, "vite.config.ts"), "utf8").replace("Actual plugin output", "Changed plugin configuration"));
    const next = await renderer.render({ file: path.join(project, "Card.vue") });
    expect(next.errors).toEqual([]);
    expect(next.snapshot).toContain("Changed plugin configuration");
    expect(next.reloaded).toBe(true);
    writeFileSync(path.join(project, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    expect((await renderer.render({ file: path.join(project, "Card.vue") })).reloaded).toBe(true);
    expect(process.cwd()).toBe(cwd);
  } finally { await renderer.close(); rmSync(project, { recursive: true, force: true }); }
});
