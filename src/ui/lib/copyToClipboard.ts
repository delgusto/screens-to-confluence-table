// Synchronous HTML clipboard copy via the legacy `document.execCommand('copy')`
// API. Must be called directly from a user-gesture event handler (click).
//
// Why not navigator.clipboard.write?
//   - Figma's plugin iframe doesn't grant clipboard-write permission, so
//     `navigator.clipboard` is undefined or throws.
//   - Even when it works, our flow does an async round-trip to the plugin
//     sandbox to export PNGs, which expires the user gesture before the
//     async API can be called.
//
// The legacy execCommand path works in every Figma Desktop version because
// it only requires an active user gesture — no permissions negotiation.

export function copyHtml(html: string): void {
  const plain = htmlToPlain(html);
  let captured = false;

  function onCopy(e: ClipboardEvent) {
    if (!e.clipboardData) return;
    e.clipboardData.setData("text/html", html);
    e.clipboardData.setData("text/plain", plain);
    e.preventDefault();
    captured = true;
  }

  document.addEventListener("copy", onCopy);
  try {
    const ok = document.execCommand("copy");
    if (!ok || !captured) {
      throw new Error(
        "Copy was blocked. Make sure you clicked the Copy button directly."
      );
    }
  } finally {
    document.removeEventListener("copy", onCopy);
  }
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<img[^>]*>/g, "[image]")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}
