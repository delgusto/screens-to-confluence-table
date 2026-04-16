import type { Template } from "../../shared/messages";

// Default template ships with the plugin.
export const DEFAULT_TEMPLATE: Template = {
  id: "default",
  name: "Standard review",
  columns: [
    { id: "ux-key", title: "UX Key", autoFill: "blank" },
    { id: "flow", title: "Flow", autoFill: "blank" },
    { id: "mvp", title: "MVP", autoFill: "blank" },
    { id: "scenario", title: "High Level scenario", autoFill: "blank" },
    { id: "status", title: "Status", autoFill: "blank" },
    { id: "screenshot", title: "UI Screenshot", autoFill: "figmaLink" },
    { id: "ui-type", title: "UI type", autoFill: "blank" },
    { id: "copy", title: "Copy", autoFill: "copy" },
    { id: "comments", title: "Comments", autoFill: "blank" },
    {
      id: "sign-off",
      title: "Sign off",
      autoFill: "checklist",
      checklistItems: ["Editor", "Compliance"],
    },
  ],
};

export function makeId(prefix = "col"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// If the user has never saved anything, seed with the default.
export function withDefault(stored: Template[]): Template[] {
  return stored.length > 0 ? stored : [DEFAULT_TEMPLATE];
}
