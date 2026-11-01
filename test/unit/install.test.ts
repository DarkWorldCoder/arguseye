import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { parseForESLint, getStaticTOMLValue } from "toml-eslint-parser";
import { parse } from "jsonc-parser";
import os from "node:os";
import path from "node:path";
import { install } from "../../src/install.js";

const tmp = () => mkdtempSync(path.join(os.tmpdir(), "cp-install-"));

describe("install for agent clients", () => {
  it("reinstalls Codex without corrupting arrays, comments, environment or other servers", () => {
    const home = tmp(), project = tmp();
    install({ client: "codex", project, home });
    const file = path.join(home, ".codex/config.toml");
    writeFileSync(file, '# personal settings\n' + readFileSync(file, "utf8") + '\n[mcp_servers.arguseye.env]\nKEEP = "yes"\n\n[mcp_servers.other]\ncommand = "other"\n');
    install({ client: "codex", project, home });
    install({ client: "codex", project, home });
    const text = readFileSync(file, "utf8");
    const parsed = getStaticTOMLValue(parseForESLint(text).ast) as any;
    expect(parsed.mcp_servers.arguseye.args).toEqual(["-y", "@ayushniroula/arguseye", "mcp", "--root", project]);
    expect(parsed.mcp_servers.arguseye.env).toEqual({ KEEP: "yes" });
    expect(parsed.mcp_servers.other.command).toBe("other");
    expect(text).toContain("# personal settings");
  });

  it("preserves JSONC comments, trailing commas, other servers and custom environment on reinstall", () => {
    const home = tmp(), project = tmp(), file = path.join(project, ".vscode/mcp.json");
    mkdirSync(path.dirname(file));
    writeFileSync(file, '{\n // keep this comment\n "servers": {\n  "other": {"command": "other"}, // other tool\n  "arguseye": {"env": {"KEEP": "yes"}, "command": "old",},\n },\n}\n', { mode: 0o600 });
    install({ client: "vscode", project, home });
    install({ client: "vscode", project, home });
    const text = readFileSync(file, "utf8"), config = parse(text);
    expect(text).toContain("// keep this comment");
    expect(text).toContain("// other tool");
    expect(config.servers.other.command).toBe("other");
    expect(config.servers.arguseye.env).toEqual({ KEEP: "yes" });
    expect(config.servers.arguseye.args.at(-1)).toBe(project);
    if (process.platform !== "win32") expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("validates every selected config before writing any of them", () => {
    const home = tmp(), project = tmp(), file = path.join(home, ".codex/config.toml");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'broken = ["unterminated"');
    expect(() => install({ client: "all", project, home })).toThrow(file);
    expect(readFileSync(file, "utf8")).toBe('broken = ["unterminated"');
    expect(existsSync(path.join(project, ".mcp.json"))).toBe(false);
    expect(existsSync(path.join(home, ".claude/skills/arguseye/SKILL.md"))).toBe(false);
  });

  it.each([
    '[mcp_servers."arguseye"]\ncommand = "old" # command note\nargs = [\n "old", # old argument\n]\n',
    'mcp_servers.arguseye = { command = "old", args = ["old"], env = { KEEP = "yes" } }\n',
    '[mcp_servers]\narguseye = { command = "old", args = ["old"] }\n',
    '[mcp_servers.arguseye.env]\nKEEP = "yes"\n',
  ])("updates quoted, multiline, inline and implicit TOML tables: %s", (before) => {
    const home = tmp(), project = tmp(), file = path.join(home, ".codex/config.toml");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '# top comment\n' + before);
    install({ client: "codex", project, home });
    install({ client: "codex", project, home });
    const text = readFileSync(file, "utf8"), config = getStaticTOMLValue(parseForESLint(text).ast) as any;
    expect(config.mcp_servers.arguseye.command).toBe("npx");
    expect(config.mcp_servers.arguseye.args.at(-1)).toBe(project);
    expect(text).toContain("# top comment");
    if (before.includes("# command note")) expect(text).toContain("# command note");
    if (before.includes("KEEP")) expect(config.mcp_servers.arguseye.env.KEEP).toBe("yes");
  });
  it("writes the MCP server and the skill where Claude Code, Codex and Cursor read them, merging existing config", () => {
    const home = tmp(), project = tmp();
    const steps = install({ client: "all", project, home });
    expect(steps.map((s) => path.relative(home, s.file).replace(/\\/g, "/")).filter((f) => !f.startsWith(".."))).toEqual(
      expect.arrayContaining([".claude/skills/arguseye/SKILL.md", ".codex/config.toml", ".agents/skills/arguseye/SKILL.md", ".cursor/mcp.json", ".codeium/windsurf/mcp_config.json"]),
    );
    const claude = JSON.parse(readFileSync(path.join(project, ".mcp.json"), "utf8"));
    expect(claude.mcpServers["arguseye"]).toEqual({ command: "npx", args: ["-y", "@ayushniroula/arguseye", "mcp", "--root", project] });
    expect(readFileSync(path.join(home, ".codex", "config.toml"), "utf8")).toContain("[mcp_servers.arguseye]");
    expect(readFileSync(path.join(home, ".claude", "skills", "arguseye", "SKILL.md"), "utf8")).toMatch(/^---\nname: arguseye/);
    expect(JSON.parse(readFileSync(path.join(project, ".vscode", "mcp.json"), "utf8")).servers["arguseye"].type).toBe("stdio");
    expect(existsSync(path.join(project, ".agents", "skills", "arguseye", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(project, ".github", "skills", "arguseye", "SKILL.md"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(project, ".gemini", "settings.json"), "utf8")).mcpServers["arguseye"].command).toBe("npx");
    expect(existsSync(path.join(project, ".gemini", "skills", "arguseye", "SKILL.md"))).toBe(true);

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

  it("prints a generic MCP snippet for agents without a dedicated target", () => {
    const steps = install({ client: "print", project: "/tmp/app", home: tmp(), dryRun: true });
    expect(JSON.parse(steps[0].note!).mcpServers.arguseye.args).toEqual(["-y", "@ayushniroula/arguseye", "mcp", "--root", "/tmp/app"]);
  });
});
