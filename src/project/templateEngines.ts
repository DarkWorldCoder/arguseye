import engines from "./templateEngines.json" with { type: "json" };

/** Native engine identities and suffixes shared by discovery, rendering and editor actions. */
export const TEMPLATE_ENGINES = engines;
/** Built-in engine IDs remain distinct even when they share template syntax. */
export type TemplateEngine = keyof typeof TEMPLATE_ENGINES;

const suffixes = (Object.entries(TEMPLATE_ENGINES) as Array<[TemplateEngine, typeof TEMPLATE_ENGINES[TemplateEngine]]>)
  .flatMap(([engine, info]) => info.suffixes.map((suffix) => ({ engine, suffix })))
  .sort((a, b) => b.suffix.length - a.suffix.length);

/** The most specific suffix wins; ambiguous HTML/TPL is selected by project configuration. */
export const engineForSuffix = (file: string): TemplateEngine | undefined => suffixes.find(({ suffix }) => file.toLowerCase().endsWith(suffix))?.engine;
/** Template-like files participate in discovery even when their engine needs an explicit selection. */
export const isTemplateFile = (file: string) => !!engineForSuffix(file) || file.endsWith(".tpl");
/** Known component/document targets, including classic website widgets. */
export const isPreviewable = (file: string) => /\.(tsx|jsx|vue|svelte|html|[cm]?js)$/.test(file) || isTemplateFile(file);
