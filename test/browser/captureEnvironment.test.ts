import { expect, it } from "vitest";
import path from "node:path";
import { createRenderer } from "../../src/agent/createRenderer.js";

it("records the actual capture runtime and keeps same-environment comparisons unchanged", async () => {
  const root = path.resolve("test/fixtures/react-app");
  const renderer = await createRenderer({ root });
  try {
    const baseline = await renderer.render({ file: path.join(root, "components/ProductCard.tsx"), exportName: "ProductCard", props: { title: "Desk", price: 3 } });
    expect(baseline.environment?.capture).toMatchObject({ browserName: "chromium", browserVersion: expect.any(String), platform: process.platform, arch: process.arch, osRelease: expect.any(String), deviceScaleFactor: 1, toolVersion: expect.any(String) });
    const same = await renderer.diff(baseline.captureId!);
    expect(same.status).toBe("unchanged");
    expect(same.environmentChanges).toEqual([]);
    const foreign = renderer.restoreCapture({ ...baseline, environment: { ...baseline.environment!, capture: { ...baseline.environment!.capture!, browserVersion: "different-browser", deviceScaleFactor: 2 } } });
    const changed = await renderer.diff(foreign);
    expect(changed.changedPixels).toBe(0);
    expect(changed.after.errors).toEqual([]);
    expect(changed.status).toBe("incomplete");
    expect(changed.environmentChanges.join()).toContain("browserVersion");
    expect(changed.environmentChanges.join()).toContain("deviceScaleFactor");
    expect(changed.newWarnings.join()).toContain("Capture environment changed");
    const { capture: _capture, ...legacyEnvironment } = baseline.environment!;
    const legacy = await renderer.diff(renderer.restoreCapture({ ...baseline, environment: legacyEnvironment }));
    expect(legacy.changedPixels).toBe(0);
    expect(legacy.status).toBe("incomplete");
    expect(legacy.newWarnings.join()).toContain("capture a new baseline");
  } finally { await renderer.close(); }
});
