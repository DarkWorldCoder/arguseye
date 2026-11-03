import { readFileSync, writeFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const inventory = JSON.parse(readFileSync('src/project/templateEngines.json', 'utf8'));
const extensions = [...new Set(['tsx', 'jsx', 'vue', 'svelte', 'html', 'js', 'mjs', 'cjs', 'tpl', ...Object.values(inventory).flatMap(entry => entry.suffixes.map(suffix => suffix.split('.').at(-1)))])];
const when = 'isWorkspaceTrusted && resourceScheme == file && !explorerResourceIsFolder && resourceExtname =~ /\\.(' + extensions.join('|') + ')$/';
for (const entries of Object.values(pkg.contributes.menus)) for (const entry of entries) if (entry.command === 'componentPreview.open') entry.when = when;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
