import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Client = "claude" | "codex" | "cursor" | "windsurf" | "vscode" | "antigravity";
export const CLIENTS: Client[] = ["claude", "codex", "cursor", "windsurf", "vscode", "antigravity"];

export type InstallOptions = {
  client: Client | "all";
  /** The project to preview; the MCP server is started with `--root` here. */
  project: string;
  /** Home directory to write user-level config into (tests pass a temp dir). */
  home?: string;
  dryRun?: boolean;
};

export type InstallStep = { file: string; action: "write" | "merge" | "copy"; note?: string };

const SERVER = { command: "npx", args: ["-y", "component-preview", "mcp", "--root"] };
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Writes the MCP server entry and the skill where each client reads them, merging into existing config files.
 * Returns what was (or would be) written, so the caller can show it.
 */
export function install({ client, project, home = os.homedir(), dryRun = false }: InstallOptions): InstallStep[] {
  const clients = client === "all" ? CLIENTS : [client];
  const root = path.resolve(project);
  const steps: InstallStep[] = [];
  const server = { command: SERVER.command, args: [...SERVER.args, root] };
  const skillSource = path.join(PACKAGE_ROOT, "skills", "component-preview");

  const writeJsonMerge = (file: string, mutate: (json: any) => void, note?: string) => {
    const current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    mutate(current);
    steps.push({ file, action: existsSync(file) ? "merge" : "write", note });
    if (!dryRun) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(current, null, 2) + "\n");
    }
  };
  const copySkill = (dir: string, note?: string) => {
    steps.push({ file: path.join(dir, "SKILL.md"), action: "copy", note });
    if (!dryRun) {
      mkdirSync(dir, { recursive: true });
      cpSync(skillSource, dir, { recursive: true });
    }
  };

  for (const c of clients) {
    switch (c) {
      case "claude":
        // Project-scoped MCP config Claude Code reads; the skill goes to the user's skills directory.
        writeJsonMerge(path.join(root, ".mcp.json"), (j) => { j.mcpServers ??= {}; j.mcpServers["component-preview"] = server; }, "Claude Code reads .mcp.json in the project");
        copySkill(path.join(home, ".claude", "skills", "component-preview"), "user skill for Claude Code");
        break;
      case "codex": {
        const file = path.join(home, ".codex", "config.toml");
        const current = existsSync(file) ? readFileSync(file, "utf8") : "";
        const block = `\n[mcp_servers.component-preview]\ncommand = ${JSON.stringify(server.command)}\nargs = ${JSON.stringify(server.args)}\n`;
        const next = current.includes("[mcp_servers.component-preview]")
          ? current.replace(/\n\[mcp_servers\.component-preview\][^[]*/s, block)
          : current + block;
        steps.push({ file, action: current ? "merge" : "write", note: "Codex reads ~/.codex/config.toml" });
        if (!dryRun) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, next); }
        copySkill(path.join(home, ".agents", "skills", "component-preview"), "Codex (and Antigravity) read ~/.agents/skills");
        break;
      }
      case "cursor":
        writeJsonMerge(path.join(home, ".cursor", "mcp.json"), (j) => { j.mcpServers ??= {}; j.mcpServers["component-preview"] = { type: "stdio", ...server }; }, "Cursor reads ~/.cursor/mcp.json");
        copySkill(path.join(root, ".cursor", "skills", "component-preview"), "Cursor reads project skills from .cursor/skills");
        break;
      case "windsurf":
        writeJsonMerge(path.join(home, ".codeium", "windsurf", "mcp_config.json"), (j) => { j.mcpServers ??= {}; j.mcpServers["component-preview"] = server; }, "Windsurf reads ~/.codeium/windsurf/mcp_config.json");
        break;
      case "vscode":
        writeJsonMerge(path.join(root, ".vscode", "mcp.json"), (j) => { j.servers ??= {}; j.servers["component-preview"] = { type: "stdio", ...server }; }, "VS Code (Copilot agent mode) reads .vscode/mcp.json");
        break;
      case "antigravity":
        writeJsonMerge(path.join(root, ".agents", "mcp_config.json"), (j) => { j.mcpServers ??= {}; j.mcpServers["component-preview"] = server; }, "Antigravity reads .agents/mcp_config.json in the workspace");
        copySkill(path.join(root, ".agents", "skills", "component-preview"), "Antigravity and Codex read .agents/skills in the repo");
        break;
    }
  }
  return steps;
}
