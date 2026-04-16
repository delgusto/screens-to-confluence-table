// Trigger a file download from a Blob. Works inside Figma's plugin iframe.

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke so the download has time to start
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
