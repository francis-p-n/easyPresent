import js from "@eslint/js";

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
        self: "readonly"
      }
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  }
];
