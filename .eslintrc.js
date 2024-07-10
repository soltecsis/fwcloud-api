module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
    'plugin:prettier/recommended'
  ],
  root: true,
  env: {
    node: true,
    es6: true,
  },
  rules: {
    //'prettier/prettier': 'error',
    //'@typescript-eslint/interface-name-prefix': 'off', // finished
    //'@typescript-eslint/explicit-function-return-type': 'off', // finished
    //'@typescript-eslint/explicit-module-boundary-types': 'off', // finished
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    //'no-control-regex': 'off', // finished
    '@typescript-eslint/no-unsafe-return': 'off',
    'no-async-promise-executor': 'off',
    //'no-prototype-builtins': 'off', // finished
    '@typescript-eslint/ban-types': 'off', // still 3 errors from the same file

    //'@typescript-eslint/await-thenable': 'off',
    //'no-useless-escape': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    //'@typescript-eslint/no-base-to-string': 'off', // finished
    //'@typescript-eslint/restrict-template-expressions': 'off', // finished
    //'no-empty': 'off', // finished
    //'no-constant-condition': 'off', // finished
    //'no-dupe-else-if': 'off',  // finished
    //'no-case-declarations': 'off', // finished
    //'@typescript-eslint/no-redundant-type-constituents': 'off', // finished
  },
  ignorePatterns: ['dist/', 'node_modules/', 'lib/'],
};
  