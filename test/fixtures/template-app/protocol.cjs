// A real project adapter exercising the public JSON-lines transport, not a built-in engine substitute.
const readline = require('node:readline');
const fs = require('node:fs');
const hb = require('handlebars');
readline.createInterface({ input: process.stdin }).on('line', async line => {
  const req = JSON.parse(line);
  if (req.props.mode === 'crash') process.exit(7);
  if (req.props.mode === 'hang') return;
  if (req.props.mode === 'invalid') return console.log(JSON.stringify({v:1,id:req.id,html:'bad'}));
  const source = req.overlays[req.file] ?? fs.readFileSync(req.file, 'utf8');
  console.log(JSON.stringify({ v:1, id:req.id, html:hb.compile(source)(req.props), dependencies:[req.file], errors:[], warnings:[], unresolved:[], engineVersion:hb.VERSION, runtimeVersion:process.version }));
});
