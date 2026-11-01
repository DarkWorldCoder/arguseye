import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { parseTOML, getStaticTOMLValue, type AST } from "toml-eslint-parser";

type Server = { command: string; args: string[]; type?: string };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const names = (key: AST.TOMLKey) => key.keys.map((part) => part.type === "TOMLBare" ? part.name : part.value);

/** Updates only our server fields, preserving the user's comments and unrelated configuration. */
export function editAgentConfig(source: string, format: "toml" | "mcpServers" | "servers", server: Server): string {
  if (format !== "toml") {
    const errors: ParseError[] = [];
    const current = parse(source || "{}", errors, { allowTrailingComma: true });
    if (errors.length || !object(current)) throw new Error("invalid JSONC object");
    if (current[format] !== undefined && !object(current[format])) throw new Error(`${format} must be an object`);
    const entry = (current[format] as Record<string, unknown> | undefined)?.arguseye;
    if (entry !== undefined && !object(entry)) throw new Error("arguseye must be an object");
    let next = source || "{}";
    for (const [key, value] of Object.entries(server)) {
      next = applyEdits(next, modify(next, [format, "arguseye", key], value, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: source.includes("\r\n") ? "\r\n" : "\n" } }));
    }
    return next.endsWith("\n") ? next : next + "\n";
  }

  let next = source.trim() ? source : "[mcp_servers.arguseye]\n";
  for (const [key, value] of Object.entries(server)) {
    const ast = parseTOML(next);
    const current = getStaticTOMLValue(ast) as Record<string, unknown>;
    if (current.mcp_servers !== undefined && !object(current.mcp_servers)) throw new Error("mcp_servers must be a table");
    const entry = (current.mcp_servers as Record<string, unknown> | undefined)?.arguseye;
    if (entry !== undefined && !object(entry)) throw new Error("arguseye must be a table");
    const wanted = ["mcp_servers", "arguseye", key];
    let found: AST.TOMLKeyValue | undefined;
    let inline: { node: AST.TOMLInlineTable; path: string[] } | undefined;
    let table: AST.TOMLTable | undefined;
    const prefix = (parts: string[]) => parts.every((part, i) => wanted[i] === part);
    const walk = (nodes: (AST.TOMLKeyValue | AST.TOMLTable)[], base: string[]) => {
      for (const node of nodes) {
        if (node.type === "TOMLTable") {
          const parts = node.resolvedKey.map(String);
          if (prefix(parts) && (!table || parts.length > table.resolvedKey.length)) table = node;
          walk(node.body, parts);
        } else {
          const parts = [...base, ...names(node.key)];
          if (parts.length === wanted.length && prefix(parts)) found = node;
          if (node.value.type === "TOMLInlineTable" && prefix(parts)) { inline = { node: node.value, path: parts }; walk(node.value.body, parts); }
        }
      }
    };
    walk(ast.body[0].body, []);
    const content = JSON.stringify(value);
    if (found) {
      const [start, end] = (found as AST.TOMLKeyValue).value.range;
      next = next.slice(0, start) + content + next.slice(end);
    } else if (inline) {
      const { node, path } = inline as { node: AST.TOMLInlineTable; path: string[] };
      const at = node.range[1] - 1;
      next = next.slice(0, at) + (node.body.length ? ", " : "") + wanted.slice(path.length).join(".") + " = " + content + next.slice(at);
    } else {
      const parent = table as AST.TOMLTable | undefined;
      const end = parent ? next.indexOf("\n", parent.key.range[1]) : -1;
      const at = parent ? (end < 0 ? next.length : end + 1) : 0;
      const eol = source.includes("\r\n") ? "\r\n" : "\n";
      const line = wanted.slice(parent?.resolvedKey.length ?? 0).join(".") + " = " + content + eol;
      next = next.slice(0, at) + (at && next[at - 1] !== "\n" ? eol : "") + line + next.slice(at);
    }
  }
  parseTOML(next); // No partially valid config reaches disk, even for uncommon table spellings.
  return next;
}
