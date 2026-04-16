// Eyeball the buildHtmlTable output for both template modes without
// running Figma. Not a real test framework — just text output.
// Usage: node scripts/smoke-test-table.mjs

import { build } from "esbuild";
import { writeFileSync } from "node:fs";

const result = await build({
  entryPoints: ["src/ui/lib/buildHtmlTable.ts"],
  bundle: true,
  format: "esm",
  target: "node18",
  write: false,
});
const tmpPath = "dist/.smoke-buildHtmlTable.mjs";
writeFileSync(tmpPath, result.outputFiles[0].text);
const mod = await import(`../${tmpPath}`);

const frames = [
  {
    name: "01 Welcome",
    copy: "Welcome back\nSign in to continue",
    figmaUrl: "https://www.figma.com/design/ABC123/My-File?node-id=1-2",
    pngFilename: "01-welcome.png",
  },
  {
    name: "02 Email entry",
    copy: "Email address\nNext",
    figmaUrl: "https://www.figma.com/design/ABC123/My-File?node-id=3-4",
    pngFilename: "02-email-entry.png",
  },
];

const checklist = {
  id: "signoff",
  title: "Sign off",
  autoFill: "checklist",
  checklistItems: ["Editor", "Compliance"],
};

function section(label, html) {
  console.log("\n=== " + label + " ===");
  console.log(html);
}

section(
  "Mode: Figma embed link",
  mod.buildHtmlTable(
    [
      { id: "screen", title: "UI Screenshot", autoFill: "figmaLink" },
      { id: "copy", title: "Copy", autoFill: "copy" },
      checklist,
    ],
    frames
  )
);

section(
  "Mode: PNG screenshot (drag-drop)",
  mod.buildHtmlTable(
    [
      { id: "screen", title: "UI Screenshot", autoFill: "screenshot" },
      { id: "copy", title: "Copy", autoFill: "copy" },
      checklist,
    ],
    frames
  )
);

section(
  "Mode: Both side-by-side",
  mod.buildHtmlTable(
    [
      { id: "link", title: "Live preview", autoFill: "figmaLink" },
      { id: "png", title: "Screenshot", autoFill: "screenshot" },
      { id: "copy", title: "Copy", autoFill: "copy" },
      checklist,
    ],
    frames
  )
);
