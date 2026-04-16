// Deterministic, Confluence-safe PNG filenames for each exported frame.

const SLUG_MAX = 40;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

export function buildFilename(
  index: number,
  total: number,
  frameName: string
): string {
  const pad = String(total).length; // 1→1, 10→2, 100→3
  const idx = String(index + 1).padStart(pad, "0");
  const slug = slugify(frameName) || "frame";
  return `${idx}-${slug}.png`;
}
