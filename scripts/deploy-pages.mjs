// Publie dist/ sur la branche gh-pages : GitHub Pages sert alors le site depuis
// cette branche, sans passer par GitHub Actions.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const read = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'inherit' });

if (read(['status', '--porcelain']).length > 0) {
  throw new Error('Des changements ne sont pas commités : commitez-les avant de publier.');
}

execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' });

const remote = read(['remote', 'get-url', 'origin']);
const source = read(['rev-parse', '--short', 'HEAD']);
const identity = [read(['config', 'user.name']), read(['config', 'user.email'])];
const dir = mkdtempSync(join(tmpdir(), 'vex-prompting-pages-'));

try {
  cpSync('dist', dir, { recursive: true });
  // Sans ce fichier, Pages passe le site dans Jekyll, qui ignore certains fichiers.
  writeFileSync(join(dir, '.nojekyll'), '');
  git(['init', '-q', '-b', 'gh-pages'], dir);
  git(['config', 'user.name', identity[0]], dir);
  git(['config', 'user.email', identity[1]], dir);
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', `Site construit depuis ${source}`], dir);
  git(['push', '-q', '-f', remote, 'gh-pages'], dir);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
