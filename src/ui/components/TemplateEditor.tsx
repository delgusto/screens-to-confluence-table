import { useState } from "react";
import type { AutoFill, Column, Template } from "../../shared/messages";
import { makeId } from "../lib/templates";

interface Props {
  templates: Template[];
  activeId: string;
  onChange: (templates: Template[], activeId: string) => void;
  onClose: () => void;
}

const AUTO_FILL_OPTIONS: { value: AutoFill; label: string }[] = [
  { value: "blank", label: "(empty cell)" },
  { value: "screenName", label: "Frame name" },
  { value: "copy", label: "Text from frame" },
  { value: "figmaLink", label: "Figma embed link" },
  { value: "screenshotInline", label: "PNG image (bulk drag onto page)" },
  { value: "screenshot", label: "PNG placeholder (drag per cell)" },
  { value: "checklist", label: "Checklist" },
];

const DEFAULT_CHECKLIST_ITEMS = ["Editor", "Compliance"];

export function TemplateEditor({ templates, activeId, onChange, onClose }: Props) {
  const [draftId, setDraftId] = useState(activeId);
  const active = templates.find((t) => t.id === draftId) ?? templates[0];

  function update(next: Template) {
    const nextList = templates.map((t) => (t.id === next.id ? next : t));
    onChange(nextList, next.id);
  }

  function addTemplate() {
    const id = makeId("tpl");
    const next: Template = {
      id,
      name: "New template",
      columns: [{ id: makeId(), title: "Column", autoFill: "blank" }],
    };
    onChange([...templates, next], id);
    setDraftId(id);
  }

  function deleteTemplate() {
    if (templates.length <= 1) return; // always keep at least one
    const remaining = templates.filter((t) => t.id !== active.id);
    onChange(remaining, remaining[0].id);
    setDraftId(remaining[0].id);
  }

  function addColumn() {
    update({
      ...active,
      columns: [
        ...active.columns,
        { id: makeId(), title: "New column", autoFill: "blank" },
      ],
    });
  }

  function updateColumn(index: number, patch: Partial<Column>) {
    const columns = active.columns.map((c, i) => {
      if (i !== index) return c;
      const next = { ...c, ...patch };
      // Seed checklist with sensible defaults the first time this column
      // is switched to "checklist" (but don't clobber existing items).
      if (
        patch.autoFill === "checklist" &&
        (!next.checklistItems || next.checklistItems.length === 0)
      ) {
        next.checklistItems = [...DEFAULT_CHECKLIST_ITEMS];
      }
      return next;
    });
    update({ ...active, columns });
  }

  function setChecklistItems(index: number, items: string[]) {
    updateColumn(index, { checklistItems: items });
  }

  function removeColumn(index: number) {
    if (active.columns.length <= 1) return;
    update({
      ...active,
      columns: active.columns.filter((_, i) => i !== index),
    });
  }

  function moveColumn(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= active.columns.length) return;
    const columns = active.columns.slice();
    [columns[index], columns[target]] = [columns[target], columns[index]];
    update({ ...active, columns });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button className="btn-ghost !px-1.5" onClick={onClose} aria-label="Back">
          ←
        </button>
        <h2 className="flex-1 font-medium">Manage templates</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="label">Template</label>
          <div className="flex gap-1.5">
            <select
              className="select flex-1"
              value={active.id}
              onChange={(e) => setDraftId(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn-secondary" onClick={addTemplate}>
              + New
            </button>
          </div>
        </div>

        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={active.name}
            onChange={(e) => update({ ...active, name: e.target.value })}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Columns</label>
            <button className="btn-ghost !h-6 !px-1.5 text-[11px]" onClick={addColumn}>
              + Add column
            </button>
          </div>
          <div className="rounded border border-border divide-y divide-border">
            {active.columns.map((col, i) => (
              <div key={col.id} className="p-2 space-y-1.5">
                <div className="flex gap-1">
                  <input
                    className="input flex-1"
                    value={col.title}
                    onChange={(e) => updateColumn(i, { title: e.target.value })}
                  />
                  <button
                    className="btn-ghost !px-1.5"
                    onClick={() => moveColumn(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn-ghost !px-1.5"
                    onClick={() => moveColumn(i, 1)}
                    disabled={i === active.columns.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    className="btn-ghost !px-1.5 text-danger"
                    onClick={() => removeColumn(i)}
                    disabled={active.columns.length <= 1}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
                <select
                  className="select"
                  value={col.autoFill}
                  onChange={(e) =>
                    updateColumn(i, { autoFill: e.target.value as AutoFill })
                  }
                >
                  {AUTO_FILL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      Auto-fill: {o.label}
                    </option>
                  ))}
                </select>
                {col.autoFill === "checklist" && (
                  <ChecklistItemsEditor
                    items={col.checklistItems ?? []}
                    onChange={(items) => setChecklistItems(i, items)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {templates.length > 1 && (
          <button
            className="btn-ghost text-danger w-full justify-center"
            onClick={deleteTemplate}
          >
            Delete this template
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Checklist items sub-editor ──────────────────────────────────────────
// Renders inside a column card when that column's autoFill is "checklist".
// Plain list of text items with add/remove; no reorder in v1.

function ChecklistItemsEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addItem() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft("");
  }

  function updateItem(index: number, value: string) {
    onChange(items.map((item, i) => (i === index ? value : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded bg-muted p-1.5 space-y-1 border border-border">
      <div className="text-[10px] uppercase tracking-wide text-fg-muted px-1">
        Checklist items
      </div>
      {items.length === 0 && (
        <div className="px-1 pb-1 text-[11px] text-fg-muted">
          No items yet — add reviewer roles below.
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex gap-1">
          <span className="flex items-center px-1">
            <input type="checkbox" disabled aria-hidden="true" />
          </span>
          <input
            className="input flex-1 bg-white"
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder="e.g. Editor"
          />
          <button
            className="btn-ghost !px-1.5 text-danger"
            onClick={() => removeItem(i)}
            aria-label="Remove item"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-1">
        <input
          className="input flex-1 bg-white"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Add item…"
        />
        <button
          className="btn-secondary"
          onClick={addItem}
          disabled={!draft.trim()}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
