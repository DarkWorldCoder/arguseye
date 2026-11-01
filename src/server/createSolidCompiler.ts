import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transform } from "oxc-transform";

/**
 * Compiles Solid JSX with the project's own toolchain: oxc removes TypeScript and keeps the JSX, then the
 * project's `babel-preset-solid` (installed with vite-plugin-solid) turns it into Solid's DOM code.
 */
export function createSolidCompiler(root: string) {
  const projectRequire = createRequire(path.join(root, "package.json"));
  let toolchain: Promise<{ babel: any; preset: any }> | undefined;
  const load = () => (toolchain ??= (async () => {
    const importFrom = async (name: string) => {
      const mod = await import(pathToFileURL(projectRequire.resolve(name)).href);
      return mod.default ?? mod;
    };
    const [babel, preset] = await Promise.all([importFrom("@babel/core"), importFrom("babel-preset-solid")]);
    return { babel, preset };
  })());

  return {
    async compile(file: string, source: string): Promise<string> {
      const stripped = await transform(file, source, { sourceType: "module", jsx: "preserve" });
      if (stripped.errors.length) throw new Error(stripped.errors.map((e) => `${file}: ${e.message}`).join("\n"));
      let tools;
      try { tools = await load(); } catch {
        throw new Error("Solid components compile with the project's babel-preset-solid and @babel/core (installed with vite-plugin-solid); neither was found.");
      }
      const result = await tools.babel.transformAsync(stripped.code, {
        filename: file.replace(/\.tsx$/, ".jsx").replace(/\.ts$/, ".js"),
        babelrc: false, configFile: false, sourceMaps: false,
        presets: [[tools.preset, { generate: "dom", hydratable: false, dev: true }]],
      });
      return result?.code ?? "";
    },
  };
}
