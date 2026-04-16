// Thin wrapper over the Confluence Cloud REST APIs we need.
// All calls use Basic auth with an email + API token. CORS is allowed by
// Atlassian for this pattern.
//
// These functions are deliberately small and composable — they cover the
// four operations the plugin needs (find space, create page, upload
// attachment, update page body). Used by the API test screen today, and
// will be used by the real export flow once permissions are confirmed.

export interface ConfluenceCreds {
  baseUrl: string; // https://yoursite.atlassian.net — no trailing slash
  email: string;
  token: string;
}

function authHeader(c: ConfluenceCreds): string {
  return "Basic " + btoa(`${c.email}:${c.token}`);
}

async function api<T>(
  c: ConfluenceCreds,
  path: string,
  init: RequestInit = {},
  label = "Request"
): Promise<T> {
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(c),
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" ? JSON.stringify(body) : String(body);
    throw new Error(`${label} failed (${res.status}): ${msg.slice(0, 400)}`);
  }
  return body as T;
}

// ── Spaces ────────────────────────────────────────────────────────────────
interface SpacesResponse {
  results: Array<{ id: string; key: string; name: string }>;
}

export async function findSpace(
  c: ConfluenceCreds,
  spaceKey: string
): Promise<{ id: string; name: string }> {
  const res = await api<SpacesResponse>(
    c,
    `/wiki/api/v2/spaces?keys=${encodeURIComponent(spaceKey)}`,
    {},
    "Lookup space"
  );
  const hit = res.results?.[0];
  if (!hit) {
    throw new Error(
      `Space "${spaceKey}" not found or not visible to your token.`
    );
  }
  return { id: hit.id, name: hit.name };
}

// ── Pages ─────────────────────────────────────────────────────────────────
interface PageResponse {
  id: string;
  title: string;
  version?: { number: number };
}

export async function createPage(
  c: ConfluenceCreds,
  spaceId: string,
  title: string,
  storageHtml: string
): Promise<{ id: string; title: string }> {
  const res = await api<PageResponse>(
    c,
    `/wiki/api/v2/pages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId,
        status: "current",
        title,
        body: { representation: "storage", value: storageHtml },
      }),
    },
    "Create page"
  );
  return { id: res.id, title: res.title };
}

export async function updatePageBody(
  c: ConfluenceCreds,
  pageId: string,
  storageHtml: string
): Promise<void> {
  // Need the current title + version to PUT an update
  const current = await api<PageResponse>(
    c,
    `/wiki/api/v2/pages/${pageId}?body-format=storage`,
    {},
    "Fetch current page"
  );
  const nextVersion = (current.version?.number || 1) + 1;
  await api(
    c,
    `/wiki/api/v2/pages/${pageId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: pageId,
        status: "current",
        title: current.title,
        version: { number: nextVersion },
        body: { representation: "storage", value: storageHtml },
      }),
    },
    "Update page"
  );
}

export async function deletePage(
  c: ConfluenceCreds,
  pageId: string
): Promise<void> {
  await api(
    c,
    `/wiki/api/v2/pages/${pageId}`,
    { method: "DELETE" },
    "Delete page"
  );
}

// ── Attachments ───────────────────────────────────────────────────────────

interface AttachmentsResponse {
  results: Array<{ id: string; title: string }>;
}

export async function uploadAttachment(
  c: ConfluenceCreds,
  pageId: string,
  filename: string,
  bytes: Uint8Array | Blob
): Promise<{ id: string; title: string }> {
  const blob =
    bytes instanceof Blob
      ? bytes
      : new Blob([bytes as BlobPart], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("minorEdit", "true");
  const res = await api<AttachmentsResponse | { id: string; title: string }>(
    c,
    `/wiki/rest/api/content/${pageId}/child/attachment`,
    {
      method: "POST",
      headers: { "X-Atlassian-Token": "nocheck" },
      body: form,
    },
    "Upload attachment"
  );
  const item =
    "results" in res && Array.isArray(res.results) ? res.results[0] : res;
  return { id: (item as { id: string }).id, title: (item as { title: string }).title };
}
