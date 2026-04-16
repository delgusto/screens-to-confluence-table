import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type {
  ExportedFrame,
  FrameInfo,
  SandboxToUi,
  Template,
} from "../shared/messages";
import { onSandboxMessage, postToSandbox } from "./lib/bridge";
import { DEFAULT_TEMPLATE, withDefault } from "./lib/templates";
import {
  buildHtmlTable,
  estimateHtmlBytes,
  formatBytes,
  type FrameForTable,
} from "./lib/buildHtmlTable";
import { copyHtml } from "./lib/copyToClipboard";
import { buildFigmaFrameUrl } from "./lib/figmaUrl";
import { parseFigmaFileKey } from "./lib/parseFigmaUrl";
import { buildZipBlob, planZipEntries, type ZipEntry } from "./lib/buildZip";
import { downloadBlob } from "./lib/downloadBlob";
import { buildFilename } from "./lib/filenames";
import { FrameList } from "./components/FrameList";
import { TemplatePicker } from "./components/TemplatePicker";
import { TemplateEditor } from "./components/TemplateEditor";

const MANUAL_URL_KEY = "lastFigmaUrl";

interface Prepared {
  html: string;
  htmlBytes: number;
  zipEntries: ZipEntry[];
  zipFilename: string;
  rows: number;
}

type ScreenshotStep = "download" | "copy" | "done";

type Status =
  | { kind: "idle" }
  | { kind: "copied" }
  | { kind: "exporting"; done: number; total: number }
  | { kind: "error"; message: string };

export function App() {
  const [view, setView] = useState<"main" | "editor">("main");
  const [frames, setFrames] = useState<FrameInfo[]>([]);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([DEFAULT_TEMPLATE]);
  const [activeId, setActiveId] = useState<string>(DEFAULT_TEMPLATE.id);
  const [scale, setScale] = useState<number>(2);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [step, setStep] = useState<ScreenshotStep>("download");
  const [manualUrl, setManualUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(MANUAL_URL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const hydrated = useRef(false);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeId) ?? templates[0],
    [templates, activeId]
  );

  // Does this template need PNG bytes? Both screenshot modes do — the
  // per-cell drag mode ("screenshot") and the bulk-drag mode
  // ("screenshotInline"). Either triggers the Prepare → Download → Copy
  // flow; otherwise it's a single-click Copy.
  const needsScreenshots = useMemo(
    () =>
      activeTemplate.columns.some(
        (c) =>
          c.autoFill === "screenshot" || c.autoFill === "screenshotInline"
      ),
    [activeTemplate]
  );

  // Which drag style does the template expect? Matters for the step-4
  // instructions in the StepList.
  const usesBulkDrag = useMemo(
    () =>
      activeTemplate.columns.some((c) => c.autoFill === "screenshotInline"),
    [activeTemplate]
  );
  const usesPerCellDrag = useMemo(
    () => activeTemplate.columns.some((c) => c.autoFill === "screenshot"),
    [activeTemplate]
  );

  const hasFigmaLink = useMemo(
    () => activeTemplate.columns.some((c) => c.autoFill === "figmaLink"),
    [activeTemplate]
  );

  const effectiveFileKey = useMemo(
    () => fileKey ?? parseFigmaFileKey(manualUrl),
    [fileKey, manualUrl]
  );

  const urlLooksValid =
    manualUrl.length > 0 && parseFigmaFileKey(manualUrl) !== null;
  const urlLooksInvalid = manualUrl.length > 0 && !urlLooksValid;

  useEffect(() => {
    const off = onSandboxMessage((msg: SandboxToUi) => {
      switch (msg.type) {
        case "selection":
          setFrames(msg.frames);
          setFileKey(msg.fileKey);
          setFileName(msg.fileName);
          resetAll();
          break;
        case "templates": {
          const list = withDefault(msg.templates);
          setTemplates(list);
          setActiveId((prev) =>
            list.some((t) => t.id === prev) ? prev : list[0].id
          );
          hydrated.current = true;
          break;
        }
        case "export-progress":
          setStatus({
            kind: "exporting",
            done: msg.done,
            total: msg.total,
          });
          break;
        case "export-complete":
          handleExportComplete(msg.frames);
          break;
        case "export-error":
          setStatus({ kind: "error", message: msg.message });
          setPrepared(null);
          break;
      }
    });
    postToSandbox({ type: "ui-ready" });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    postToSandbox({ type: "save-templates", templates });
  }, [templates]);

  // Reset prepared state whenever the active template's *contents* change,
  // not just when the user switches templates. Previously we only watched
  // activeId — but editing a column (rename, autofill change, etc.) on
  // the currently active template left `prepared.html` stale, so the next
  // Copy click produced the old columns. Watching activeTemplate's
  // reference catches this because useMemo returns a new object when
  // templates is rewritten by the editor.
  useEffect(() => {
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate, scale]);

  useEffect(() => {
    try {
      localStorage.setItem(MANUAL_URL_KEY, manualUrl);
    } catch {
      /* ignore */
    }
  }, [manualUrl]);

  function resetAll() {
    setStatus({ kind: "idle" });
    setPrepared(null);
    setStep("download");
  }

  function frameForTableRow(frame: FrameInfo, index: number, total: number): FrameForTable {
    return {
      name: frame.name,
      copy: frame.copy,
      figmaUrl: buildFigmaFrameUrl(effectiveFileKey, fileName, frame.id),
      pngFilename: buildFilename(index, total, frame.name),
    };
  }

  // ─── Link-only flow ────────────────────────────────────────────────────
  function copyLinkTable() {
    try {
      const forTable = frames.map((f, i) => frameForTableRow(f, i, frames.length));
      const html = buildHtmlTable(activeTemplate.columns, forTable);
      copyHtml(html);
      setStatus({ kind: "copied" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error).message || "Couldn't copy to clipboard.",
      });
    }
  }

  // ─── Screenshot flow ────────────────────────────────────────────────────
  function startExport() {
    setPrepared(null);
    setStep("download");
    setStatus({ kind: "exporting", done: 0, total: frames.length });
    postToSandbox({
      type: "request-export",
      frameIds: frames.map((f) => f.id),
      scale,
    });
  }

  function handleExportComplete(exported: ExportedFrame[]) {
    const zipEntries = planZipEntries(exported);
    const forTable: FrameForTable[] = zipEntries.map(({ filename, frame }) => ({
      name: frame.name,
      copy: frame.copy,
      figmaUrl: buildFigmaFrameUrl(effectiveFileKey, fileName, frame.id),
      pngFilename: filename,
    }));
    const html = buildHtmlTable(activeTemplate.columns, forTable);
    const htmlBytes = estimateHtmlBytes(activeTemplate.columns, forTable);
    const zipFilename = `${activeTemplate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "screens"}.zip`;
    setPrepared({ html, htmlBytes, zipEntries, zipFilename, rows: exported.length });
    setStep("download");
    setStatus({ kind: "idle" });
  }

  async function doDownload() {
    if (!prepared) return;
    try {
      const blob = await buildZipBlob(prepared.zipEntries);
      downloadBlob(blob, prepared.zipFilename);
      setStep("copy");
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error).message || "Couldn't build zip.",
      });
    }
  }

  function doCopyScreenshot() {
    if (!prepared) return;
    try {
      copyHtml(prepared.html);
      setStep("done");
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error).message || "Couldn't copy to clipboard.",
      });
    }
  }

  function updateTemplates(next: Template[], nextActiveId: string) {
    setTemplates(next);
    setActiveId(nextActiveId);
  }

  if (view === "editor") {
    return (
      <TemplateEditor
        templates={templates}
        activeId={activeId}
        onChange={updateTemplates}
        onClose={() => setView("main")}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-3 py-2 border-b border-border">
        <h1 className="font-medium">Screens → Confluence</h1>
        <p className="text-fg-muted text-[11px] mt-0.5">
          Build a review table from selected frames.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <FrameList frames={frames} />

        <TemplatePicker
          templates={templates}
          activeId={activeId}
          onChange={setActiveId}
          onManage={() => setView("editor")}
        />

        {needsScreenshots && (
          <div>
            <label className="label">Screenshot resolution</label>
            <select
              className="select"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            >
              <option value={1}>1× (smaller file)</option>
              <option value={2}>2× (recommended)</option>
              <option value={3}>3× (sharper, larger)</option>
            </select>
          </div>
        )}

        {hasFigmaLink && !fileKey && (
          <div
            className={clsx(
              "rounded p-2 space-y-1.5 border",
              urlLooksValid
                ? "bg-green-50 border-green-200"
                : "bg-yellow-50 border-yellow-300"
            )}
          >
            <div
              className={clsx(
                "text-[11px] leading-[1.5]",
                urlLooksValid ? "text-green-900" : "text-yellow-900"
              )}
            >
              {urlLooksValid ? (
                <>✓ Using this file's URL for the embed links.</>
              ) : (
                <>
                  Paste this file's Figma URL so the embed links work.
                  (Figma only exposes the fileKey to published plugins, so
                  we need it from you during development.)
                </>
              )}
            </div>
            <input
              className="input"
              placeholder="https://www.figma.com/design/…"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            {urlLooksInvalid && (
              <div className="text-[11px] text-red-700">
                That doesn't look like a Figma URL. Expected:{" "}
                <span className="font-mono">figma.com/design/&lt;key&gt;/…</span>
              </div>
            )}
          </div>
        )}

        {needsScreenshots && prepared && (
          <StepList
            step={step}
            prepared={prepared}
            usesBulkDrag={usesBulkDrag}
            usesPerCellDrag={usesPerCellDrag}
          />
        )}

        {status.kind === "copied" && (
          <div className="rounded p-2 text-[11px] leading-[1.5] bg-green-50 text-green-900 border border-green-200 space-y-1">
            <div className="font-medium">Copied ✓</div>
            <div>Paste into your Confluence page.</div>
            {hasFigmaLink && (
              <div className="text-fg-muted">
                To convert all Figma links to Embed in one action: click
                the first link, ⌘-click (or Shift-click) each other link,
                then use the Smart Link appearance dropdown → Embed.
                (Pro tip: Confluence settings let you set figma.com links
                to default to Embed.)
              </div>
            )}
            <div className="text-fg-muted">
              Reviewers without a Figma account will see a login prompt
              unless the file is shared as "Anyone with the link can view."
            </div>
          </div>
        )}

        {status.kind === "error" && (
          <div className="rounded p-2 text-[11px] leading-[1.5] bg-red-50 text-red-900 border border-red-200">
            <div className="font-medium">Something went wrong</div>
            <div className="mt-0.5">{status.message}</div>
          </div>
        )}
      </div>

      <footer className="border-t border-border p-3 space-y-1.5">
        {needsScreenshots
          ? renderScreenshotFooter(
              step,
              status,
              frames.length,
              prepared,
              startExport,
              doDownload,
              doCopyScreenshot
            )
          : renderLinkFooter(frames.length, copyLinkTable)}
      </footer>
    </div>
  );
}

function renderLinkFooter(frameCount: number, onCopy: () => void) {
  return (
    <button
      className="btn-primary w-full"
      disabled={frameCount === 0}
      onClick={onCopy}
    >
      {frameCount === 0
        ? "Select frames to continue"
        : `Copy table (${frameCount} ${
            frameCount === 1 ? "frame" : "frames"
          })`}
    </button>
  );
}

function renderScreenshotFooter(
  step: ScreenshotStep,
  status: Status,
  frameCount: number,
  prepared: Prepared | null,
  onPrepare: () => void,
  onDownload: () => void,
  onCopy: () => void
) {
  if (!prepared) {
    return (
      <button
        className="btn-primary w-full"
        disabled={frameCount === 0 || status.kind === "exporting"}
        onClick={onPrepare}
      >
        {status.kind === "exporting"
          ? `Exporting ${status.done}/${status.total}…`
          : `Prepare (${frameCount} ${
              frameCount === 1 ? "frame" : "frames"
            })`}
      </button>
    );
  }
  if (step === "download") {
    return (
      <>
        <button className="btn-primary w-full" onClick={onDownload}>
          Download screenshots
        </button>
        <button
          className="btn-ghost w-full !h-7 text-[11px]"
          onClick={onPrepare}
        >
          Re-prepare
        </button>
      </>
    );
  }
  if (step === "copy") {
    return (
      <>
        <button className="btn-primary w-full" onClick={onCopy}>
          Copy table to clipboard
        </button>
        <button
          className="btn-ghost w-full !h-7 text-[11px]"
          onClick={onDownload}
        >
          Download again
        </button>
      </>
    );
  }
  return (
    <>
      <div className="text-center text-[11px] text-green-700 py-1">
        Copied ✓ — paste in Confluence, then drop each PNG into its row
      </div>
      <button className="btn-secondary w-full" onClick={onPrepare}>
        Start over
      </button>
    </>
  );
}

function StepList({
  step,
  prepared,
  usesBulkDrag,
  usesPerCellDrag,
}: {
  step: ScreenshotStep;
  prepared: Prepared;
  usesBulkDrag: boolean;
  usesPerCellDrag: boolean;
}) {
  const downloadDone = step === "copy" || step === "done";
  const copyDone = step === "done";

  // Pick the right step-4 copy based on which drag style the template
  // expects. If both modes are mixed in one template, show both.
  const dragInstructions: { label: string; detail: string }[] = [];
  if (usesBulkDrag) {
    dragInstructions.push({
      label: "Drag all PNGs onto the Confluence page",
      detail:
        "Select every PNG in the extracted folder and drag them onto the page at once. Confluence attaches each by filename; the <img> tags in the table then resolve to the attachments.",
    });
  }
  if (usesPerCellDrag) {
    dragInstructions.push({
      label: "Drag each PNG into its row",
      detail:
        "Screenshot cells show the filename that belongs there. Drop the file onto the cell — it attaches and inserts at the same time.",
    });
  }

  const items: {
    label: string;
    detail: string;
    state: "done" | "current" | "upcoming";
  }[] = [
    {
      label: "Download screenshots",
      detail: `${prepared.rows} PNG${prepared.rows === 1 ? "" : "s"} in ${
        prepared.zipFilename
      }`,
      state: downloadDone ? "done" : step === "download" ? "current" : "upcoming",
    },
    {
      label: "Unzip the downloaded file",
      detail: "Extract the zip so you can drag the PNGs later.",
      state: copyDone ? "done" : step === "copy" ? "current" : "upcoming",
    },
    {
      label: "Copy & paste the table into Confluence",
      detail: `HTML table (~${formatBytes(prepared.htmlBytes)}).`,
      state: copyDone ? "done" : step === "copy" ? "current" : "upcoming",
    },
    ...dragInstructions.map((d) => ({
      ...d,
      state: (copyDone ? "current" : "upcoming") as "current" | "upcoming",
    })),
  ];

  return (
    <ol className="rounded border border-border divide-y divide-border">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2 px-2 py-1.5">
          <div
            className={clsx(
              "flex-none w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium tabular-nums mt-0.5",
              s.state === "done" && "bg-green-500 text-white",
              s.state === "current" && "bg-accent text-white",
              s.state === "upcoming" && "bg-muted text-fg-muted"
            )}
          >
            {s.state === "done" ? "✓" : i + 1}
          </div>
          <div className="flex-1">
            <div
              className={clsx(
                "font-medium",
                s.state === "upcoming" && "text-fg-muted"
              )}
            >
              {s.label}
            </div>
            <div className="text-[11px] text-fg-muted mt-0.5">{s.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
