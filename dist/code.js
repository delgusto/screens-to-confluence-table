"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/code.ts
  var TEMPLATES_KEY = "templates.v1";
  figma.showUI(__html__, { width: 380, height: 560, themeColors: true });
  function post(msg) {
    figma.ui.postMessage(msg);
  }
  function isExportable(node) {
    return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE" || node.type === "SECTION";
  }
  function extractCopy(root) {
    const texts = [];
    function walk(node) {
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
  function frameInfo(node) {
    return {
      id: node.id,
      name: node.name,
      width: Math.round(node.width),
      height: Math.round(node.height),
      copy: extractCopy(node)
    };
  }
  function sendSelection() {
    var _a;
    const selection = figma.currentPage.selection.filter(isExportable);
    post({
      type: "selection",
      frames: selection.map(frameInfo),
      fileKey: (_a = figma.fileKey) != null ? _a : null,
      fileName: figma.root.name
    });
  }
  figma.on("selectionchange", sendSelection);
  figma.on("currentpagechange", sendSelection);
  async function exportFrames(frameIds, scale) {
    const frames = [];
    for (let i = 0; i < frameIds.length; i++) {
      const id = frameIds[i];
      const node = await figma.getNodeByIdAsync(id);
      if (!node || !isExportable(node)) {
        post({
          type: "export-error",
          message: `Frame ${id} is no longer available. Refresh your selection and try again.`
        });
        return;
      }
      try {
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: scale }
        });
        frames.push(__spreadProps(__spreadValues({}, frameInfo(node)), { pngBytes: bytes }));
        post({ type: "export-progress", done: i + 1, total: frameIds.length });
      } catch (err) {
        post({
          type: "export-error",
          message: `Failed to export "${node.name}": ${err.message}`
        });
        return;
      }
    }
    post({ type: "export-complete", frames });
  }
  async function loadTemplates() {
    const stored = await figma.clientStorage.getAsync(TEMPLATES_KEY);
    post({ type: "templates", templates: stored != null ? stored : [] });
  }
  async function saveTemplates(templates) {
    await figma.clientStorage.setAsync(TEMPLATES_KEY, templates);
  }
  figma.ui.onmessage = async (msg) => {
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
})();
