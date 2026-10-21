// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Build-time Node files (Expo config, Tailwind config, EAS hooks): Node globals, and the release
    // check reads build variables by name on purpose.
    files: ["*.config.js", "scripts/**/*.js", "scripts/**/*.mjs"],
    languageOptions: { globals: require("globals").node },
    rules: { "expo/no-dynamic-env-var": "off" },
  },
  {
    rules: {
      // Remaining hits are admin forms that fill their fields once after the record loads (one
      // extra render, not a correctness problem). Core flows (session, app lock, app config,
      // messaging, paging) are fixed; new code should not add more. Every other React Compiler
      // rule (refs, immutability, purity, ...) stays an error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
