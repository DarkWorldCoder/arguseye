<?php
/** Native Composer engines. Project code is trusted; template loader reads are bounded and overlay-aware. */
$state = [];
function cp_read($file, $code = false) {
    global $state;
    $file = str_replace('\\', '/', $file);
    $state['dependencies'][$file] = true;
    $real = realpath($file);
    if ($real === false) { $parent = realpath(dirname($file)); $real = $parent === false ? $file : $parent . '/' . basename($file); }
    $real = str_replace('\\', '/', $real);
    $allowed = false;
    foreach (($code ? [realpath($state['root'])] : $state['roots']) as $root) { $root = rtrim(str_replace('\\', '/', $root), '/'); if ($real === $root || str_starts_with($real, $root . '/')) $allowed = true; }
    if (!$allowed) throw new RuntimeException('Template include is outside approved roots: ' . $file);
    if (array_key_exists($file, $state['overlays'])) { $state['sources'][$file] = hash('sha256', $state['overlays'][$file]); return $state['overlays'][$file]; }
    if (!is_file($file)) throw new RuntimeException('Template not found: ' . $file);
    $source = file_get_contents($file);
    if (strlen($source) > 1048576) throw new RuntimeException('Template source exceeds 1 MiB: ' . $file);
    $state['sources'][$file] = hash('sha256', $source);
    return $source;
}
function cp_locate($name, $parent = null) {
    global $state;
    $dirs = $parent ? array_merge([dirname($parent)], $state['dirs']) : $state['dirs'];
    foreach ($dirs as $dir) {
        $file = preg_match('~^(?:[A-Za-z]:[/\\\\]|/)~', $name) ? $name : $dir . '/' . $name;
        if (is_file($file) || array_key_exists(str_replace('\\', '/', $file), $state['overlays'])) { cp_read($file); return $file; }
    }
    throw new RuntimeException('Template not found: ' . $name);
}
// Evaluated buffers need the original file constants for relative includes, without changing quoted text.
function cp_eval_source($source, $file) {
    $tokens = token_get_all($source); $code = '';
    $startsPhp = isset($tokens[0]) && is_array($tokens[0]) && $tokens[0][0] === T_OPEN_TAG;
    foreach ($tokens as $index => $token) {
        if (!is_array($token)) { $code .= $token; continue; }
        if ($index === 0 && $startsPhp) { $code .= str_repeat("\n", substr_count($token[1], "\n")); continue; }
        $code .= match ($token[0]) {
            T_DIR => var_export(dirname($file), true),
            T_FILE => var_export($file, true),
            T_LINE => (string) $token[2],
            default => $token[1],
        };
    }
    return ($startsPhp ? '' : '?>') . $code;
}
$cache = sys_get_temp_dir() . '/arguseye-php-' . bin2hex(random_bytes(12)); mkdir($cache, 0700);
function cp_remove($dir) { foreach (glob($dir . '/*') ?: [] as $file) { is_dir($file) ? cp_remove($file) : unlink($file); } @rmdir($dir); }
register_shutdown_function(fn() => cp_remove($cache));
while (($line = fgets(STDIN)) !== false) {
    $req = null; $level = ob_get_level();
    try {
        $req = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        $state = $req + ['dependencies' => []]; $state['dependencies'] = []; $state['sources'] = [];
        ob_start();
        $autoload = $req['root'] . '/vendor/autoload.php';
        if (is_file($autoload)) require_once $autoload;
        $options = $req['options'] ?? []; $data = $req['props'] ?? [];
        $helpers = [];
        if (!empty($req['setup'])) { $setupSource = cp_read($req['setup'], true); $setup = array_key_exists(str_replace('\\', '/', $req['setup']), $state['overlays']) ? eval(cp_eval_source($setupSource, $req['setup'])) : require $req['setup']; $helpers = is_callable($setup) ? $setup($req['engine']) : ($setup ?? []); }
        $engine = $req['engine']; $package = null;
        if ($engine === 'twig') {
            if (!class_exists('Twig\Environment')) throw new RuntimeException("Install this project's twig/twig package with Composer.");
            $loader = new class implements \Twig\Loader\LoaderInterface {
                public function getSourceContext(string $name): \Twig\Source { $file = cp_locate($name); return new \Twig\Source(cp_read($file), $name, $file); }
                public function getCacheKey(string $name): string { $file = cp_locate($name); return $file . ':' . hash('sha256', cp_read($file)); }
                public function isFresh(string $name, int $time): bool { return true; }
                public function exists(string $name): bool { try { cp_locate($name); return true; } catch (Throwable $e) { return false; } }
            };
            $native = new \Twig\Environment($loader, $options + ['cache' => false, 'auto_reload' => true]);
            foreach ($helpers['extensions'] ?? [] as $extension) $native->addExtension($extension);
            foreach ($helpers['filters'] ?? [] as $name => $filter) $native->addFilter(new \Twig\TwigFilter($name, $filter));
            foreach ($helpers['globals'] ?? [] as $name => $value) $native->addGlobal($name, $value);
            $html = $native->render($req['file'], $data); $package = 'twig/twig';
        } elseif ($engine === 'latte') {
            if (!class_exists('Latte\Engine')) throw new RuntimeException('Install latte/latte in this project.');
            $native = new \Latte\Engine;
            $native->setLoader(new class extends \Latte\Loaders\FileLoader {
                public function getContent(string $name): string { return cp_read(cp_locate($name)); }
                public function getUniqueId(string $name): string { $file = cp_locate($name); return $file . ':' . hash('sha256', cp_read($file)); }
                public function getReferredName(string $name, string $referringName): string { return cp_locate($name, $referringName); }
            });
            foreach ($helpers['filters'] ?? [] as $name => $filter) $native->addFilter($name, $filter);
            $html = $native->renderToString($req['file'], $data); $package = 'latte/latte';
        } elseif ($engine === 'smarty') {
            if (!class_exists('Smarty\Smarty')) throw new RuntimeException('Install smarty/smarty 5 in this project.');
            $native = new \Smarty\Smarty;
            $native->setCompileDir($cache); $native->setTemplateDir($req['dirs']);
            $native->registerResource('arguseye', new class extends \Smarty\Resource\CustomPlugin {
                protected function fetch($name, &$source, &$mtime) { $source = cp_read(cp_locate($name)); $mtime = time(); }
                public function populate(\Smarty\Template\Source $source, ?\Smarty\Template $_template = null) { parent::populate($source, $_template); $source->uid = hash('sha256', $source->name . cp_read(cp_locate($source->name))); }
            });
            $native->default_resource_type = 'arguseye';
            foreach ($data as $name => $value) $native->assign($name, $value);
            $html = $native->fetch('arguseye:' . $req['file']); $package = 'smarty/smarty';
        } elseif ($engine === 'blade') {
            if (!class_exists('Illuminate\View\Compilers\BladeCompiler')) throw new RuntimeException('Install illuminate/view in this project.');
            $fs = new class extends \Illuminate\Filesystem\Filesystem {
                public function get($path, $lock = false) { return cp_read($path); }
            };
            $compiler = new class($fs, $cache) extends \Illuminate\View\Compilers\BladeCompiler {
                public function getCompiledPath($path) { return $this->cachePath . '/' . hash('sha256', $path . cp_read($path)) . '.php'; }
            };
            $resolver = new \Illuminate\View\Engines\EngineResolver;
            $resolver->register('blade', fn() => new \Illuminate\View\Engines\CompilerEngine($compiler, $fs));
            $finder = new \Illuminate\View\FileViewFinder($fs, $req['dirs']);
            $factory = new \Illuminate\View\Factory($resolver, $finder, new \Illuminate\Events\Dispatcher(new \Illuminate\Container\Container));
            $factory->setContainer(new \Illuminate\Container\Container);
            $factory->share('__env', $factory);
            if (isset($helpers['configure'])) $helpers['configure']($factory, $compiler);
            $html = $factory->file($req['file'], $data)->render(); $package = 'illuminate/view';
        } elseif ($engine === 'php') {
            $source = cp_read($req['file']);
            $overlay = array_key_exists(str_replace('\\', '/', $req['file']), $state['overlays']);
            $html = (static function($source, $data, $file, $overlay) { extract($data, EXTR_SKIP); ob_start(); try { if ($overlay) eval(cp_eval_source($source, $file)); else require $file; return ob_get_contents(); } finally { ob_end_clean(); } })($source, $data, $req['file'], $overlay);
        } else throw new RuntimeException('Unsupported PHP engine: ' . $engine);
        $printed = ob_get_clean(); if ($printed !== '') fwrite(STDERR, $printed);
        $version = $package && class_exists('Composer\InstalledVersions') ? \Composer\InstalledVersions::getPrettyVersion($package) : PHP_VERSION;
        $reply = ['v'=>1, 'id'=>$req['id'], 'html'=>$html, 'dependencies'=>array_keys($state['dependencies']), 'sources'=>$state['sources'], 'errors'=>[], 'warnings'=>['Template context lookup tracing is unavailable for ' . $engine . '; review supplied context.'], 'unresolved'=>[], 'engineVersion'=>$version, 'runtimeVersion'=>PHP_VERSION];
    } catch (Throwable $error) {
        while (ob_get_level() > $level) ob_end_clean();
        $reply = ['v'=>1, 'id'=>$req['id'] ?? null, 'html'=>'', 'dependencies'=>array_keys($state['dependencies'] ?? []), 'errors'=>[($req['file'] ?? '') . ': ' . $error], 'warnings'=>[], 'unresolved'=>[]];
    }
    echo json_encode($reply, JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR) . "\n";
    if (count(glob($cache . '/*') ?: []) > 128) { cp_remove($cache); mkdir($cache, 0700); }
}
