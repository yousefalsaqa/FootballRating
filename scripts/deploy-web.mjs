/**
 * Publishes the exported web build (dist/) to the gh-pages branch.
 * Run via: npm run deploy:web
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { publish } from 'gh-pages';

// SPA fallback: GitHub Pages serves 404.html for unknown paths (deep links).
copyFileSync('dist/index.html', 'dist/404.html');
// Disable Jekyll — it silently drops the _expo/ directory otherwise.
writeFileSync('dist/.nojekyll', '');

publish('dist', { dotfiles: true, message: 'Deploy web build' }, (err) => {
  if (err) {
    console.error('Deploy failed:', err);
    process.exit(1);
  }
  console.log('Deployed to gh-pages branch.');
});
