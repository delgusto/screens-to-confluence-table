import type { FrameInfo } from "../../shared/messages";

interface Props {
  frames: FrameInfo[];
}

export function FrameList({ frames }: Props) {
  if (frames.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-4 text-center text-fg-muted">
        Select one or more frames in Figma to get started.
      </div>
    );
  }
  return (
    <div className="rounded border border-border divide-y divide-border">
      {frames.map((f, i) => (
        <div key={f.id} className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-fg-muted tabular-nums w-5 text-right">
            {i + 1}
          </span>
          <span className="flex-1 truncate">{f.name}</span>
          <span className="text-fg-muted tabular-nums text-[11px]">
            {f.width}×{f.height}
          </span>
        </div>
      ))}
    </div>
  );
}
