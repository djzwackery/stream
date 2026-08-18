// Streamlabs' Alert Box "Custom JS" box runs the pasted script as a plain,
// standalone string, not a module, so it can't resolve `import`s. This
// bundles src/streamlabs-alertbox.ts and everything it imports (AlertStage
// and the rest of src/components/) into one self-contained script with no
// imports left, for control.html to embed in its generated JS copy box.
// Runs after tsc in `npm run build`, but bundles straight from the .ts
// source itself, tsc's own output isn't used as an input here.
import { build } from "esbuild";

await build({
  entryPoints: ["src/streamlabs-alertbox.ts"],
  outfile: "public/js/streamlabs-alertbox.bundle.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  logLevel: "info",
});
