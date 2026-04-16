import JSZip from "jszip";
import type { ExportedFrame } from "../../shared/messages";
import { buildFilename } from "./filenames";

export interface ZipEntry {
  filename: string;
  frame: ExportedFrame;
}

export function planZipEntries(frames: ExportedFrame[]): ZipEntry[] {
  return frames.map((frame, i) => ({
    filename: buildFilename(i, frames.length, frame.name),
    frame,
  }));
}

export async function buildZipBlob(entries: ZipEntry[]): Promise<Blob> {
  const zip = new JSZip();
  for (const { filename, frame } of entries) {
    zip.file(filename, frame.pngBytes);
  }
  // PNG is already compressed, so STORE is faster and barely larger.
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
