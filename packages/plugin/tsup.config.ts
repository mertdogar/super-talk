import { defineConfig } from "tsup";

// The plugin is distributed via the Claude Code marketplace, which clones the repo but never runs
// `npm install`. So `dist/index.js` must be a single self-contained bundle with every dependency
// inlined. `ws`'s optional native speedups stay external (they're loaded via try/catch and fall
// back to pure JS when absent).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: false,
  noExternal: [/.*/],
  external: ["bufferutil", "utf-8-validate"],
  target: "node18",
  // Shebang + a real `require` so esbuild's __require shim resolves Node builtins that bundled CJS
  // deps (ws) pull in via dynamic require — otherwise the ESM output throws "Dynamic require of
  // 'events' is not supported".
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module';\nconst require = __cr(import.meta.url);",
  },
});
