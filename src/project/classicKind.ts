import { parseSync } from "oxc-parser";
import { compileHtml } from "../server/compileHtml.js";

/**
 * Whether a file runs classic (non-module) scripts: `script` for an embed/IIFE widget (.js/.cjs without import or
 * export, so it cannot be a component), `document` for an .html file with classic <script>s. Classic scripts write
 * real globals and "already loaded" guards, so each render of either gets a page of its own.
 */
export function classicKind(file: string, source: string): "script" | "document" | undefined {
  if (/\.c?js$/.test(file)) return parseSync(file, source, { sourceType: "module", lang: "jsx" }).module.hasModuleSyntax ? undefined : "script";
  if (file.endsWith(".html")) return compileHtml(file, source, () => "", () => "", () => "").scripts.some((s) => s.kind === "classic") ? "document" : undefined;
  return undefined;
}
