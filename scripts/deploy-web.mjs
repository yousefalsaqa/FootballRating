/**
 * Publishes the exported web build (dist/) to the gh-pages branch using plain
 * git — a fresh orphan commit each time, force-added so no ignore rules can
 * silently drop files (which bit us with assets/node_modules fonts).
 * Run via: npm run deploy:web
 */
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, stdio: ['ignore', 'pipe', 'inherit'] })
    .toString()
    .trim();
}

// SPA fallback: GitHub Pages serves 404.html for unknown paths (deep links).
copyFileSync('dist/index.html', 'dist/404.html');
// Disable Jekyll — it silently drops the _expo/ directory otherwise.
writeFileSync('dist/.nojekyll', '');

const remote = git('remote get-url origin');
const stage = mkdtempSync(join(tmpdir(), 'ghpages-'));
try {
  git('init -q', stage);
  cpSync('dist', stage, { recursive: true });
  git('add -A -f', stage);
  git('-c user.name=deploy -c user.email=deploy@local commit -q -m "Deploy web build"', stage);
  git(`push --force "${remote}" HEAD:gh-pages`, stage);
  console.log('Deployed dist/ to gh-pages.');
} finally {
  rmSync(stage, { recursive: true, force: true });
}
