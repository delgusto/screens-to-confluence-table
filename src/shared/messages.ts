// Message contract between the sandbox (code.ts) and the UI iframe (ui.html).
// Keep this file dependency-free — it is imported by both sides.

export type AutoFill =
  | "screenName"
  | "copy"
  | "figmaLink"
  | "screenshot" // renders <em>filename.png</em> — user drags PNG per cell
  | "screenshotInline" // renders <img src="filename.png"> — user drags all PNGs onto page at once
  | "blank"
  | "checklist";

export interface Column {
  id: string; // stable id, survives rename
  title: string;
  autoFill: AutoFill;
  // Only used when autoFill === "checklist". Each string becomes one
  // checkbox-prefixed line in every row of that column.
  checklistItems?: string[];
}

export interface Template {
  id: string;
  name: string;
  columns: Column[];
}

export interface FrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  copy: string; // text extracted from the frame
}

// Carries raw PNG bytes — base64 encoding happens in the UI iframe, not
// the plugin sandbox, because the sandbox runtime has no `btoa`.
export interface ExportedFrame extends FrameInfo {
  pngBytes: Uint8Array;
}

// UI → sandbox
export type UiToSandbox =
  | { type: "ui-ready" }
  | { type: "request-selection" }
  | { type: "request-export"; frameIds: string[]; scale: number }
  | { type: "load-templates" }
  | { type: "save-templates"; templates: Template[] };

// Sandbox → UI
export type SandboxToUi =
  | {
      type: "selection";
      frames: FrameInfo[];
      fileKey: string | null; // null for unsaved/draft files
      fileName: string;
    }
  | { type: "export-progress"; done: number; total: number }
  | { type: "export-complete"; frames: ExportedFrame[] }
  | { type: "export-error"; message: string }
  | { type: "templates"; templates: Template[] };
