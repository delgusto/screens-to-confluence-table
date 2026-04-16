import type { AutoFill, Column } from "../../shared/messages";

// Build a Confluence-ready HTML table string.
// Pure function — no DOM, easy to reason about and unit-test.

export interface FrameForTable {
  name: string;
  copy: string;
  // null when the file hasn't been saved to Figma's cloud yet — figmaLink
  // cells fall back to plain text instead of a broken link.
  figmaUrl: string | null;
  // Empty string when unused (link-only templates). Required for the
  // screenshot autoFill so the cell can name the PNG the user should drop.
  pngFilename: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function copyToHtml(copy: string): string {
  return escapeHtml(copy).replace(/\n/g, "<br>");
}

function cellFor(column: Column, frame: FrameForTable): string {
  switch (column.autoFill) {
    case "screenName":
      return escapeHtml(frame.name);
    case "copy":
      return copyToHtml(frame.copy);
    case "screenshot":
      // Intentionally a filename label, not an <img>. Confluence doesn't
      // resolve pasted img src against page attachments, so the cell is
      // left empty with a filename hint. Dropping the matching PNG onto
      // the cell both uploads it as an attachment and inserts it inline.
      return `<em>${escapeHtml(frame.pngFilename)}</em>`;
    case "figmaLink":
      if (!frame.figmaUrl) {
        return `<em>${escapeHtml(frame.name)}</em> (file not published)`;
      }
      // The anchor text is the URL itself (not the frame name). That
      // matches what Confluence's paste handler produces when you type a
      // raw URL, which is the shape its Smart Link auto-detector
      // recognises. The previous data-card-appearance="embed" attribute
      // gets stripped by Confluence's paste sanitiser, so it did nothing.
      // With this shape we reliably land on the Inline appearance, one
      // click away from Embed instead of two.
      {
        const url = escapeHtml(frame.figmaUrl);
        return `<a href="${url}">${url}</a>`;
      }
    case "checklist":
      return renderChecklist(column.checklistItems ?? []);
    case "blank":
      return "";
  }
}

// Confluence's native action/task items use a specific DOM structure:
//   <div data-node-type="action-list">
//     <div class="task-item" data-node-type="action-item" data-task-state="TODO">
//       Label text
//     </div>
//   </div>
// Emitting this structure gives the paste handler the best chance of
// recognising it and rendering real clickable checkboxes. If it strips
// the data attributes, the fallback is just plain text "Label" per div
// on separate lines — still readable, just not interactive.
function renderChecklist(items: string[]): string {
  if (items.length === 0) return "";
  const taskItems = items
    .map(
      (label) =>
        `<div class="task-item" data-node-type="action-item" data-task-state="TODO">${escapeHtml(label)}</div>`
    )
    .join("");
  return `<div data-node-type="action-list">${taskItems}</div>`;
}

// ─── Column width allocation ──────────────────────────────────────────────
// Weight each autoFill type by how much horizontal space its content needs.
// A figmaLink carries an iframe embed, so it gets the lion's share.

const WEIGHT: Record<AutoFill, number> = {
  figmaLink: 8,
  screenshot: 6,
  copy: 4,
  checklist: 2,
  screenName: 1,
  blank: 1,
};

function columnWidths(columns: Column[]): number[] {
  const weights = columns.map((c) => WEIGHT[c.autoFill] ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return columns.map(() => Math.round(100 / columns.length));
  // Convert to percentages; round and correct the last cell so the row
  // sums to exactly 100 (avoids a sub-pixel gap at the right edge).
  const raw = weights.map((w) => (w / total) * 100);
  const rounded = raw.map((p) => Math.round(p));
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  if (rounded.length > 0) rounded[rounded.length - 1] += drift;
  return rounded;
}

export function buildHtmlTable(
  columns: Column[],
  frames: FrameForTable[]
): string {
  const widths = columnWidths(columns);
  const colgroup = widths
    .map((w) => `<col style="width:${w}%" />`)
    .join("");
  const head = columns
    .map((c) => `<th>${escapeHtml(c.title)}</th>`)
    .join("");
  const rows = frames
    .map((frame) => {
      const cells = columns
        .map((col) => `<td>${cellFor(col, frame)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  // data-layout="full-width" is Confluence's own attribute for full-width
  // tables; the inline style is the belt-and-braces fallback if Confluence
  // strips it on paste. table-layout:fixed makes the browser honour the
  // colgroup widths instead of auto-sizing to content.
  return (
    `<table data-layout="full-width" style="width:100%;table-layout:fixed">` +
    `<colgroup>${colgroup}</colgroup>` +
    `<thead><tr>${head}</tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  );
}

// Tiny estimate just for the status UI.
export function estimateHtmlBytes(
  columns: Column[],
  frames: FrameForTable[]
): number {
  const rowOverhead = frames.length * 256;
  const headerOverhead = columns.length * 32;
  const textBytes = frames.reduce(
    (sum, f) => sum + f.copy.length + f.name.length + (f.figmaUrl?.length ?? 0),
    0
  );
  return rowOverhead + headerOverhead + textBytes;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
