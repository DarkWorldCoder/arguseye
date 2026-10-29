# Install Arguseye for your agent or editor

Everything runs through one MCP server: `npx arguseye mcp` (started in the project directory, or with `--root <dir>`). The `install` command writes the server entry and the skill where each client reads them; it merges into existing config and can be run again safely.

```bash
npx arguseye install all          # every client below
npx arguseye install claude       # one client
npx arguseye install codex --project /path/to/app --dry-run
```

| Client | What `install` writes | Alternative |
|---|---|---|
| Claude Code | `.mcp.json` in the project; skill in `~/.claude/skills/arguseye` | `claude mcp add arguseye -- npx -y arguseye mcp`, or the plugin: `claude plugin marketplace add DarkWorldCoder/arguseye` then `claude plugin install arguseye` |
| Codex | `[mcp_servers.arguseye]` in `~/.codex/config.toml`; skill in `~/.agents/skills/arguseye` | `codex mcp add arguseye -- npx -y arguseye mcp` |
| Gemini CLI | `mcpServers.arguseye` in `.gemini/settings.json`; skill in `.gemini/skills/arguseye` | `gemini mcp add arguseye npx -y arguseye mcp --root .` |
| Cursor | `~/.cursor/mcp.json`; skill in `.cursor/skills/arguseye` | Settings → MCP → add the JSON |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | |
| VS Code (Copilot agent mode) | `.vscode/mcp.json` (`servers`) | |
| Antigravity (CLI and IDE) | `.agents/mcp_config.json` and `.agents/skills/arguseye` in the workspace | plugin: `agy plugin install https://github.com/DarkWorldCoder/arguseye` |

## VS Code extension (the human panel)

Marketplace listing: **Arguseye**. Cursor, Windsurf and VSCodium install the same extension from Open VSX. To install a local build: `npm run package` then `code --install-extension arguseye-*.vsix`.

## Skill only (no MCP)

The skill at `skills/arguseye/SKILL.md` follows the Agent Skills format and also works on its own: it tells the agent to use the CLI (`npx arguseye shot …`) when the MCP tools are not available. Copy it to `~/.claude/skills/`, `~/.agents/skills/` or `.cursor/skills/`.

## Verified end to end

Checked on 2026-10-29 against the React fixture, each agent calling `render_component` through the MCP server and reading back the image, the accessibility tree and `errors[]`:

| Agent | Result | Note |
|---|---|---|
| Claude Code (`claude -p … --mcp-config`) | works | allow the tools with `--allowedTools "mcp__arguseye__*"` in headless runs |
| Codex (`codex exec`) | works | non-interactive runs need `--approve-for-me` (or an interactive session) because MCP tool calls ask for approval; `-a never` refuses them |
| Gemini CLI | config written, not run | the Gemini CLI on the test machine required an Antigravity account |

