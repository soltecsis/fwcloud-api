const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    files: ['**/*.cjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
    rules: { ...js.configs.recommended.rules, 'no-control-regex': 'off' },
  },
];
