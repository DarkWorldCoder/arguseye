# Security

Arguseye runs your project's code in a local Chromium and starts a local HTTP server bound to `127.0.0.1`. It never sends your code anywhere. Rendering a component executes that component and its imports, so treat untrusted repositories as you would when running their dev server.

## Reporting a vulnerability

Please do not open a public issue. Email tech@wiseadmit.io with the details and, if possible, a reproduction. You will get an acknowledgement within three working days and a fix or mitigation plan as soon as the issue is confirmed. Credit is given in the release notes unless you prefer otherwise.

## Scope

In scope: the `arguseye` npm package (MCP server, CLI, preview server), the VS Code extension, and the skill and plugin manifests in this repository. Out of scope: vulnerabilities in the frameworks or packages of the project being previewed.
