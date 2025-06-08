const esbuild = require("esbuild")

esbuild
  .build({
    entryPoints: ["./index.ts"],
    outfile: "./dist/index.js",
    bundle: true,
    minify: true,
    platform: "node",
    sourcemap: true,
    target: "node14",
  })
  .catch(() => process.exit(1))
