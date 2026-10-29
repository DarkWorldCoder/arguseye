import { parseSync } from "oxc-parser";
import type { ResolverFactory } from "oxc-resolver";

/**
 * Packages whose index re-exports hundreds of modules: importing one member from the barrel would make the page
 * load all of them. Next.js rewrites these at build time (optimizePackageImports); the preview does the same.
 */
const BARRELS: Record<string, (member: string) => string> = {
  "@mui/icons-material": (m) => `@mui/icons-material/${m}`,
  "@mui/material": (m) => `@mui/material/${m}`,
  "@mui/lab": (m) => `@mui/lab/${m}`,
  lodash: (m) => `lodash/${m}`,
  "date-fns": (m) => `date-fns/${m}`,
  "@tabler/icons-react": (m) => `@tabler/icons-react/dist/esm/icons/${m}`,
};

/** Rewrites `import { A, B as C } from "<barrel>"` into one import per member, when the member module exists. */
export function modularizeBarrelImports(file: string, source: string, resolver: ResolverFactory): string {
  if (!Object.keys(BARRELS).some((pkg) => source.includes(`"${pkg}"`) || source.includes(`'${pkg}'`))) return source;
  let module;
  try {
    ({ module } = parseSync(file, source));
  } catch {
    return source;
  }
  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const imp of module.staticImports) {
    const pkg = imp.moduleRequest.value;
    const target = BARRELS[pkg];
    if (!target || !imp.entries.length) continue;
    // Only `import { Name }` forms; a default or namespace import stays as written.
    if (imp.entries.some((e) => e.importName.kind !== "Name" || e.isType)) continue;
    const lines: string[] = [];
    for (const entry of imp.entries) {
      const member = entry.importName.name!;
      const spec = target(member);
      if (!resolver.resolveFileSync(file, spec).path) { lines.length = 0; break; }
      lines.push(`import ${entry.localName.value} from ${JSON.stringify(spec)};`);
    }
    if (lines.length) edits.push({ start: imp.start, end: imp.end, text: lines.join(" ") });
  }
  if (!edits.length) return source;
  let out = "";
  let last = 0;
  for (const edit of edits.sort((a, b) => a.start - b.start)) {
    out += source.slice(last, edit.start) + edit.text;
    last = edit.end;
  }
  return out + source.slice(last);
}
