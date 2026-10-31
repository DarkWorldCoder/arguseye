import path from "node:path";
import { rawUrl } from "./assets.js";

/**
 * Where an import of `next/font/google` or `next/font/local` points: a generated module that exports the imported
 * loaders. Next replaces these calls at build time, so the real package has nothing to run in a browser.
 */
export function nextFontUrl(specifier: string, importer: string, statement: string): string | undefined {
  if (specifier !== "next/font/google" && specifier !== "next/font/local") return undefined;
  const braces = statement.match(/\{([^}]*)\}/)?.[1] ?? "";
  const names = braces.split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
  const params = new URLSearchParams({ kind: specifier.endsWith("local") ? "local" : "google", from: importer, names: names.join(",") });
  return `/@next-font?${params}`;
}

/** Loaders that return what Next's do (`className`, `variable`, `style.fontFamily`) and inject the matching CSS. */
export function nextFontModule(kind: string, importer: string, names: string[]): string {
  const generic = (family: string) => (/mono|code/i.test(family) ? "ui-monospace, monospace" : /serif|playfair|merriweather|lora|garamond|baskerville|caslon/i.test(family) && !/sans/i.test(family) ? "serif" : "ui-sans-serif, system-ui, sans-serif");
  const lines = [
    // One stylesheet for every loader module (each import site gets its own module instance).
    `const css = (window.__cpNextFontCss ??= new Set());`,
    `const flush = () => { let style = document.getElementById("cp-next-font-loaders"); if (!style) { style = document.createElement("style"); style.id = "cp-next-font-loaders"; document.head.append(style); } style.textContent = [...css].join("\\n"); };`,
    `const id = (s) => s.replace(/[^A-Za-z0-9]/g, "_");`,
    // A Google font is used by name: it renders when installed locally, else in the same generic family.
    `const loader = (family, generic, faces = "") => (options = {}) => {`,
    `  const stack = "'" + family + "', " + generic;`,
    `  const className = "__nf_" + id(family);`,
    `  if (faces) css.add(faces);`,
    `  css.add("." + className + "{font-family:" + stack + "}");`,
    `  let variable = "";`,
    `  if (options.variable) { variable = "__nfv_" + id(family) + id(options.variable); css.add("." + variable + "{" + options.variable + ":" + stack + "}"); }`,
    `  flush();`,
    `  return { className, variable, style: { fontFamily: stack } };`,
    `};`,
  ];
  if (kind === "google") {
    for (const name of names) lines.push(`export const ${name} = loader(${JSON.stringify(name.replaceAll("_", " "))}, ${JSON.stringify(generic(name))});`);
  } else {
    // next/font/local: the files are the project's own, so they load for real.
    const dir = path.dirname(importer);
    lines.push(
      `const base = ${JSON.stringify(dir)};`,
      `const resolve = (p) => { const parts = (p.startsWith("/") ? p : base + "/" + p).split("/"); const out = []; for (const x of parts) { if (x === "..") out.pop(); else if (x && x !== ".") out.push(x); } return "/" + out.join("/"); };`,
      `const raw = (p) => ${JSON.stringify(rawUrl("").replace(/\?raw$/, ""))}.replace(/\\/$/, "") + resolve(p) + "?raw";`,
      `window.__cpLocalFonts ??= 0;`,
      `export default function localFont(options = {}) {`,
      `  const family = "local_font_" + (++window.__cpLocalFonts);`,
      `  const srcs = Array.isArray(options.src) ? options.src : [{ path: options.src, weight: options.weight, style: options.style }];`,
      `  const faces = srcs.map((s) => "@font-face{font-family:'" + family + "';src:url(" + JSON.stringify(raw(s.path)) + ");font-display:block" + (s.weight ? ";font-weight:" + s.weight : "") + (s.style ? ";font-style:" + s.style : "") + "}").join("\\n");`,
      `  return loader(family, "ui-sans-serif, system-ui, sans-serif", faces)(options);`,
      `}`,
    );
  }
  return lines.join("\n");
}
