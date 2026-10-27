import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Env files in the order Next reads them for development: the first file that sets a variable wins. */
const ENV_FILES = [".env.development.local", ".env.local", ".env.development", ".env"];
const PUBLIC_PREFIXES = ["NEXT_PUBLIC_"];

/** Variables the app's own build would expose to the browser, from the project's env files. Nothing else leaves disk. */
export function publicEnv(root: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of ENV_FILES) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const [key, value] of Object.entries(parseDotenv(readFileSync(file, "utf8")))) {
      if (PUBLIC_PREFIXES.some((p) => key.startsWith(p)) && !(key in env)) env[key] = value;
    }
  }
  return env;
}

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    const quoted = value.match(/^(["'`])(.*)\1$/s);
    if (quoted) value = quoted[2].replace(/\\n/g, "\n");
    else value = value.replace(/\s+#.*$/, "");
    out[match[1]] = value;
  }
  return out;
}
