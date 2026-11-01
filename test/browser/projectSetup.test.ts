import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const project = (fixture: string) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "cp-explicit-setup-"));
  const origin = path.resolve("test/fixtures", fixture);
  writeFileSync(path.join(root, "package.json"), readFileSync(path.join(origin, "package.json")));
  symlinkSync(path.join(origin, "node_modules"), path.join(root, "node_modules"), "dir");
  mkdirSync(path.join(root, "src"));
  return root;
};

it("installs explicit Svelte context before mounting and refreshes it after an unsaved edit", async () => {
  const root = project("svelte-app");
  const file = path.join(root, "src/Card.svelte"), setup = path.join(root, "arguseye.setup.svelte.ts");
  writeFileSync(file, '<script>import {getContext} from "svelte"; const theme=getContext("theme");</script><h1>Theme: {theme}</h1>');
  writeFileSync(setup, 'export default function setup(){return new Map([["theme","explicit"]]);}');
  let renderer: Renderer | undefined;
  try {
    renderer = await createRenderer({ root });
    const first = await renderer.render({ file });
    expect(first.errors).toEqual([]);
    expect(first.snapshot).toContain("Theme: explicit");
    expect(first.setupApplied).toBe("arguseye.setup.svelte.ts");
    renderer.server.updateBuffer(setup, 'export default function setup(){return new Map([["theme","unsaved"]]);}');
    expect((await renderer.render({ file })).snapshot).toContain("Theme: unsaved");
  } finally { await renderer?.close(); rmSync(root, { recursive: true, force: true }); }
});

it("uses an explicit JSX provider wrapper while retaining global app styles, including unsaved setup edits", async () => {
  const root = project("react-app");
  const at = (f: string) => path.join(root, f);
  const setup = 'import { Theme } from "./src/theme"; export default function Preview({children}) { return <Theme.Provider value="explicit"><section>{children}</section></Theme.Provider> }';
  writeFileSync(at("src/theme.tsx"), 'import { createContext } from "react"; export const Theme = createContext("missing");');
  writeFileSync(at("src/Card.tsx"), 'import { useContext } from "react"; import { Theme } from "./theme"; export default function Card(){ return <h1>Theme: {useContext(Theme)}</h1> }');
  writeFileSync(at("src/main.tsx"), 'import "./global.css"; import {createRoot} from "react-dom/client"; import {Theme} from "./theme"; createRoot(document.getElementById("app")).render(<Theme.Provider value="inferred"><div /></Theme.Provider>);');
  writeFileSync(at("src/global.css"), 'h1 { color: rgb(12, 34, 56); }');
  writeFileSync(at("arguseye.setup.tsx"), setup);
  let renderer: Renderer | undefined;
  try {
    renderer = await createRenderer({ root });
    const before = await renderer.render({ file: at("src/Card.tsx") });
    expect(before.errors).toEqual([]);
    expect(before.snapshot).toContain("Theme: explicit");
    expect(before.setupApplied).toBe("arguseye.setup.tsx");
    expect(before.layoutsApplied).toEqual(["arguseye.setup.tsx"]);
    renderer.server.updateBuffer(at("arguseye.setup.tsx"), setup.replace('value="explicit"', 'value="unsaved"'));
    const after = await renderer.render({ file: at("src/Card.tsx") });
    expect(after.errors).toEqual([]);
    expect(after.snapshot).toContain("Theme: unsaved");
    expect(after.sourceRevision).not.toBe(before.sourceRevision);
    expect(renderer.server.context().globalCssUrls.join()).toContain("global.css");
    const timings: number[] = [];
    const phases = [];
    for (let i = 0; i < 20; i++) {
      const result = await renderer.render({ file: at("src/Card.tsx") });
      timings.push(result.ms); phases.push(result.timings);
    }
    const p95 = timings.sort((a, b) => a - b)[18];
    console.log("Explicit setup warm render p95", p95, "ms over 20 renders");
    if (p95 > 100) console.log("Explicit setup timing breakdown", JSON.stringify(phases));
    expect(p95).toBeLessThanOrEqual(100);
  } finally { await renderer?.close(); rmSync(root, { recursive: true, force: true }); }
});

it("installs explicit Vue app context and refreshes it for verification after unsaved setup edits", async () => {
  const root = project("vue-app");
  const at = (f: string) => path.join(root, f);
  const setup = 'export default async function setup(app) { app.provide("theme", "explicit"); }';
  writeFileSync(at("src/Card.vue"), '<script setup>import {inject} from "vue"; const theme=inject("theme", "missing");</script><template><h1>Theme: {{theme}}</h1></template>');
  writeFileSync(at("src/main.ts"), 'import {createApp} from "vue"; import Card from "./Card.vue"; const app=createApp(Card); app.provide("theme", "inferred"); app.mount("#app");');
  writeFileSync(at("arguseye.setup.vue.ts"), setup);
  let renderer: Renderer | undefined;
  try {
    renderer = await createRenderer({ root });
    const before = await renderer.render({ file: at("src/Card.vue") });
    expect(before.errors).toEqual([]);
    expect(before.snapshot).toContain("Theme: explicit");
    expect(before.setupApplied).toBe("arguseye.setup.vue.ts");
    renderer.server.updateBuffer(at("arguseye.setup.vue.ts"), setup.replace('"explicit"', '"unsaved"'));
    const after = await renderer.render({ file: at("src/Card.vue") });
    expect(after.errors).toEqual([]);
    expect(after.snapshot).toContain("Theme: unsaved");
    expect(after.sourceRevision).not.toBe(before.sourceRevision);
    renderer.server.updateBuffer(at("arguseye.setup.vue.ts"), 'export default function setup() { throw new Error("Missing fixture context"); }');
    for (let i = 0; i < 2; i++) {
      const incomplete = await renderer.render({ file: at("src/Card.vue") });
      expect(incomplete.complete).toBe(false);
      expect(incomplete.warnings.join()).toContain("Missing fixture context");
    }
  } finally { await renderer?.close(); rmSync(root, { recursive: true, force: true }); }
});
