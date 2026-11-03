# Native project gems; worker lifecycle isolation does not sandbox project Ruby code.
require 'json'
require 'digest'
require 'stringio'
$cp_state = nil
$cp_cache = {}
def cp_key(file)
  expanded = File.expand_path(file)
  File::ALT_SEPARATOR ? expanded.downcase : expanded
end
def cp_read(file, code=false)
  file = File.expand_path(file)
  $cp_state['dependencies'][file] = true
  physical = File.exist?(file) ? File.realpath(file) : File.join(File.realpath(File.dirname(file)), File.basename(file))
  unless (code ? [File.realpath($cp_state['root'])] : $cp_state['roots']).any? { |root| physical == File.realpath(root) || physical.start_with?(File.realpath(root) + File::SEPARATOR) }
    raise IOError, 'Template include is outside approved roots: ' + file
  end
  source = $cp_state['overlays'].fetch(cp_key(file)) { File.read(file, encoding: 'UTF-8') }
  raise IOError, 'Template source exceeds 1 MiB: ' + file if source.bytesize > 1048576
  $cp_state['sources'][file] = Digest::SHA256.hexdigest(source)
  source
end
def cp_locate(name)
  $cp_state['dirs'].each do |dir|
    file = File.expand_path(name, dir)
    return file if File.file?(file) || $cp_state['overlays'].key?(cp_key(file))
  end
  raise IOError, 'Template not found: ' + name
end
STDIN.each_line do |line|
  req = nil
  begin
    req = JSON.parse(line)
    req['overlays'] = req['overlays'].to_h { |file, source| [cp_key(file), source] }
    $cp_state = req.merge('dependencies' => {}, 'sources' => {})
    original_stdout = $stdout; $stdout = $stderr
    if File.file?(File.join(req['root'], 'Gemfile'))
      ENV['BUNDLE_GEMFILE'] = File.join(req['root'], 'Gemfile')
      require 'bundler/setup'
    end
    engine = req['engine']; options = (req['options'] || {}).transform_keys(&:to_sym)
    source = cp_read(req['file']); props = req['props'] || {}; helpers = {}
    if req['setup']
      registration = eval(cp_read(req['setup'], true), TOPLEVEL_BINDING, req['setup'])
      helpers = registration.respond_to?(:call) ? registration.call(engine) : (registration || {})
    end
    scope = Object.new
    (helpers['modules'] || []).each { |mod| scope.extend(mod) }
    props.each { |name, value| scope.define_singleton_method(name) { value } }
    key = [engine, req['file'], Digest::SHA256.hexdigest(source), options]
    if engine == 'erb'
      require 'erb'
      native = $cp_cache[key] ||= ERB.new(source, **options)
      native.filename = req['file']
      html = native.result(scope.instance_eval { binding })
      version = RUBY_VERSION
    elsif engine == 'haml' || engine == 'slim'
      require engine
      klass = engine == 'haml' ? Haml::Template : Slim::Template
      native = $cp_cache[key] ||= klass.new(req['file'], 1, options) { source }
      html = native.render(scope, props.transform_keys(&:to_sym))
      version = Gem.loaded_specs[engine].version.to_s
    elsif engine == 'liquid'
      require 'liquid'
      loader = Object.new
      loader.define_singleton_method(:read_template_file) do |name|
        cp_read(cp_locate(name.end_with?('.liquid') ? name : name + '.liquid'))
      end
      native = Liquid::Template.parse(source, **options)
      html = native.render!(props, registers: { file_system: loader }, filters: helpers['filters'] || [])
      version = Gem.loaded_specs['liquid'].version.to_s
    else
      raise ArgumentError, 'Unsupported Ruby engine: ' + engine
    end
    $cp_cache.shift if $cp_cache.size > 128
    reply = {v: 1, id: req['id'], html: html, dependencies: $cp_state['dependencies'].keys, sources: $cp_state['sources'], errors: [], warnings: ['Template context lookup tracing is unavailable for ' + engine + '; review supplied context.'], unresolved: [], engineVersion: version, runtimeVersion: RUBY_VERSION}
  rescue Exception => error
    reply = {v: 1, id: req && req['id'], html: '', dependencies: $cp_state ? $cp_state['dependencies'].keys : [], errors: ["#{req && req['file']}: #{error.class}: #{error.message}\n#{(error.backtrace || []).join("\n")}"], warnings: [], unresolved: []}
  ensure
    $stdout = original_stdout || STDOUT
  end
  STDOUT.write(JSON.generate(reply) + "\n"); STDOUT.flush
end
