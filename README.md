# Screens → Confluence Table

A Figma plugin that turns selected frames into a review table you can paste directly into Confluence. Two modes:

- **Figma embed link (default):** each row has a live Figma link that Confluence renders as an interactive Figma viewer — reviewers click to open the frame in Figma. One-click export.
- **PNG screenshot (drag-drop):** each row has a filename label; you download a zip of PNGs and drag each one into its row's cell in Confluence. Fully offline once pasted, no Figma accounts required for reviewers.

You can mix modes in the same template (two columns — one link, one screenshot).

Sign-off cells render as real clickable Confluence checkboxes.

## Install on your work laptop (no build required)

1. On the repo's GitHub page, click **Code → Download ZIP**.
2. Extract the ZIP somewhere stable (e.g. `~/figma-plugins/screens-to-confluence-table/`).
3. Open Figma Desktop.
4. **Plugins → Development → Import plugin from manifest…**
5. Pick `dist/manifest.json` inside the extracted folder.
6. Select frames and run **Screens to Confluence Table**.

To update later: overwrite the same folder with a fresh ZIP download, then rerun the plugin in Figma (⌘⌥P on the last-used plugin).

## Use

1. Select frames in Figma, pick a template, paste your Figma file URL if prompted (dev-imported plugins don't see the fileKey automatically).
2. Click **Copy table** (link mode) or **Prepare → Download → Copy** (screenshot mode).
3. Paste into Confluence.
4. For link mode: cells auto-resolve to Figma embeds. For screenshot mode: drag each PNG from the extracted zip into its row's cell.

### Confluence tip

In Confluence Cloud you can set figma.com links to always use the Embed appearance by default — saves a click per link. Look in your Smart Link settings.

## Develop

```bash
npm install
npm run build        # one-off build → dist/
npm run watch        # rebuild on change (restart plugin in Figma to pick up)
npm run typecheck    # TS check
```

Entry points:
- [src/code.ts](src/code.ts) — plugin sandbox (Figma runtime, reads selection, exports PNGs)
- [src/ui/App.tsx](src/ui/App.tsx) — plugin UI (React + Tailwind)
- [src/ui/lib/buildHtmlTable.ts](src/ui/lib/buildHtmlTable.ts) — pure HTML table builder with mode-specific cell rendering and colgroup widths
- [src/shared/messages.ts](src/shared/messages.ts) — typed messages between sandbox and UI
# screens-to-confluence-table
