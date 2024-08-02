const typescriptEslintPlugin = require("@typescript-eslint/eslint-plugin");
const prettier = require("eslint-plugin-prettier");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [
    ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
    "plugin:prettier/recommended",
), {
    plugins: {
        "@typescript-eslint": typescriptEslintPlugin,
        "prettier": prettier,
    },
    
    languageOptions: {
        globals: {
            ...globals.node,
        },
        
        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "module",
        
        parserOptions: {
            project: "tsconfig.json",
        },
    },
    
    rules: {
        "prettier/prettier": "error",
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/require-await": "off",
        "@typescript-eslint/no-floating-promises": "off",
        "@typescript-eslint/no-misused-promises": "off",
        "no-control-regex": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "no-async-promise-executor": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/prefer-promise-reject-errors": "off",
        "@typescript-eslint/no-require-imports": "off",
        
    },
    ignores: ["**/dist/", "**/node_modules/", "**/lib/"],
}];