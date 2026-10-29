# Publishing Arguseye

These steps need your accounts and tokens; the repo is ready for each of them.

## 1. GitHub (first push)

```bash
gh repo create DarkWorldCoder/arguseye --public --source . --remote origin --push \
  --description "Eyes for coding agents: render any React, Next.js or Vue component exactly as in the app, no dev server. MCP + CLI + VS Code."
```

Then on github.com → repo → Settings → General → Social preview → upload `assets/social-preview.png` (1280×640). Add topics: `mcp`, `claude-code`, `codex`, `cursor`, `react`, `nextjs`, `vue`, `component-preview`, `ai-agents`.

## 2. npm (the MCP server and CLI)

```bash
npm login
npm publish --access public     # runs the build first (prepublishOnly)
```

After this, `npx arguseye install claude` works for anyone.

## 3. VS Code Marketplace

1. Create a publisher named `ayushniroula` at https://marketplace.visualstudio.com/manage (one time).
2. Create an Azure DevOps personal access token with the **Marketplace → Manage** scope.
3. Publish a platform build (the native binaries are per platform):

```bash
npx vsce login ayushniroula          # paste the token
npm run package                      # arguseye-linux-x64-<version>.vsix
npx vsce publish --packagePath arguseye-linux-x64-*.vsix
```

For macOS and Windows builds, run `npm ci && npm run package` on each platform (or in CI with a matrix) and publish each VSIX; `vsce` marks them by `--target`.

## 4. Open VSX (Cursor, Windsurf, VSCodium)

```bash
npx ovsx create-namespace ayushniroula -p <open-vsx-token>   # one time
npx ovsx publish arguseye-linux-x64-*.vsix -p <open-vsx-token>
```

## 5. Claude Code plugin marketplace

Nothing to upload: the repo is the marketplace. Users run `claude plugin marketplace add DarkWorldCoder/arguseye` then `claude plugin install arguseye`. `claude plugin validate .` passes.

## 6. Antigravity

`agy plugin install https://github.com/DarkWorldCoder/arguseye` works once the repo is public (the repo root holds `plugin.json`, `mcp_config.json` and `skills/`).

## Versioning

Bump `version` in `package.json` and in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` together; tag `v<version>`.
