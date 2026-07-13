import js from "@eslint/js";

// Node/CommonJS globals for the Electron main-process scripts and any
// node-environment test files.
const nodeGlobals = {
  require: "readonly",
  module: "writable",
  exports: "writable",
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  global: "readonly"
};

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        requestAnimationFrame: "readonly",
        crypto: "readonly",
        navigator: "readonly",
        Worker: "readonly",
        URL: "readonly",
        Blob: "readonly",
        CustomEvent: "readonly",
        ResizeObserver: "readonly",
        alert: "readonly",
        prompt: "readonly",
        self: "readonly",
        getComputedStyle: "readonly",
        FileReader: "readonly",
        FontFace: "readonly",
        Image: "readonly",
        fetch: "readonly"
      }
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }]
    }
  },
  {
    // Electron main process + servers run in Node (CommonJS)
    files: ["electron/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      // Main-process/server startup logging is intentional and user-visible
      "no-console": "off"
    }
  },
  {
    // Test files are ESM (vitest) but may use Node builtins; this block comes
    // after the electron/ one so electron/*.test.js parses as a module too.
    files: ["**/*.test.js"],
    languageOptions: {
      sourceType: "module",
      globals: nodeGlobals
    }
  }
];
