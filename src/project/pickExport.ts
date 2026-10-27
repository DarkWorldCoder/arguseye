import { parseSync } from "oxc-parser";

/** Names of the value exports in a module, `"default"` first when present. */
export function listExports(file: string, source: string): string[] {
  if (file.endsWith(".vue")) return ["default"];
  const { module } = parseSync(file, source);
  const names = new Set<string>();
  for (const exp of module.staticExports) {
    for (const entry of exp.entries) {
      if (entry.isType) continue;
      if (entry.exportName.kind === "Default") names.add("default");
      else if (entry.exportName.kind === "Name" && entry.exportName.name) names.add(entry.exportName.name);
    }
  }
  return [...names].sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : 0));
}

/** The export a file most likely means as "its component": the default, else the first PascalCase name. */
export function pickExport(file: string, source: string): string | undefined {
  const names = listExports(file, source);
  return names.includes("default") ? "default" : names.find((n) => /^[A-Z]/.test(n)) ?? names[0];
}
