import type { AutopostStatus, BufferOrganization, ContentEditorCapabilities, ContentEditorPresign, ContentItem, ContentProject, ContentProjectSummary, CreateContentEditorJob, CreateDownload, DouyinSession, Job, PublishActivity, PublishPlan, PostSettings,
  StorageUsage } from "./types";

// Local backend (Crawl, Edit sub, Truyện tranh): only reachable while the PC runs it.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/v1";
// Autopost Worker on Cloudflare (login + Post video): always on. Vercel rewrites /autopost/* to it.
const AUTOPOST_URL = (import.meta.env.VITE_AUTOPOST_URL as string | undefined)?.replace(/\/$/, "") ?? "/autopost";

export const AUTH_REQUIRED_EVENT = "content-station:auth-required";

export interface AuthStatus {
  required: boolean;
  authenticated: boolean;
}

async function requestAt<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith("/auth/")) {
    // The session expired or the access code was changed: send the user back to the code screen.
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : data.error;
    throw new Error(detail || `API trả về HTTP ${response.status}.`);
  }
  return data as T;
}

const request = <T>(path: string, init?: RequestInit) => requestAt<T>(API_URL, path, init);
const autopost = <T>(path: string, init?: RequestInit) => requestAt<T>(AUTOPOST_URL, path, init);

/** Upload one file straight to R2 through the Worker (not through Vercel) and return its key. */
async function uploadMedia(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const ticket = await autopost<{ key: string; upload_url: string }>("/uploads", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, content_type: file.type || "application/octet-stream", size: file.size }),
  });
  await new Promise<void>((resolve, reject) => {
    const upload = new XMLHttpRequest();
    upload.open("PUT", ticket.upload_url);
    upload.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    upload.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    upload.onerror = () => reject(new Error("Tải file lên bị ngắt. Hãy kiểm tra mạng rồi thử lại."));
    upload.onload = () => {
      if (upload.status >= 200 && upload.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        let detail = "";
        try { detail = JSON.parse(upload.responseText).detail ?? ""; } catch { /* not JSON */ }
        reject(new Error(detail || `Tải file lên thất bại (HTTP ${upload.status}).`));
      }
    };
    upload.send(file);
  });
  return ticket.key;
}

/** True when the local backend answers (through the tunnel), within a few seconds. */
async function backendOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${API_URL}/health`, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    return data?.status === "ok" || data?.status === "healthy";
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

function unwrapList<T>(value: T[] | { items?: T[]; jobs?: T[]; workers?: T[] }): T[] {
  if (Array.isArray(value)) return value;
  return value.items ?? value.jobs ?? value.workers ?? [];
}

function putFileWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Upload R2 bị ngắt. Hãy kiểm tra mạng và cấu hình CORS của bucket."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`R2 từ chối upload với HTTP ${request.status}.`));
      }
    };
    request.send(file);
  });
}

export const api = {
  // one login (on the Worker) unlocks both: the backend accepts the Worker's session cookie
  authStatus: () => autopost<AuthStatus>("/auth/status"),
  login: (code: string) => autopost<AuthStatus>("/auth/login", { method: "POST", body: JSON.stringify({ code }) }),
  logout: () => autopost<AuthStatus>("/auth/logout", { method: "POST" }),
  backendOnline,
  health: () => request<{ status: string; version?: string }>("/health"),
  jobs: async () => unwrapList(await request<Job[] | { items?: Job[]; jobs?: Job[] }>("/jobs?limit=200")),
  job: (id: string) => request<Job>(`/jobs/${id}`),
  createDownload: (payload: CreateDownload) => request<Job>("/downloads", { method: "POST", body: JSON.stringify(payload) }),
  projects: () => autopost<ContentProjectSummary[]>("/projects"),
  storageUsage: () => autopost<StorageUsage>("/projects/storage"),
  postSettings: () => autopost<PostSettings>("/settings"),
  setAutoImport: (auto_import: boolean) => autopost<PostSettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify({ auto_import }),
  }),
  project: (id: string) => autopost<ContentProject>(`/projects/${id}`),
  deleteProject: (id: string) => autopost<void>(`/projects/${id}`, { method: "DELETE" }),
  updateContentItem: (id: string, payload: { caption: string; hashtags: string[] }) =>
    autopost<ContentItem>(`/projects/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  replaceContentItemVideo: async (id: string, file: File, onProgress?: (percent: number) => void) => {
    const key = await uploadMedia(file, onProgress);
    return autopost<ContentItem>(`/projects/items/${id}/media`, { method: "PUT", body: JSON.stringify({ keys: [key] }) });
  },
  uploadMedia,
  createProject: (payload: { title: string; caption: string; hashtags: string[]; media_type: "video" | "carousel"; keys: string[] }) =>
    autopost<ContentProject>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  createPublishPlans: (
    id: string,
    payload: {
      channels: Array<{ id: string; name: string; service: string }>;
      scheduled_at: string;
      caption: string;
      hashtags: string[];
    },
  ) => autopost<PublishPlan[]>(`/projects/items/${id}/publish-plans`, {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  douyinSession: () => request<DouyinSession>("/douyin/session"),
  restoreDouyinSession: () => request<DouyinSession>("/douyin/session/restore", {
    method: "POST",
    headers: { "X-Content-Station-Action": "restore-douyin-session" },
  }),
  contentEditorCapabilities: () => request<ContentEditorCapabilities>("/content-editor/capabilities"),
  createContentEditorJob: (payload: CreateContentEditorJob) => {
    const body = new FormData();
    body.append("file", payload.file, payload.file.name);
    body.append("operation", payload.operation);
    body.append("voice", payload.voice);
    body.append("segment_minutes", String(payload.segment_minutes));
    body.append("profile", payload.profile);
    if (payload.tts_rate?.trim()) body.append("tts_rate", payload.tts_rate.trim());
    body.append("use_gemini", String(payload.use_gemini ?? true));
    body.append("no_tts", String(payload.no_tts ?? false));
    body.append("no_render", String(payload.no_render ?? false));
    return request<Job>("/content-editor/jobs", { method: "POST", body });
  },
  createContentEditorJobViaR2: async (
    payload: CreateContentEditorJob,
    onProgress?: (percent: number) => void,
  ) => {
    const presign = await request<ContentEditorPresign>("/content-editor/uploads/presign", {
      method: "POST",
      body: JSON.stringify({
        filename: payload.file.name,
        size_bytes: payload.file.size,
        content_type: payload.file.type || "video/mp4",
      }),
    });
    await putFileWithProgress(presign.upload_url, payload.file, presign.headers, onProgress);
    return request<Job>("/content-editor/uploads/complete", {
      method: "POST",
      body: JSON.stringify({
        upload_token: presign.upload_token,
        operation: payload.operation,
        voice: payload.voice,
        segment_minutes: payload.segment_minutes,
        profile: payload.profile,
        tts_rate: payload.tts_rate ?? "",
        use_gemini: payload.use_gemini ?? true,
        no_tts: payload.no_tts ?? false,
        no_render: payload.no_render ?? false,
      }),
    });
  },
  cancelJob: (id: string) => request<Job>(`/jobs/${id}/cancel`, { method: "POST" }),
  retryJob: (id: string) => request<Job>(`/jobs/${id}/retry`, { method: "POST" }),
  sendJobToPost: (id: string) => request<{ created: number; existing: boolean }>(`/jobs/${id}/to-post`, { method: "POST" }),
  autopostStatus: () => autopost<AutopostStatus>("/workers/autopost/status"),
  publishActivity: () => autopost<PublishActivity[]>("/projects/publish-activity"),
  setAutopostEnabled: (enabled: boolean) => autopost<AutopostStatus>("/workers/autopost/control", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  }),
  autopostChannels: () => autopost<BufferOrganization[]>("/workers/autopost/channels"),
  eventUrl: (id: string) => `${API_URL}/jobs/${id}/events`,
};
