import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import type { CssPipeline } from "./cssPipeline.js";

type Sfc = { parse: Function; compileScript: Function; compileTemplate: Function; compileStyleAsync: Function; invalidateTypeCache?: Function };

/** Compiles SFCs with the project's matching Vue compiler; no extension-owned Vue enters the page. */
export function createVueCompiler(root: string, css: CssPipeline, fs: { fileExists(file: string): boolean; readFile(file: string): string } = { fileExists: existsSync, readFile: (file) => readFileSync(file, "utf8") }) {
  let compiler: Sfc | undefined;
  const previous = new Map<string, { script: string; template: string; source: string; code: string; revision: string }>();
  const typeFiles = new Set<string>();
  return {
    async compile(file: string, source: string, revision = ""): Promise<string> {
      const old = previous.get(file);
      if (old?.source === source && old.revision === revision) return old.code;
      compiler ??= createRequire(path.join(root, "package.json"))("vue/compiler-sfc");
      for (const dependency of typeFiles) compiler!.invalidateTypeCache?.(dependency);
      const { descriptor, errors } = compiler!.parse(source, { filename: file });
      if (errors.length) throw new Error(`${file}: ${errors.join("\n")}`);
      if (descriptor.customBlocks.length || descriptor.script?.src || descriptor.scriptSetup?.src || descriptor.template?.src) throw new Error(`${file}: SFC custom blocks and external script/template sources require the app's build plugins.`);
      const id = "cp-" + createHash("sha256").update(file).digest("hex").slice(0, 12);
      const scope = "data-v-" + id;
      const scriptSource = [descriptor.script?.content, descriptor.scriptSetup?.content].join("\n");
      const script = descriptor.script || descriptor.scriptSetup ? compiler!.compileScript(descriptor, { id, genDefaultAs: "_sfc_main", fs: { fileExists: fs.fileExists, readFile: (file: string) => { typeFiles.add(file); return fs.readFile(file); } } }) : { content: "const _sfc_main = {};", bindings: {} };
      const template = descriptor.template ? compiler!.compileTemplate({ source: descriptor.template.content, filename: file, id: scope, scoped: descriptor.styles.some((s: any) => s.scoped), compilerOptions: { bindingMetadata: script.bindings } }) : { code: "const render = () => null;", errors: [] };
      if (template.errors.length) throw new Error(`${file}: ${template.errors.join("\n")}`);
      const classes: Record<string, unknown> = {};
      const styles: string[] = [];
      for (const [index, style] of descriptor.styles.entries()) {
        if (style.src) throw new Error(`${file}: external SFC styles require an explicit stylesheet import.`);
        const processed = await css.process(`${file}.${index}${style.module ? ".module" : ""}.${style.lang ?? "css"}`, style.content);
        if (processed.classes) classes[typeof style.module === "string" ? style.module : "$style"] = processed.classes;
        const scoped = await compiler!.compileStyleAsync({ source: processed.css, filename: file, id: scope, scoped: style.scoped });
        if (scoped.errors.length) throw new Error(`${file}: ${scoped.errors.join("\n")}`);
        styles.push(scoped.code);
      }
      const change = !old || old.script !== scriptSource ? "script" : old.template !== descriptor.template?.content ? "template" : "style";
      const code = `${script.content}
${template.code.replace(/export function render\b/, "function render")}
_sfc_main.render = render;
_sfc_main.__file = ${JSON.stringify(file)};
_sfc_main.__hmrId = ${JSON.stringify(id)};
${descriptor.styles.some((s: any) => s.scoped) ? `_sfc_main.__scopeId = ${JSON.stringify(scope)};` : ""}
_sfc_main.__cssModules = ${JSON.stringify(classes)};
{
let style = document.querySelector('style[data-vue-id="${id}"]');
if (!style) { style = document.createElement("style"); style.dataset.vueId = ${JSON.stringify(id)}; document.head.append(style); }
const __cpStyleText = ${JSON.stringify(styles.join("\n"))};
// A template edit must not rebuild the same stylesheet or recreate its FontFace objects.
if (style.textContent !== __cpStyleText) style.textContent = __cpStyleText;
const hmr = globalThis.__VUE_HMR_RUNTIME__;
if (hmr && !hmr.createRecord(${JSON.stringify(id)}, _sfc_main)) {
  if (${JSON.stringify(change)} === "template") hmr.rerender(${JSON.stringify(id)}, _sfc_main.render);
  else if (${JSON.stringify(change)} === "script") hmr.reload(${JSON.stringify(id)}, _sfc_main);
}
}
export const __cpVueChange = ${JSON.stringify(change)};
export default _sfc_main;`;
      previous.set(file, { source, revision, script: scriptSource, template: descriptor.template?.content ?? "", code });
      return code;
    },
  };
}
