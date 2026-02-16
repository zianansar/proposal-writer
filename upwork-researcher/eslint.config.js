import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importX from "eslint-plugin-import-x";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  {
    ignores: [
      "dist/",
      "node_modules/",
      "src-tauri/target/",
      "src-tauri/gen/",
      "src/shared/types/generated/",
    ],
  },
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "import-x": importX,
    },
    rules: {
      // Architecture requirement: no console in committed code
      // NOTE: Set to "warn" during initial rollout to avoid blocking commits
      // TODO: Upgrade to "error" after console.log statements are replaced with proper logging
      "no-console": "warn",

      // TypeScript strict rules
      // Set to "warn" during initial rollout - existing violations can be fixed separately
      // TODO: Upgrade to "error" after existing `any` types are properly typed
      "@typescript-eslint/no-explicit-any": "warn",
      // Set to "warn" during initial rollout
      // TODO: Can upgrade to "error" after unused vars are cleaned up
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Allow require() in legacy code (will be enforced in new code via pre-commit)
      "@typescript-eslint/no-require-imports": "warn",
      // Allow empty object types (extending interfaces)
      "@typescript-eslint/no-empty-object-type": "warn",
      // Strict-preset rules: warn during initial rollout (71 existing non-null assertions)
      // TODO: Upgrade to "error" after non-null assertions are replaced with proper null checks
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Allow class-based patterns (1 existing extraneous class)
      "@typescript-eslint/no-extraneous-class": "warn",

      // Import ordering with group config (architecture spec)
      // Set to "warn" during initial rollout - will be auto-fixed by pre-commit hooks
      // TODO: Can upgrade to "error" once all existing code is reformatted
      "import-x/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      // React rules - no inline styles (except dynamic)
      // Note: Recharts components need dynamic styles for data visualization
      // Set to "warn" during initial rollout - existing violations can be fixed separately
      // TODO: Upgrade to "error" after existing inline styles are refactored to CSS
      "react/forbid-component-props": [
        "warn",
        {
          forbid: [
            {
              propName: "style",
              allowedFor: [
                "Bar",
                "Line",
                "Area",
                "Pie",
                "Cell",
                "XAxis",
                "YAxis",
                "CartesianGrid",
                "Tooltip",
                "Legend",
                "ResponsiveContainer",
              ],
            },
          ],
        },
      ],

      // React Hooks rules — rules-of-hooks must be "error" (violations cause runtime crashes)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // Relaxed rules for test and benchmark files
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/*.bench.{ts,tsx}",
      "**/tests/**/*.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      // Allow `any` in test files for mocking
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unused vars in test files (test helpers, benchmark config)
      "@typescript-eslint/no-unused-vars": "off",
      // Allow console in test/benchmark files
      "no-console": "off",
    },
  },
  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
]);
