import type { Template } from "../../shared/messages";

interface Props {
  templates: Template[];
  activeId: string;
  onChange: (id: string) => void;
  onManage: () => void;
}

export function TemplatePicker({ templates, activeId, onChange, onManage }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label mb-0">Template</label>
        <button className="btn-ghost !h-6 !px-1.5 text-[11px]" onClick={onManage}>
          Manage
        </button>
      </div>
      <select
        className="select mt-1"
        value={activeId}
        onChange={(e) => onChange(e.target.value)}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.columns.length} columns
          </option>
        ))}
      </select>
    </div>
  );
}
