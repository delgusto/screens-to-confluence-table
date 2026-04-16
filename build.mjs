// Build script for the Figma plugin.
// Produces: dist/code.js, dist/ui.html, dist/manifest.json
//
// Why a custom script instead of Vite? The Figma plugin format is unusual
// (two separate bundles, one HTML file with everything inlined). Writing
// ~60 lines of esbuild + Tailwind CLI calls is clearer than a Vite config
// with vite-plugin-singlefile hacks.

import { build, context } from "esbuild";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const watch = process.argv.includes("--watch");
const root = resolve(".");
const out = resolve("dist");

mkdirSync(out, { recursive: true });

// 1. Generate Tailwind CSS → tmp/styles.css
function buildCss() {
  execSync(
    "npx tailwindcss -i src/ui/styles.css -o dist/.styles.css --minify",
    { stdio: "inherit" }
  );
}

// 2. Bundle the sandbox entry (code.ts) → dist/code.js
async function buildSandbox(opts = {}) {
  const buildOpts = {
    entryPoints: ["src/code.ts"],
    bundle: true,
    target: "es2017",
    format: "iife",
    outfile: "dist/code.js",
    logLevel: "info",
  };
  if (opts.watch) {
    const ctx = await context(buildOpts);
    await ctx.watch();
    return ctx;
  }
  await build(buildOpts);
}

// 3. Bundle the UI (main.tsx) → JS string, then write a single ui.html
//    with the JS + compiled CSS inlined.
async function buildUi(opts = {}) {
  const buildOpts = {
    entryPoints: ["src/ui/main.tsx"],
    bundle: true,
    target: "es2017",
    format: "iife",
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".ts": "ts" },
    write: false,
    logLevel: "info",
    plugins: [
      {
        name: "emit-html",
        setup(b) {
          b.onEnd((result) => {
            if (result.errors.length) return;
            const js = result.outputFiles?.[0]?.text ?? "";
            const css = readFileSync("dist/.styles.css", "utf8");
            const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${js}</script>
  </body>
</html>`;
            writeFileSync("dist/ui.html", html);
            console.log("[build] dist/ui.html written");
          });
        },
      },
    ],
  };
  if (opts.watch) {
    const ctx = await context(buildOpts);
    await ctx.watch();
    return ctx;
  }
  await build(buildOpts);
}

// 4. Copy manifest.json to dist/
function copyManifest() {
  copyFileSync("manifest.json", "dist/manifest.json");
  // Point paths at the dist-relative files when imported from dist/
  const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8"));
  manifest.main = "code.js";
  manifest.ui = "ui.html";
  writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2));
}

async function run() {
  buildCss();
  if (watch) {
    // In watch mode we rebuild CSS/manifest once up front; code + UI watch.
    copyManifest();
    await Promise.all([buildSandbox({ watch: true }), buildUi({ watch: true })]);
    console.log("[build] watching… (Ctrl+C to stop)");
  } else {
    await Promise.all([buildSandbox(), buildUi()]);
    copyManifest();
    console.log("[build] done → dist/");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
