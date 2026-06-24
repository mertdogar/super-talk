import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: { entry: "src/index.ts" },
  clean: true,
  sourcemap: true,
  // The `super-talk-server` bin (cli.js) must start with a shebang, or npx/the OS hands it to the
  // shell and it fails on the ESM `import`. Node strips the shebang on the imported index.js entry.
  banner: { js: "#!/usr/bin/env node" },
});
