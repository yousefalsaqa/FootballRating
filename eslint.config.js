const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // worker/ is a separate Cloudflare deployment with its own type environment.
    ignores: ['dist/*', 'src/db/migrations/*', 'worker/**'],
  },
  {
    // Test files: jest.mock factories legitimately use require() above imports.
    files: ['**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/first': 'off',
    },
  },
]);
