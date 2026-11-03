import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Each tiny fixture installs its real native dependencies; non-Node projects never require npm.
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && /^(npm|bundle|composer)$/.test(command) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed in ${cwd} (${result.status})`);
};
for (const name of readdirSync('test/fixtures')) {
  const root = path.resolve('test/fixtures', name);
  if (existsSync(path.join(root, 'package-lock.json'))) run('npm', ['ci', '--no-audit', '--no-fund'], root);
  if (existsSync(path.join(root, 'requirements.txt'))) {
    run('python', ['-m', 'venv', '.venv'], root);
    const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    run(python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], root);
  }
  if (existsSync(path.join(root, 'composer.lock'))) run('composer', ['install', '--no-interaction', '--no-progress', '--prefer-dist'], root);
  if (existsSync(path.join(root, 'Gemfile.lock'))) {
    run('bundle', ['config', 'set', '--local', 'path', 'vendor/bundle'], root);
    run('bundle', ['install'], root);
  }
}
