import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CssPipeline } from "../../src/server/cssPipeline.js";

let root: string;
beforeAll(() => {
  const src = path.resolve("test/fixtures/next-app");
  root = mkdtempSync(path.join(os.tmpdir(), "cp-twconfig-"));
  cpSync(src, root, { recursive: true, filter: (p) => !p.includes("node_modules") });
  symlinkSync(path.join(src, "node_modules"), path.join(root, "node_modules"));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("Tailwind v4 with a JavaScript config", () => {
  it("applies the theme from a tailwind.config.js loaded with @config", async () => {
    writeFileSync(path.join(root, "tailwind.config.cjs"), 'module.exports = { theme: { extend: { colors: { legacy: "rgb(1, 2, 3)" } } } };\n');
    writeFileSync(path.join(root, "components/Legacy.tsx"), 'export const Legacy = () => <p className="text-legacy">Old theme</p>;\n');
    const sheet = path.join(root, "app/globals.css");
    const { css } = await new CssPipeline(root).process(sheet, '@import "tailwindcss";\n@config "../tailwind.config.cjs";\n');
    expect(css).toContain(".text-legacy");
    expect(css).toMatch(/rgb\(1,?\s*2,?\s*3\)/);
  });
});
