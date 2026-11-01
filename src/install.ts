import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, realpathSync, statSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { editAgentConfig } from "./editAgentConfig.js";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Client = "claude" | "codex" | "gemini" | "cursor" | "windsurf" | "vscode" | "antigravity" | "copilot" | "print";
export const CLIENTS: Client[] = ["claude", "codex", "gemini", "cursor", "windsurf", "vscode", "antigravity", "copilot", "print"];

/** The MCP server entry any client can use, as JSON, for agents without a dedicated target (OpenCode, Cline, Roo, Amp…). */
export function mcpSnippet(project: string): string {
  return JSON.stringify({ mcpServers: { arguseye: { command: SERVER.command, args: [...SERVER.args, path.resolve(project)] } } }, null, 2);
}

export type InstallOptions = {
  client: Client | "all";
  /** The project to preview; the MCP server is started with `--root` here. */
  project: string;
  /** Home directory to write user-level config into (tests pass a temp dir). */
  home?: string;
  dryRun?: boolean;
};

export type InstallStep = { file: string; action: "write" | "merge" | "copy"; note?: string };

const SERVER = { command: "npx", args: ["-y", "@ayushniroula/arguseye", "mcp", "--root"] };
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Writes the MCP server entry and the skill where each client reads them, merging into existing config files.
 * Returns what was (or would be) written, so the caller can show it.
 */
export function install({ client, project, home = os.homedir(), dryRun = false }: InstallOptions): InstallStep[] {
  const clients = client === "all" ? CLIENTS.filter((c) => c !== "print") : [client];
  const root = path.resolve(project);
  const steps: InstallStep[] = [];
  const server = { command: SERVER.command, args: [...SERVER.args, root] };
  const skillSource = path.join(PACKAGE_ROOT, "skills", "arguseye");
  const writes = new Map<string, string>();
  const copies: string[] = [];

  const config = (file: string, format: "toml" | "mcpServers" | "servers", entry: { command: string; args: string[]; type?: string } = server, note?: string) => {
    const current = writes.get(file) ?? (existsSync(file) ? readFileSync(file, "utf8") : "");
    try { writes.set(file, editAgentConfig(current, format, entry)); }
    catch { throw new Error(`Cannot update ${file}: invalid ${format === "toml" ? "TOML" : "JSONC"} or server configuration. Fix this file and retry; no configuration was written.`); }
    steps.push({ file, action: existsSync(file) ? "merge" : "write", note });
  };
  const copySkill = (dir: string, note?: string) => {
    steps.push({ file: path.join(dir, "SKILL.md"), action: "copy", note });
    copies.push(dir);
  };

  for (const c of clients) {
    switch (c) {
      case "claude":
        // Project-scoped MCP config Claude Code reads; the skill goes to the user's skills directory.
        config(path.join(root, ".mcp.json"), "mcpServers", server, "Claude Code reads .mcp.json in the project");
        copySkill(path.join(home, ".claude", "skills", "arguseye"), "user skill for Claude Code");
        break;
      case "codex": {
        const file = path.join(home, ".codex", "config.toml");
        config(file, "toml", server, "Codex reads ~/.codex/config.toml");
        copySkill(path.join(home, ".agents", "skills", "arguseye"), "Codex (and Antigravity) read ~/.agents/skills");
        break;
      }
      case "gemini":
        // Gemini CLI reads project settings from .gemini/settings.json (merged with ~/.gemini/settings.json) and skills from .gemini/skills.
        config(path.join(root, ".gemini", "settings.json"), "mcpServers", server, "Gemini CLI reads .gemini/settings.json in the project");
        copySkill(path.join(root, ".gemini", "skills", "arguseye"), "Gemini CLI reads project skills from .gemini/skills");
        break;
      case "cursor":
        config(path.join(home, ".cursor", "mcp.json"), "mcpServers", { type: "stdio", ...server }, "Cursor reads ~/.cursor/mcp.json");
        copySkill(path.join(root, ".cursor", "skills", "arguseye"), "Cursor reads project skills from .cursor/skills");
        break;
      case "windsurf":
        config(path.join(home, ".codeium", "windsurf", "mcp_config.json"), "mcpServers", server, "Windsurf reads ~/.codeium/windsurf/mcp_config.json");
        break;
      case "vscode":
        config(path.join(root, ".vscode", "mcp.json"), "servers", { type: "stdio", ...server }, "VS Code (Copilot agent mode) reads .vscode/mcp.json");
        break;
      case "copilot":
        // GitHub Copilot (coding agent and VS Code) reads repository skills from .github/skills and MCP from .vscode/mcp.json.
        copySkill(path.join(root, ".github", "skills", "arguseye"), "Copilot reads .github/skills in the repo");
        config(path.join(root, ".vscode", "mcp.json"), "servers", { type: "stdio", ...server }, "VS Code / Copilot read .vscode/mcp.json");
        break;
      case "print":
        steps.push({ file: "(stdout)", action: "write", note: mcpSnippet(root) });
        break;
      case "antigravity":
        config(path.join(root, ".agents", "mcp_config.json"), "mcpServers", server, "Antigravity reads .agents/mcp_config.json in the workspace");
        copySkill(path.join(root, ".agents", "skills", "arguseye"), "Antigravity and Codex read .agents/skills in the repo");
        break;
    }
  }
  if (!dryRun) {
    for (const [file, text] of writes) {
      // Follow existing config symlinks, but replace the target atomically on the same filesystem.
      const target = existsSync(file) ? realpathSync(file) : file;
      mkdirSync(path.dirname(target), { recursive: true });
      const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
      try {
        writeFileSync(temp, text, { flag: "wx", mode: existsSync(target) ? statSync(target).mode & 0o777 : 0o600 });
        renameSync(temp, target);
      } finally { rmSync(temp, { force: true }); }
    }
    for (const dir of copies) { mkdirSync(dir, { recursive: true }); cpSync(skillSource, dir, { recursive: true }); }
  }
  return steps;
}
