/** Which UI runtime renders a component file. React is the default for .jsx/.tsx/.js/.ts. */
export type Framework = "react" | "vue" | "svelte";

export const frameworkOf = (file: string): Framework =>
  file.endsWith(".vue") ? "vue" : file.endsWith(".svelte") ? "svelte" : "react";

/** Single-file components: compiled by the framework's own compiler, one default export. */
export const isSingleFileComponent = (file: string) => /\.(vue|svelte)$/.test(file);
