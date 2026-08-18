// @ts-check
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

export default defineConfig(
  globalIgnores(["node_modules/**", "public/**"]),
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    // Type-checked, not just the syntactic `recommended` set: catches `any`
    // flowing in implicitly (JSON.parse, .json(), untyped third-party calls)
    // too, not just a literal `: any` annotation.
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["src/**/*.ts"],
    plugins: { jsdoc },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // No `if (x) return;`, every block gets braces, even one-liners.
      curly: ["error", "all"],
      // `/** on its own line, content indented, */` on its own line, never
      // a single-line `/** ... */` JSDoc comment.
      "jsdoc/multiline-blocks": ["error", { noSingleLineBlocks: true }],
      // Every interface and every property within it needs its own JSDoc,
      // scoped to just those contexts, not the rule's default (which also
      // wants one on every function declaration).
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: { FunctionDeclaration: false },
          contexts: [
            "TSInterfaceDeclaration",
            "TSPropertySignature",
            "TSTypeAliasDeclaration",
          ],
        },
      ],
    },
  },
);
