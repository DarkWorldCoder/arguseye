import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { install } from "../../src/install.js";

const tmp = () => mkdtempSync(path.join(os.tmpdir(), "cp-install-"));

describe("install for agent clients", () => {
  it("writes the MCP server and the skill where Claude Code, Codex and Cursor read them, merging existing config", () => {
    const home = tmp(), project = tmp();
    const steps = install({ client: "all", project, home });
    expect(steps.map((s) => path.relative(home, s.file).replace(/\\/g, "/")).filter((f) => !f.startsWith(".."))).toEqual(
      expect.arrayContaining([".claude/skills/arguseye/SKILL.md", ".codex/config.toml", ".agents/skills/arguseye/SKILL.md", ".cursor/mcp.json", ".codeium/windsurf/mcp_config.json"]),
    );
    const claude = JSON.parse(readFileSync(path.join(project, ".mcp.json"), "utf8"));
    expect(claude.mcpServers["arguseye"]).toEqual({ command: "npx", args: ["-y", "arguseye", "mcp", "--root", project] });
    expect(readFileSync(path.join(home, ".codex", "config.toml"), "utf8")).toContain("[mcp_servers.arguseye]");
    expect(readFileSync(path.join(home, ".claude", "skills", "arguseye", "SKILL.md"), "utf8")).toMatch(/^---\nname: arguseye/);
    expect(JSON.parse(readFileSync(path.join(project, ".vscode", "mcp.json"), "utf8")).servers["arguseye"].type).toBe("stdio");
    expect(existsSync(path.join(project, ".agents", "skills", "arguseye", "SKILL.md"))).toBe(true);

    // Running again keeps other servers and does not duplicate ours.
    const cursor = path.join(home, ".cursor", "mcp.json");
    const before = JSON.parse(readFileSync(cursor, "utf8"));
    before.mcpServers.other = { command: "x" };
    writeFileSync(cursor, JSON.stringify(before));
    install({ client: "cursor", project, home });
    const after = JSON.parse(readFileSync(cursor, "utf8"));
    expect(Object.keys(after.mcpServers).sort()).toEqual(["arguseye", "other"]);
    expect(readFileSync(path.join(home, ".codex", "config.toml"), "utf8").match(/mcp_servers\.arguseye/g)).toHaveLength(1);
  });

  it("dry run reports steps and writes nothing", () => {
    const home = tmp(), project = tmp();
    const steps = install({ client: "claude", project, home, dryRun: true });
    expect(steps.length).toBeGreaterThan(0);
    expect(existsSync(path.join(project, ".mcp.json"))).toBe(false);
  });
});
