import { parse, serialize } from "parse5";
import path from "node:path";
import { rawUrl, rewriteCssUrls } from "./assets.js";

/**
 * A classic script keeps its place in the document as an inert placeholder (`data-cp-script`), so it runs where it
 * was written, with its own attributes (`document.currentScript.dataset`). `url` is absent for inline scripts.
 */
export type ClassicScript = { kind: "classic"; src?: string; url?: string; text?: string; attrs: Record<string, string> };
export type HtmlDocument = { html: string; scripts: Array<{ kind: "module"; url: string } | ClassicScript>; styles: string[]; warnings: string[] };

/** Parses actual HTML instead of mounting it through JSX; scripts are loaded through the same project resolver. */
export function compileHtml(file: string, source: string, moduleUrl: (specifier: string) => string, inlineUrl: (index: number, source: string) => string, classicUrl: (src: string) => string): HtmlDocument {
  const document = parse(source), scripts: HtmlDocument["scripts"] = [], styles: string[] = [], warnings: string[] = [];
  const external = (url: string) => /^(https?:|data:|\/\/|#)/.test(url);
  let index = 0;
  const visit = (node: any) => {
    const attr = (name: string) => node.attrs?.find((a: any) => a.name === name)?.value;
    if (node.tagName === "script") {
      const type = attr("type");
      if (type && type !== "module" && !/javascript|ecmascript/.test(type)) return false; // JSON-LD/data, not executable.
      const src = attr("src"), text = node.childNodes?.map((c: any) => c.value ?? "").join("") ?? "";
      if (type === "module") { scripts.push({ kind: "module", url: src ? external(src) ? src : moduleUrl(src) : inlineUrl(index++, text) }); return true; }
      const attrs = Object.fromEntries(node.attrs.filter((a: any) => a.name !== "src").map((a: any) => [a.name, a.value]));
      scripts.push({ kind: "classic", attrs, ...(src ? { src, url: external(src) ? src : classicUrl(src) } : { text }) });
      node.attrs = [{ name: "type", value: "arguseye/classic" }, { name: "data-cp-script", value: String(scripts.length - 1) }];
      node.childNodes = [];
      return false;
    }
    if (node.tagName === "link" && attr("rel") === "stylesheet") {
      const href = attr("href"); if (href) styles.push(external(href) ? href : moduleUrl(href)); return true;
    }
    if (node.tagName === "style") for (const text of node.childNodes ?? []) {
      if (text.value?.includes("@import")) warnings.push("Inline HTML style @import is not reconstructed; move imports to a linked stylesheet.");
      if (text.value) text.value = rewriteCssUrls(text.value, file);
    }
    for (const attribute of node.attrs ?? []) {
      if (["src", "poster"].includes(attribute.name) && attribute.value && !external(attribute.value) && !attribute.value.startsWith("/")) attribute.value = rawUrl(path.resolve(path.dirname(file), attribute.value));
      if (attribute.name === "srcset" && attribute.value && !external(attribute.value)) warnings.push("Relative HTML srcset candidates require absolute/public URLs in this adapter.");
    }
    node.childNodes = (node.childNodes ?? []).filter((child: any) => !visit(child));
    return false;
  };
  visit(document);
  return { html: serialize(document), scripts, styles, warnings: [...new Set(warnings)] };
}
