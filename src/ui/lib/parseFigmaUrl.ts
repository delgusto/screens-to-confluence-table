// Extract the fileKey from a Figma URL.
// Accepts any of these forms:
//   https://www.figma.com/design/tqxMrpobRPdohGpwgG80TO/DGUX-redesign?m=auto
//   https://www.figma.com/file/tqxMrpobRPdohGpwgG80TO/Old-style-path
//   https://figma.com/design/abc123
//   www.figma.com/design/abc123/…
// Returns null if the input doesn't contain a fileKey segment.

export function parseFigmaFileKey(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Look for the /design/ or /file/ segment followed by a key of
  // alphanumeric chars. This matches Figma's canonical URL shapes.
  const match = trimmed.match(/figma\.com\/(?:design|file)\/([A-Za-z0-9]{10,})/);
  return match?.[1] ?? null;
}
