# Publishing Arguseye

These steps need your accounts and tokens; the repo is ready for each of them.

## 1. GitHub and the product site

The existing repository is `DarkWorldCoder/arguseye`. The Pages workflow publishes `docs/` when those files change on `main`; the public site is https://darkworldcoder.github.io/arguseye/. Repository visibility is independent of Pages and npm publication. Public guide and image links use Pages so they do not require repository access.

## 2. npm (the MCP server and CLI)

```bash
npm test
npm run typecheck
npm run package                 # validate the extension archive too
npm pack --dry-run --json        # inspect the npm file list
npm login                       # only if npm whoami is not authenticated
npm publish --access public     # runs the build first (prepublishOnly)
npm view arguseye version        # confirm registry publication
```

After this, `npx arguseye install claude` works for anyone.

## 3. VS Code Marketplace

1. Publisher `ayushniroula` exists (created 2026-10-29 at https://marketplace.visualstudio.com/manage/publishers/ayushniroula). The VSIX is 32 MB, so it has to go through `vsce`, not the web upload.
2. Create an Azure DevOps personal access token with the **Marketplace → Manage** scope.
3. Publish a platform build (the native binaries are per platform):

```bash
npx vsce login ayushniroula          # paste the token (needs an Azure DevOps org, which now needs an Azure subscription)
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

Keep `package.json`, the root entries in `package-lock.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and the versions in `server.json` aligned. Published npm versions are immutable; use a new version for later changes. Tag `v<version>` for the release workflow. The npm CI job publishes only when `NPM_TOKEN` exists; an authenticated local publish is separate from Marketplace trusted publishing.

## Done on 2026-10-29

- 0.0.1 (linux-x64) was uploaded through the Marketplace web uploader (publisher page -> New extension -> Visual Studio Code -> drop the VSIX). No token is needed for that route; the built-in browser can show the dialog but the file drop is manual.
- Future releases: a **Trusted Publishing** policy on the publisher page (repo DarkWorldCoder/arguseye, workflow `release.yml`) lets the `marketplace` job in `.github/workflows/release.yml` run `npx @vscode/vsce publish --oidc` on every `v*` tag with no PAT. The policy must see one successful run within 48 hours of being created while the repo is private.

