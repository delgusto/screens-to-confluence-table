import type { SandboxToUi, UiToSandbox } from "../../shared/messages";

// Thin wrapper around the sandbox ↔ UI message channel.
// Figma wraps every UI-bound message in { pluginMessage, pluginId }.

export function postToSandbox(msg: UiToSandbox): void {
  parent.postMessage({ pluginMessage: msg }, "*");
}

export function onSandboxMessage(handler: (msg: SandboxToUi) => void): () => void {
  const listener = (event: MessageEvent) => {
    const payload = event.data?.pluginMessage as SandboxToUi | undefined;
    if (payload) handler(payload);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
