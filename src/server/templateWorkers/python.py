"""Native project template runtime; stdout is reserved for versioned JSON replies."""
import importlib.abc, importlib.machinery
import contextlib, hashlib, importlib, importlib.metadata, importlib.util, json, os, pathlib, sys, traceback, types
current = None
compiled = {}
environments = {}

def read(file, code=False):
    file = os.path.abspath(file)
    current['dependencies'].add(file)
    physical = os.path.realpath(file)
    if not any(os.path.commonpath([root, physical]) == root for root in ([os.path.realpath(current['root'])] if code else current['roots'])):
        raise PermissionError('Template include is outside approved roots: ' + file)
    text = current['overlays'][file] if file in current['overlays'] else pathlib.Path(file).read_text(encoding='utf-8')
    if len(text.encode('utf-8')) > 1048576: raise ValueError('Template source exceeds 1 MiB: ' + file)
    current['sources'][file] = hashlib.sha256(text.encode('utf-8')).hexdigest()
    return text

class OverlayLoader(importlib.machinery.SourceFileLoader):
    def get_code(self, fullname): return compile(read(self.path, code=True), self.path, 'exec')
class OverlayFinder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if not current or not current.get('setup'): return None
        spec = importlib.machinery.PathFinder.find_spec(fullname, path)
        origin = spec.origin if spec else None
        if not origin or not origin.endswith('.py') or not os.path.realpath(origin).startswith(os.path.realpath(current['root']) + os.sep) or '.venv' + os.sep in origin: return None
        return importlib.util.spec_from_file_location(fullname, origin, loader=OverlayLoader(fullname, origin), submodule_search_locations=spec.submodule_search_locations)
sys.meta_path.insert(0, OverlayFinder())

def locate(name, parent=None):
    dirs = ([os.path.dirname(parent)] if parent else []) + current['dirs']
    for directory in dirs:
        file = os.path.abspath(os.path.join(directory, name))
        try:
            read(file)
            return file
        except FileNotFoundError:
            continue
    raise FileNotFoundError('Template not found: ' + name)

def setup_for(req):
    file = req.get('setup')
    if not file: return {}
    source = read(file, code=True)
    spec = importlib.util.spec_from_file_location('arguseye_project_setup', file)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    exec(compile(source, file, "exec"), module.__dict__)
    return module.setup(req['engine']) if hasattr(module, 'setup') else {}

def render(req):
    global current
    current = {**req, 'dependencies': set(), 'unresolved': set(), 'sources': {}}
    current['roots'] = [os.path.realpath(root) for root in req['roots']]
    sys.path.insert(0, req['root']) if req['root'] not in sys.path else None
    try:
        options = req.get('options', {})
        helpers = setup_for(req) or {}
        engine = req['engine']
        key = engine + json.dumps(options, sort_keys=True)
        source = read(req['file'])
        if engine == 'django':
            from django.conf import settings
            if not settings.configured:
                if options.get('settingsModule'):
                    os.environ['DJANGO_SETTINGS_MODULE'] = options['settingsModule']
                    import django
                    django.setup()
                else:
                    settings.configure(USE_I18N=False, USE_TZ=False)
            from django.template import Engine, Context, Origin, TemplateDoesNotExist, Variable, VariableDoesNotExist
            from django.template.loaders.base import Loader
            class PreviewLoader(Loader):
                def get_template_sources(self, name):
                    for directory in current['dirs']:
                        yield Origin(os.path.abspath(os.path.join(directory, name)), template_name=name, loader=self)
                def get_contents(self, origin):
                    try: return read(origin.name)
                    except FileNotFoundError: raise TemplateDoesNotExist(origin)
                def get_template(self, name, skip=None):
                    for origin in self.get_template_sources(name):
                        try: text = self.get_contents(origin)
                        except TemplateDoesNotExist: continue
                        cache_key = ('django', origin.name, text, key)
                        if cache_key not in compiled:
                            from django.template import Template
                            compiled[cache_key] = Template(text, origin=origin, name=name, engine=self.engine)
                        return compiled[cache_key]
                    raise TemplateDoesNotExist(name)
            loader_module = types.ModuleType('_arguseye_loader'); loader_module.Loader = PreviewLoader; sys.modules['_arguseye_loader'] = loader_module
            if not getattr(Variable, '_arguseye_traced', False):
                original = Variable.resolve
                def traced(self, context):
                    try: return original(self, context)
                    except VariableDoesNotExist:
                        current['unresolved'].add(str(self)); raise
                Variable.resolve = traced; Variable._arguseye_traced = True
            native = environments.get(key) if not req.get('setup') else None
            if native is None:
                native = Engine(dirs=req['dirs'], debug=True, loaders=['_arguseye_loader.Loader'], libraries=helpers.get('libraries', {}), builtins=helpers.get('builtins', []), **{name: value for name, value in options.items() if name in ['autoescape', 'file_charset', 'string_if_invalid']})
                if not req.get('setup'): environments[key] = native
            template = native.get_template(os.path.relpath(req['file'], req['dirs'][0]))
            html = template.render(Context(req.get('props', {}), autoescape=native.autoescape))
        elif engine == 'jinja2':
            import jinja2
            class PreviewLoader(jinja2.BaseLoader):
                def get_source(self, environment, name):
                    try: file = locate(name)
                    except FileNotFoundError: raise jinja2.TemplateNotFound(name)
                    text = read(file)
                    return text, file, lambda: read(file) == text
            class TracedUndefined(jinja2.Undefined):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, **kwargs)
                    current['unresolved'].add(str(self._undefined_name))
            native = environments.get(key) if not req.get('setup') else None
            if native is None:
                native = jinja2.Environment(loader=PreviewLoader(), undefined=TracedUndefined, extensions=helpers.get('extensions', []), **options)
                native.filters.update(helpers.get('filters', {})); native.globals.update(helpers.get('globals', {}))
                if not req.get('setup'): environments[key] = native
            template = native.get_template(os.path.relpath(req['file'], req['dirs'][0]))
            if native.is_async:
                import asyncio
                html = asyncio.run(template.render_async(**req.get('props', {})))
            else: html = template.render(**req.get('props', {}))
        elif engine == 'mako':
            from mako.lookup import TemplateLookup
            class PreviewLookup(TemplateLookup):
                def get_template(self, uri):
                    from mako.template import Template
                    file = locate(uri.lstrip('/')); text = read(file)
                    return Template(text, filename=file, uri=uri, lookup=self, **options)
            html = PreviewLookup(directories=req['dirs']).get_template(os.path.relpath(req['file'], req['dirs'][0])).render(**req.get('props', {}))
        elif engine == 'tornado':
            import tornado.template
            class PreviewLoader(tornado.template.BaseLoader):
                def resolve_path(self, name, parent_path=None): return locate(name, parent_path)
                def _create_template(self, name): return tornado.template.Template(read(name), name=name, loader=self)
            html = PreviewLoader(**options).load(req['file']).generate(**req.get('props', {})).decode('utf-8')
        else:
            raise ValueError('Unsupported Python template engine: ' + engine)
        if len(compiled) > 32: compiled.clear()
        warnings = []
        if engine in ['mako', 'tornado']: warnings.append('Template context lookup tracing is unavailable for ' + engine + '; review the supplied context.')
        return {'html': html, 'engineVersion': importlib.metadata.version(engine if engine != 'django' else 'Django'), 'runtimeVersion': sys.version.split()[0], 'unresolved': sorted(current['unresolved']), 'warnings': warnings}
    finally:
        pass

for line in sys.stdin:
    req = None
    try:
        req = json.loads(line)
        with contextlib.redirect_stdout(sys.stderr): result = render(req)
        result.update(v=1, id=req['id'], dependencies=sorted(current['dependencies']), sources=current['sources'], errors=[])
    except BaseException as error:
        debug = getattr(error, 'template_debug', {}) or {}
        location = str(debug.get('name') or (req or {}).get('file', '<template>')) + ':' + str(debug.get('line', '?'))
        result = {'v':1,'id':req.get('id') if req else None,'html':'','warnings':[], 'unresolved':[], 'dependencies': sorted(current['dependencies']) if current else [], 'errors':[location + '\n' + traceback.format_exc()]}
    print(json.dumps(result), flush=True)
