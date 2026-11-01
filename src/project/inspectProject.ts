import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { createResolver } from "../server/resolver.js";
import { jsxRuntimeOf } from "./framework.js";
import { readViteConfig } from "./viteConfig.js";
import { previewSetup } from "./previewSetup.js";

type Diagnostic = { code: string; severity: "error" | "warning" | "info"; message: string; recovery: string };
const RUNTIMES = ["react", "react-dom", "next", "preact", "solid-js", "vue", "svelte", "nuxt", "@sveltejs/kit", "vite", "sass", "babel-preset-solid", "lit"];

/** Inspects installed project capabilities without starting Chromium or executing project configuration. */
export function inspectProject(directory: string, buildMode: "native" | "vite" = "native") {
  const root = path.resolve(directory);
  const diagnostics: Diagnostic[] = [];
  let manifest: Record<string, any> = {};
  try { manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")); }
  catch { diagnostics.push({ code: "INVALID_PROJECT", severity: "error", message: `No readable package.json object at ${root}.`, recovery: "Select the application package directory with --root; install its own dependencies there." }); }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    manifest = {};
    diagnostics.push({ code: "INVALID_PROJECT", severity: "error", message: "The selected package.json must contain an object.", recovery: "Repair package.json before previewing this project." });
  }
  const declared = { ...manifest.peerDependencies, ...manifest.optionalDependencies, ...manifest.devDependencies, ...manifest.dependencies };
  const resolver = createResolver();
  const names = RUNTIMES.filter((name) => typeof declared[name] === "string");
  if (names.includes("vue")) names.push("@vue/compiler-sfc");
  const packages = names.map((name) => {
    let installed: string | null = null;
    let packageRoot: string | null = null;
    try {
      const resolved = resolver.resolveFileSync(path.join(root, "package.json"), name).path;
      if (resolved) {
        let dir = path.dirname(realpathSync(resolved));
        while (true) {
          const file = path.join(dir, "package.json");
          if (existsSync(file)) {
            const pkg = JSON.parse(readFileSync(file, "utf8"));
            if (pkg.name === name) { installed = pkg.version ?? null; packageRoot = dir; break; }
          }
          const parent = path.dirname(dir); if (parent === dir) break; dir = parent;
        }
      }
    } catch { /* Missing packages are diagnostics, not an inspection crash. */ }
    if (!installed) diagnostics.push({ code: "PACKAGE_NOT_INSTALLED", severity: "error", message: `${name} cannot be resolved from ${root}.`, recovery: `Install this application's declared dependencies with its own package manager; ${name} must resolve from the selected project.` });
    return { name, declared: typeof declared[name] === "string" ? declared[name] : null, installed, root: packageRoot };
  });
  if (buildMode === "vite" && !packages.some((p) => p.name === "vite" && p.installed)) diagnostics.push({ code: "VITE_NOT_INSTALLED", severity: "error", message: "Compatibility mode requires this project to declare and install Vite.", recovery: "Install the project Vite toolchain or use native mode." });
  const jsx = jsxRuntimeOf(root);
  if (["react", "preact", "solid-js"].filter((name) => names.includes(name)).length > 1) diagnostics.push({ code: "AMBIGUOUS_JSX_RUNTIME", severity: "warning", message: `Multiple JSX runtimes are declared; the current engine selects ${jsx}.`, recovery: "Select the specific application package as --root. Mixed-runtime components in one package need a dedicated adapter." });
  const vite = readViteConfig(root);
  if (vite.file && buildMode === "native") diagnostics.push({ code: "VITE_PLUGINS_NOT_EXECUTED", severity: "warning", message: "The native preview statically reads supported Vite settings; it does not execute the project's Vite plugins.", recovery: "Check virtual-module and macro warnings in each render. A stand-in is incomplete evidence; verify plugin-dependent UI in the application." });
  if (buildMode === "native") diagnostics.push(...vite.warnings.map((message) => ({ code: "COMPUTED_CONFIG_IGNORED", severity: "warning" as const, message, recovery: "Use literal supported configuration or verify the computed behavior in the application." })));
  if (names.includes("next") || names.includes("nuxt") || names.includes("@sveltejs/kit")) diagnostics.push({ code: "APPLICATION_SERVER_NOT_RUN", severity: "info", message: "Application server loaders, middleware and backend state are not executed by an isolated preview.", recovery: "Pass explicit props and inspect unresolved inputs; use a full application test for server behavior." });
  if (!names.some((name) => ["react", "preact", "solid-js", "vue", "svelte", "lit"].includes(name)) && !existsSync(path.join(root, "index.html"))) diagnostics.push({ code: "FRAMEWORK_NOT_DECLARED", severity: "warning", message: "No supported UI runtime is declared in the selected package.", recovery: "Point --root to the application package instead of a workspace parent." });
  const vue = packages.find((p) => p.name === "vue"), compiler = packages.find((p) => p.name === "@vue/compiler-sfc");
  if (vue?.installed && compiler?.installed && vue.installed !== compiler.installed) diagnostics.push({ code: "VUE_COMPILER_VERSION_MISMATCH", severity: "warning", message: `Vue ${vue.installed} and compiler-sfc ${compiler.installed} differ.`, recovery: "Align the project's Vue runtime and compiler versions before relying on SFC fidelity." });
  return {
    schemaVersion: 1 as const, root, name: typeof manifest.name === "string" ? manifest.name : null,
    node: { version: process.versions.node, supported: Number(process.versions.node.split(".")[0]) >= 22 },
    packages, jsxRuntime: jsx,
    setup: { ...Object.fromEntries(Object.entries(previewSetup(root)).map(([kind, file]) => [kind, file ?? null])), policy: "JSX setup replaces inferred providers; Vue setup replaces inferred app installation; Svelte setup returns fresh mount context. Global CSS and root classes remain inferred. Setup runs trusted project code during rendering, never during inspection." },
    build: { mode: buildMode, executesVitePlugins: buildMode === "vite", configFile: vite.file ?? null, aliases: vite.aliases, defines: Object.keys(vite.define) },
    browser: { probed: false, note: "Inspection does not launch a browser. Rendering tries Playwright's headless shell, installed Chrome, then Playwright Chromium; a successful render is required to verify execution." },
    diagnostics, errors: diagnostics.filter((d) => d.severity === "error").map((d) => d.message),
  };
}
