import { createRequire } from "node:module";
import path from "node:path";
import type { CssPipeline } from "./cssPipeline.js";

/**
 * Compiles .svelte files with the project's own Svelte (5 or 4) for the browser, in dev mode, with component
 * styles injected by the component itself. <style lang="scss|sass"> goes through the project's CSS pipeline first.
 */
export function createSvelteCompiler(root: string, css: CssPipeline) {
  let svelte: { compile: Function; preprocess: Function; VERSION: string } | undefined;
  const previous = new Map<string, { source: string; code: string }>();
  return {
    async compile(file: string, source: string): Promise<string> {
      const old = previous.get(file);
      if (old?.source === source) return old.code;
      svelte ??= createRequire(path.join(root, "package.json"))("svelte/compiler");
      const major = Number(svelte!.VERSION.split(".")[0]);
      const { code: preprocessed } = await svelte!.preprocess(source, {
        style: async ({ content, attributes }: { content: string; attributes: Record<string, string | boolean> }) => {
          const lang = typeof attributes.lang === "string" ? attributes.lang : "css";
          if (lang === "css") return undefined;
          return { code: (await css.process(`${file}.style.${lang}`, content)).css };
        },
      }, { filename: file });
      const options = major >= 5
        ? { filename: file, generate: "client", dev: true, css: "injected" }
        : { filename: file, generate: "dom", dev: true, css: "injected" };
      let compiled;
      try {
        compiled = svelte!.compile(preprocessed, options);
      } catch (error: any) {
        const at = error?.start ? `:${error.start.line}:${error.start.column}` : "";
        throw new Error(`${file}${at}: ${error?.message ?? error}`);
      }
      const code = compiled.js.code as string;
      previous.set(file, { source, code });
      return code;
    },
  };
}
