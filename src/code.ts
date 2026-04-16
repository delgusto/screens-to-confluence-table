// Sandbox code — runs inside Figma's plugin runtime.
// Has access to the `figma` global. No DOM, no fetch, no React.

import type {
  ExportedFrame,
  FrameInfo,
  SandboxToUi,
  Template,
  UiToSandbox,
} from "./shared/messages";

const TEMPLATES_KEY = "templates.v1";

figma.showUI(__html__, { width: 380, height: 560, themeColors: true });

function post(msg: SandboxToUi) {
  figma.ui.postMessage(msg);
}

// ─── Selection → FrameInfo ─────────────────────────────────────────────────

function isExportable(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode | SectionNode {
  return (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "INSTANCE" ||
    node.type === "SECTION"
  );
}

function extractCopy(root: SceneNode): string {
  const texts: { y: number; x: number; chars: string }[] = [];
  function walk(node: SceneNode) {
    if (!node.visible) return;
    if (node.type === "TEXT") {
      const box = node.absoluteBoundingBox;
      if (box && node.characters.trim().length > 0) {
        texts.push({ y: box.y, x: box.x, chars: node.characters });
      }
      return;
    }
    if ("children" in node) {
      for (const child of node.children) walk(child);
    }
  }
  walk(root);
  texts.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 8) return a.y - b.y;
    return a.x - b.x;
  });
  return texts.map((t) => t.chars).join("\n");
}

function frameInfo(node: SceneNode): FrameInfo {
  return {
    id: node.id,
    name: node.name,
    width: Math.round(node.width),
    height: Math.round(node.height),
    copy: extractCopy(node),
  };
}

function sendSelection() {
  const selection = figma.currentPage.selection.filter(isExportable);
  post({
    type: "selection",
    frames: selection.map(frameInfo),
    fileKey: figma.fileKey ?? null,
    fileName: figma.root.name,
  });
}

figma.on("selectionchange", sendSelection);
figma.on("currentpagechange", sendSelection);

// ─── PNG export ────────────────────────────────────────────────────────────
// Bytes only — the UI iframe does base64 encoding because the sandbox
// runtime has no `btoa`.

async function exportFrames(frameIds: string[], scale: number) {
  const frames: ExportedFrame[] = [];
  for (let i = 0; i < frameIds.length; i++) {
    const id = frameIds[i];
    const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
    if (!node || !isExportable(node)) {
      post({
        type: "export-error",
        message: `Frame ${id} is no longer available. Refresh your selection and try again.`,
      });
      return;
    }
    try {
      const bytes = await node.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: scale },
      });
      frames.push({ ...frameInfo(node), pngBytes: bytes });
      post({ type: "export-progress", done: i + 1, total: frameIds.length });
    } catch (err) {
      post({
        type: "export-error",
        message: `Failed to export "${node.name}": ${(err as Error).message}`,
      });
      return;
    }
  }
  post({ type: "export-complete", frames });
}

// ─── Templates ─────────────────────────────────────────────────────────────

async function loadTemplates() {
  const stored = (await figma.clientStorage.getAsync(TEMPLATES_KEY)) as
    | Template[]
    | undefined;
  post({ type: "templates", templates: stored ?? [] });
}

async function saveTemplates(templates: Template[]) {
  await figma.clientStorage.setAsync(TEMPLATES_KEY, templates);
}

// ─── Message router ────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: UiToSandbox) => {
  switch (msg.type) {
    case "ui-ready":
      sendSelection();
      await loadTemplates();
      break;
    case "request-selection":
      sendSelection();
      break;
    case "request-export":
      await exportFrames(msg.frameIds, msg.scale);
      break;
    case "load-templates":
      await loadTemplates();
      break;
    case "save-templates":
      await saveTemplates(msg.templates);
      break;
  }
};
