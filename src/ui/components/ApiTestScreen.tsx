import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  createPage,
  deletePage,
  findSpace,
  updatePageBody,
  uploadAttachment,
  type ConfluenceCreds,
} from "../lib/confluenceApi";

// Saved via localStorage in the plugin iframe. We persist URL + email +
// space key so the user doesn't retype them — but NOT the token, which is
// a secret and should be re-entered each session.
const LS_KEY = "confluence-test-config";

interface Saved {
  baseUrl: string;
  email: string;
  spaceKey: string;
}

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { baseUrl: "", email: "", spaceKey: "" };
    const parsed = JSON.parse(raw);
    return {
      baseUrl: parsed.baseUrl ?? "",
      email: parsed.email ?? "",
      spaceKey: parsed.spaceKey ?? "",
    };
  } catch {
    return { baseUrl: "", email: "", spaceKey: "" };
  }
}

function saveFields(s: Saved) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

type LogEntry = { kind: "info" | "ok" | "fail"; text: string };

// A 1×1 transparent PNG, for the upload test.
const TINY_PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
  ),
  (ch) => ch.charCodeAt(0)
);

export function ApiTestScreen({ onClose }: { onClose: () => void }) {
  const saved = useRef(loadSaved());
  const [baseUrl, setBaseUrl] = useState(saved.current.baseUrl);
  const [email, setEmail] = useState(saved.current.email);
  const [spaceKey, setSpaceKey] = useState(saved.current.spaceKey);
  const [token, setToken] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [createdPageId, setCreatedPageId] = useState<string | null>(null);

  useEffect(() => {
    saveFields({ baseUrl, email, spaceKey });
  }, [baseUrl, email, spaceKey]);

  function add(kind: LogEntry["kind"], text: string) {
    setLog((prev) => [...prev, { kind, text }]);
  }

  async function runTests() {
    setLog([]);
    setCreatedPageId(null);

    const url = baseUrl.trim().replace(/\/+$/, "");
    if (!url || !email.trim() || !token.trim() || !spaceKey.trim()) {
      add("fail", "Fill in all four fields.");
      return;
    }
    const creds: ConfluenceCreds = {
      baseUrl: url,
      email: email.trim(),
      token: token.trim(),
    };

    setRunning(true);
    try {
      // 1. Find space
      add("info", `Step 1: looking up space "${spaceKey}"…`);
      let spaceId: string;
      try {
        const space = await findSpace(creds, spaceKey.trim());
        spaceId = space.id;
        add("ok", `✓ Found space "${space.name}" (id ${spaceId})`);
      } catch (e) {
        add("fail", `✗ ${(e as Error).message}`);
        add(
          "info",
          "Likely: auth wrong, space key doesn't exist for your token, or CORS is blocked from the plugin iframe."
        );
        return;
      }

      // 2. Create page
      add("info", "Step 2: creating a test page…");
      let pageId: string;
      try {
        const page = await createPage(
          creds,
          spaceId,
          `API Test — ${new Date().toISOString().slice(0, 19)}`,
          "<p>Auto-created by the plugin's API permission test. Safe to delete.</p>"
        );
        pageId = page.id;
        setCreatedPageId(pageId);
        add("ok", `✓ Created page (id ${pageId})`);
      } catch (e) {
        add("fail", `✗ ${(e as Error).message}`);
        add("info", "Your token can read but not write pages in this space.");
        return;
      }

      // 3. Upload attachment
      add("info", "Step 3: uploading a 1×1 PNG attachment…");
      let attachmentName: string;
      try {
        const att = await uploadAttachment(
          creds,
          pageId,
          "api-test.png",
          TINY_PNG_BYTES
        );
        attachmentName = att.title;
        add("ok", `✓ Uploaded "${attachmentName}"`);
      } catch (e) {
        add("fail", `✗ ${(e as Error).message}`);
        add("info", "Can create pages but not upload attachments. Dead end for images.");
        return;
      }

      // 4. Update page body referencing the attachment
      add("info", "Step 4: updating page body with an image macro…");
      try {
        await updatePageBody(
          creds,
          pageId,
          `<p>Updated via API.</p><p><ac:image><ri:attachment ri:filename="${attachmentName}" /></ac:image></p>`
        );
        add("ok", "✓ Page body updated");
      } catch (e) {
        add("fail", `✗ ${(e as Error).message}`);
        return;
      }

      add("info", "—");
      add("ok", "All four steps passed. The full API path will work.");
      add(
        "info",
        `View: ${url}/wiki/spaces/${spaceKey}/pages/${pageId}`
      );
    } finally {
      setRunning(false);
    }
  }

  async function cleanup() {
    if (!createdPageId) return;
    const url = baseUrl.trim().replace(/\/+$/, "");
    const creds: ConfluenceCreds = {
      baseUrl: url,
      email: email.trim(),
      token: token.trim(),
    };
    try {
      await deletePage(creds, createdPageId);
      add("ok", `✓ Deleted test page ${createdPageId}`);
      setCreatedPageId(null);
    } catch (e) {
      add("fail", `✗ Cleanup failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button className="btn-ghost !px-1.5" onClick={onClose} aria-label="Back">
          ←
        </button>
        <h2 className="flex-1 font-medium">Test Confluence API</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <p className="text-fg-muted text-[11px] leading-[1.5]">
          Runs 4 API calls against your Confluence: lookup space, create a test page, upload a 1×1 PNG, update the page body. Token stays in memory only — not saved.
        </p>

        <div>
          <label className="label">Confluence URL</label>
          <input
            className="input"
            placeholder="https://yoursite.atlassian.net"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label">Your Atlassian email</label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label">API token</label>
          <input
            className="input"
            type="password"
            placeholder="Token from id.atlassian.com"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label">Space key</label>
          <input
            className="input"
            placeholder="DESIGN or ~yourid"
            value={spaceKey}
            onChange={(e) => setSpaceKey(e.target.value)}
            autoComplete="off"
          />
        </div>

        {log.length > 0 && (
          <div className="rounded border border-border bg-muted p-2 space-y-0.5 text-[11px] font-mono leading-[1.4] max-h-56 overflow-y-auto">
            {log.map((entry, i) => (
              <div
                key={i}
                className={clsx(
                  entry.kind === "ok" && "text-green-700",
                  entry.kind === "fail" && "text-red-700",
                  entry.kind === "info" && "text-fg-muted"
                )}
              >
                {entry.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 space-y-2">
        <button
          className="btn-primary w-full"
          disabled={running}
          onClick={runTests}
        >
          {running ? "Running…" : "Run tests"}
        </button>
        {createdPageId && !running && (
          <button className="btn-ghost w-full !h-7 text-[11px]" onClick={cleanup}>
            Delete test page
          </button>
        )}
      </div>
    </div>
  );
}
