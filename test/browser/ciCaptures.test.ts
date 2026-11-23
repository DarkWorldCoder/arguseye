import { expect, it } from "vitest";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRenderer } from "../../src/agent/createRenderer.js";
import { loadCapture, saveCapture } from "../../src/agent/captureFiles.js";

it("replays persisted matrix evidence in another checkout without changing its inputs or baseline", async () => {
  const root = path.resolve("test/fixtures/react-app");
  const title = `Fixed baseline title at ${root}`;
  const temp = await mkdtemp(path.join(os.tmpdir(), "arguseye-ci-"));
  const head = path.join(temp, "head");
  await cp(root, head, { recursive: true, filter: (file) => path.basename(file) !== "node_modules" });
  await symlink(path.join(root, "node_modules"), path.join(head, "node_modules"), "junction");
  const baseRenderer = await createRenderer({ root });
  let headRenderer: Awaited<ReturnType<typeof createRenderer>> | undefined;
  try {
    const report = await baseRenderer.renderMatrix({
      target: { file: "components/MatrixCard.tsx", exportName: "MatrixCard", props: { title } },
      cases: [{ id: "phone", viewport: { width: 390, height: 844 }, theme: "light" }],
    });
    expect(report.complete).toBe(true);
    const directory = path.join(temp, "baseline");
    await saveCapture(directory, report.cells[0].render!, root);
    const original = await readFile(path.join(directory, "capture.json"), "utf8");
    headRenderer = await createRenderer({ root: head });
    const restored = await loadCapture(directory);
    const captureId = headRenderer.restoreCapture(restored);
    const unchanged = await headRenderer.diffMatrix([{ id: "phone", captureId }]);
    expect(unchanged.cells[0].status).toBe("unchanged");
    expect(unchanged.cells[0].diff!.after.target.file).toBe(path.join(head, "components/MatrixCard.tsx"));
    const file = path.join(head, "components/MatrixCard.tsx");
    const source = await headRenderer.server.readSource(file);
    headRenderer.server.updateBuffer(file, source.replace("padding:8px", "padding:18px"));
    const changed = await headRenderer.diffMatrix([{ id: "phone", captureId }]);
    expect(changed.cells[0].status).toBe("changed");
    expect(changed.cells[0].diff!.after.target.props).toEqual({ title });
    expect(changed.cells[0].diff!.after.viewport).toEqual({ width: 390, height: 844 });
    expect(restored.target.file).toBe(path.join(root, "components/MatrixCard.tsx"));
    expect(await readFile(path.join(directory, "capture.json"), "utf8")).toBe(original);
    const legacy = { ...restored };
    delete legacy.captureOrigin;
    expect(() => headRenderer!.restoreCapture(legacy)).toThrow(/capture a new baseline.*root/i);
    expect(() => headRenderer!.restoreCapture({ ...restored, captureOrigin: { projectRoot: root, targetFile: "../outside.tsx" } })).toThrow(/outside|relative/i);
    expect(() => headRenderer!.restoreCapture({ ...restored, target: { ...restored.target, file: path.join(root, "missing.tsx") }, captureOrigin: { projectRoot: root, targetFile: "missing.tsx" } })).toThrow(/missing.tsx/);
    const incomplete = headRenderer.restoreCapture({ ...restored, complete: false, unresolved: ["auth.session"], warnings: ["Provider context unavailable"] });
    expect((await headRenderer.diffMatrix([{ id: "provider", captureId: incomplete }])).cells[0].status).toBe("incomplete");
  } finally {
    await headRenderer?.close();
    await baseRenderer.close();
    await rm(temp, { recursive: true, force: true });
  }
});

it("compares actual nested auth/theme providers and reports broken head setup as failed", async () => {
  const fixture = path.resolve("test/fixtures/react-app");
  const temp = await mkdtemp(path.join(os.tmpdir(), "arguseye-ci-providers-"));
  const roots = [path.join(temp, "base"), path.join(temp, "head")];
  const setup = 'import {Auth,Theme} from "./contexts"; export default function Setup({children}){return <Auth.Provider value="Ada"><Theme.Provider value="dark">{children}</Theme.Provider></Auth.Provider>}';
  const renderers: Awaited<ReturnType<typeof createRenderer>>[] = [];
  try {
    for (const root of roots) {
      await cp(fixture, root, { recursive: true, filter: (file) => path.basename(file) !== "node_modules" });
      await symlink(path.join(fixture, "node_modules"), path.join(root, "node_modules"), "junction");
      await writeFile(path.join(root, "contexts.tsx"), 'import {createContext} from "react"; export const Auth=createContext(null); export const Theme=createContext("light");');
      await writeFile(path.join(root, "components/ProviderCard.tsx"), 'import {useContext} from "react"; import {Auth,Theme} from "../contexts"; export default function Card(){const user=useContext(Auth); if(!user) throw new Error("Missing auth provider"); return <h1>{user} in {useContext(Theme)} theme</h1>}');
      await writeFile(path.join(root, "arguseye.setup.tsx"), setup);
      renderers.push(await createRenderer({ root }));
    }
    const baseline = await renderers[0].render({ file: "components/ProviderCard.tsx", props: {}, viewport: { width: 390, height: 844 } });
    expect(baseline.complete).toBe(true);
    expect(baseline.snapshot).toContain("Ada in dark theme");
    const directory = path.join(temp, "baseline");
    await saveCapture(directory, baseline, roots[0]);
    const captureId = renderers[1].restoreCapture(await loadCapture(directory));
    expect((await renderers[1].diffMatrix([{ id: "auth", captureId }])).cells[0].status).toBe("unchanged");
    const setupFile = path.join(roots[1], "arguseye.setup.tsx");
    renderers[1].server.updateBuffer(setupFile, setup.replace('value="Ada"', 'value="Grace"'));
    const changed = await renderers[1].diffMatrix([{ id: "auth", captureId }]);
    expect(changed.cells[0].status).toBe("changed");
    expect(changed.cells[0].render!.snapshot).toContain("Grace in dark theme");
    renderers[1].server.updateBuffer(setupFile, 'export default function Setup({children}){return children}');
    const broken = await renderers[1].diffMatrix([{ id: "auth", captureId }]);
    expect(broken.cells[0].status).toBe("failed");
    expect(broken.cells[0].errors.join()).toContain("Missing auth provider");
  } finally {
    for (const renderer of renderers) await renderer.close();
    await rm(temp, { recursive: true, force: true });
  }
});

it("keeps a failed baseline expectation failed when the head revision repairs it", async () => {
  const root = path.resolve("test/fixtures/react-app");
  const renderer = await createRenderer({ root });
  const file = path.join(root, "components/MatrixCard.tsx");
  try {
    const base = await renderer.renderMatrix({ target: { file, exportName: "MatrixCard", props: {}, expectations: [{ target: { role: "button", name: "Count 1" }, state: "visible", timeoutMs: 20 }] }, cases: [{ id: "count", viewport: { width: 390, height: 844 }, theme: "light" }] });
    expect(base.cells[0].status).toBe("failed");
    const source = await renderer.server.readSource(file);
    renderer.server.updateBuffer(file, source.replace("useState(0)", "useState(1)"));
    const compared = await renderer.diffMatrix([{ id: "count", captureId: base.cells[0].render!.captureId }]);
    expect(compared.cells[0].render!.expectations![0].status).toBe("passed");
    expect(compared.cells[0].status).toBe("failed");
    expect(compared.coverage.failed).toBe(1);
  } finally { await renderer.close(); }
});
