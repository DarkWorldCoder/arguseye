/** Project-owned Node template engines; no framework or compiler is substituted by Arguseye. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as moduleHooks from 'node:module';
const modules = new Map(), cache = new Map(), environments = new Map();
let context;
const inside = (root, file) => { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
const read = (file, code = false) => {
  file = path.resolve(file);
  let physical;
  try { physical = fs.realpathSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; physical = path.join(fs.realpathSync(path.dirname(file)), path.basename(file)); }
  if (!(code ? [fs.realpathSync(context.root)] : context.roots).some(root => inside(root, physical))) throw new Error('Template include is outside approved roots: ' + file);
  const source = Object.hasOwn(context.overlays, file) ? context.overlays[file] : fs.readFileSync(file, 'utf8');
  if (Buffer.byteLength(source) > 1024 * 1024) throw new Error('Template source exceeds 1 MiB: ' + file);
  context.dependencies.add(file);
  context.sources[file] = createHash("sha256").update(source).digest("hex");
  return source;
};
// Native Node hooks retain actual module resolution while replacing unsaved project setup sources.
moduleHooks.registerHooks?.({ load(url, options, next) {
  const loaded = next(url, options);
  if (!context?.setup || !url.startsWith('file:')) return loaded;
  const file = fileURLToPath(new URL(url));
  if (!inside(context.root, file) || file.includes(path.sep + 'node_modules' + path.sep)) return loaded;
  const source = read(file, true);
  return Object.hasOwn(context.overlays, file) ? { ...loaded, source, shortCircuit: true } : loaded;
} });
const locate = (name, parent, extensions = []) => {
  const candidates = [path.resolve(parent ? path.dirname(parent) : context.dirs[0], name), ...context.dirs.map(dir => path.resolve(dir, name))];
  for (const file of candidates) for (const extension of ['', ...extensions]) {
    try { read(file + extension); return file + extension; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('Template not found: ' + name + (parent ? ' from ' + parent : ''));
};
const compiled = (key, build, primary = context.file) => {
  const cached = cache.get(key);
  if (cached && cached.sources.every(([file, source]) => read(file) === source)) return cached.value;
  const before = new Set(context.dependencies), value = build();
  const files = [...context.dependencies].filter(file => !before.has(file)); files.push(primary);
  cache.set(key, { value, sources: [...new Set(files)].flatMap(file => { try { return [[file, read(file)]]; } catch (error) { if (error.code !== 'ENOENT') throw error; return []; } }) });
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return value;
};
async function moduleAt(file) {
  if (!modules.has(file)) modules.set(file, await import(pathToFileURL(file).href));
  const mod = modules.get(file); return mod.default ?? mod;
}
const trace = (object, prefix = '') => object && typeof object === 'object' ? new Proxy(object, {
  get(target, key, receiver) {
    if (typeof key === 'string' && !Reflect.has(target, key) && !['then','toHTML','toJSON'].includes(key)) context.unresolved.add(prefix + key);
    const value = Reflect.get(target, key, receiver);
    return typeof key === 'string' && value && typeof value === 'object' ? trace(value, prefix + key + '.') : value;
  },
  getOwnPropertyDescriptor(target, key) {
    if (typeof key === 'string' && !Reflect.has(target, key)) context.unresolved.add(prefix + key);
    return Reflect.getOwnPropertyDescriptor(target, key);
  }
}) : object;
async function render(req) {
  context = { ...req, sources: {}, dependencies: new Set(), unresolved: new Set() };
  const native = await moduleAt(req.engineEntry), source = read(req.file), options = req.options ?? {};
  let helpers = {};
  if (req.setup) {
    read(req.setup, true);
    if (!moduleHooks.registerHooks && Object.keys(req.overlays).some(file => /\.[cm]?js$/.test(file))) throw new Error('Unsaved native setup requires Node 22.15+ module hooks; save helper edits or upgrade Node.');
    const require = createRequire(req.setup);
    for (const key of Object.keys(require.cache)) if (inside(req.root, key) && !key.includes(path.sep + 'node_modules' + path.sep)) delete require.cache[key];
    const setup = await import(pathToFileURL(req.setup).href + '?request=' + req.id);
    helpers = await (setup.default ?? setup.setup)?.(req.engine) ?? {};
  }
  let html, tracing = true;
  const data = trace({ ...(helpers.globals ?? {}), ...req.props });
  const key = req.engine + ':' + req.file + ':' + JSON.stringify(options);
  if (req.engine === 'handlebars') {
    const hb = native.create();
    for (const [name, helper] of Object.entries(helpers.helpers ?? {})) hb.registerHelper(name, helper);
    const compile = (file) => {
      const text = read(file);
      const spec = compiled('hbs:' + file + ':' + createHash('sha256').update(text).digest('hex'), () => new Function('return (' + hb.precompile(text, options) + ')')(), file);
      return hb.template(spec);
    };
    const registered = Object.create(null);
    for (const [name, file] of Object.entries(options.partials ?? {})) {
      if (typeof file !== 'string') throw new Error('Handlebars partial alias must name a project file: ' + name);
      registered[name] = (locals, partialOptions) => compile(locate(file, path.join(req.root, '_')))(locals, partialOptions);
    }
    for (const [name, partial] of Object.entries(helpers.partials ?? {})) registered[name] = partial;
    hb.partials = new Proxy(registered, { get(target, name) {
      if (Object.hasOwn(target, name)) return target[name];
      if (typeof name !== 'string' || name === 'then' || name === '__proto__' || name === 'constructor' || name === '@partial-block') return Reflect.get(target, name);
      return (locals, partialOptions) => compile(locate(name, req.file, ['.hbs', '.handlebars']))(locals, partialOptions);
    }, getOwnPropertyDescriptor(target, name) { if (typeof name === 'string' && !['then','__proto__','constructor','@partial-block'].includes(name)) return { configurable: true, enumerable: false, writable: false, value: hb.partials[name] }; return Reflect.getOwnPropertyDescriptor(target, name); } });
    html = compile(req.file)(data);
  } else if (req.engine === 'mustache') {
    html = native.render(source, data, name => read(locate(name, req.file, ['.mustache'])), options);
  } else if (req.engine === 'ejs') {
    const loader = native.fileLoader;
    try {
      native.fileLoader = file => read(file);
      html = compiled(key, () => native.compile(source, { ...options, filename: req.file, includer: (name, filename) => {
        const file = locate(name, filename ?? req.file, ['.ejs']); return { filename: file, template: read(file) };
      } }))(data);
    } finally { native.fileLoader = loader; }
  } else if (req.engine === 'pug') {
    html = compiled(key, () => native.compile(source, { ...options, filename: req.file, basedir: req.dirs[0], filters: helpers.filters ?? options.filters, plugins: [{ read: read, resolve: (name, from) => locate(name.startsWith('/') ? '.' + name : name, name.startsWith('/') ? path.join(req.dirs[0], '_') : from, ['.pug']) }] }))(data);
  } else if (req.engine === 'nunjucks') {
    let env = req.setup ? undefined : environments.get(key);
    if (!env) {
      class Loader extends native.Loader {
        getSource(name) { const file = locate(name, req.file, ['.njk']); return { src: read(file), path: file, noCache: true }; }
        isRelative(name) { return name.startsWith('.'); }
        resolve(parent, name) { return locate(name, parent, ['.njk']); }
      }
      env = new native.Environment(new Loader(), { autoescape: true, ...options });
      for (const [name, filter] of Object.entries(helpers.filters ?? {})) env.addFilter(name, filter);
      for (const [name, value] of Object.entries(helpers.globals ?? {})) env.addGlobal(name, value);
      if (!req.setup) { environments.set(key, env); if (environments.size > 16) environments.delete(environments.keys().next().value); }
    }
    html = await new Promise((resolve, reject) => env.render(req.file, data, (error, result) => error ? reject(error) : resolve(result)));
  } else if (req.engine === 'liquidjs') {
    const { Liquid } = await import(pathToFileURL(req.engineEntry).href);
    const env = new Liquid({ ...options, root: req.dirs, partials: req.dirs, layouts: req.dirs, fs: {
      readFile: async file => read(file), readFileSync: read,
      exists: async file => { try { read(file); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; } },
      existsSync: file => { try { read(file); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; } },
      resolve: (dir, name, ext) => path.resolve(dir, name + (path.extname(name) ? '' : ext)), dirname: path.dirname,
      containsSync: (dir, file) => inside(fs.realpathSync(dir), fs.realpathSync(file)), contains: async (dir, file) => inside(fs.realpathSync(dir), fs.realpathSync(file)), sep: path.sep
    }, extname: '.liquid' });
    for (const [name, filter] of Object.entries(helpers.filters ?? {})) env.registerFilter(name, filter);
    html = await env.renderFile(req.file, data);
  } else if (req.engine === 'eta') {
    const env = new native.Eta({ views: req.dirs[0], useWith: true, ...options });
    env.readFile = file => read(file);
    html = env.renderString(source, data); tracing = false;
  } else if (req.engine === 'dot') {
    html = compiled(key, () => native.template(source, { ...native.templateSettings, ...options }))(data);
  } else throw new Error('Unsupported Node template engine: ' + req.engine);
  let directory = path.dirname(req.engineEntry), version = 'unknown';
  while (directory !== path.dirname(directory)) { const file = path.join(directory, 'package.json'); if (fs.existsSync(file)) { version = JSON.parse(fs.readFileSync(file, 'utf8')).version; break; } directory = path.dirname(directory); }
  return { html: String(html), engineVersion: version, runtimeVersion: process.version, unresolved: [...context.unresolved], warnings: tracing ? [] : ['Template context lookup tracing is unavailable for ' + req.engine + '; review supplied context.'] };
}
// Engine setup logging must not corrupt the reserved JSON-lines transport.
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  let req;
  try {
    req = JSON.parse(line);
    const result = await render(req);
    process.stdout.write(JSON.stringify({ v: 1, id: req.id, ...result, dependencies: [...context.dependencies], sources: context.sources, errors: [] }) + '\n');
  } catch (error) { process.stdout.write(JSON.stringify({ v: 1, id: req?.id, html: '', warnings: [], unresolved: [], dependencies: [...(context?.dependencies ?? [])], errors: [req?.file + ': ' + (error.stack ?? error)] }) + '\n'); }
}
