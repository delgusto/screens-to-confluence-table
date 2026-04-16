// Build a shareable Figma frame URL.
//
// Format: https://www.figma.com/design/{fileKey}/{slug}?node-id={nodeId}
//   - `fileKey`  — stable file id from figma.fileKey
//   - `slug`     — slugified file name (optional but Figma includes it in
//                  copy-link output; makes the URL readable)
//   - `nodeId`   — frame id with ":" replaced by "-" (URL form)
//
// Returns null if fileKey is missing (draft file) so callers can render a
// plain-text cell instead of a broken link.

export function buildFigmaFrameUrl(
  fileKey: string | null,
  fileName: string,
  nodeId: string
): string | null {
  if (!fileKey) return null;
  const slug = slugify(fileName) || "file";
  const urlNodeId = nodeId.replace(/:/g, "-");
  return `https://www.figma.com/design/${fileKey}/${slug}?node-id=${urlNodeId}`;
}

function slugify(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
