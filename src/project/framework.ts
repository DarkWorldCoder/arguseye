import { readFileSync } from "node:fs";
import path from "node:path";
/** Which UI runtime renders a component file. React is the default for .jsx/.tsx/.js/.ts. */
export type Framework = "react" | "vue" | "svelte";

export const frameworkOf = (file: string): Framework =>
  file.endsWith(".vue") ? "vue" : file.endsWith(".svelte") ? "svelte" : "react";

/** Single-file components: compiled by the framework's own compiler, one default export. */
export const isSingleFileComponent = (file: string) => /\.(vue|svelte)$/.test(file);

/**
 * The JSX runtime a project renders .jsx/.tsx with: Preact when it depends on preact and not on react
 * (preact/compat projects that alias react keep the React path).
 */
export function jsxRuntimeOf(root: string): "react" | "preact" {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return deps.preact && !deps.react ? "preact" : "react";
  } catch {
    return "react";
  }
}
