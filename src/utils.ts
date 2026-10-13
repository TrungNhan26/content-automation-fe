import type { ActivityAction, DownloadSource, Job, JobSource, JobStatus, MediaFile } from "./types";

const downloadSourceHosts: Record<DownloadSource, string[]> = {
  bilibili: ["bilibili.com", "b23.tv"],
  douyin: ["douyin.com", "iesdouyin.com"],
  tiktok: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
};

function cleanSharedUrl(candidate: string) {
  return candidate
    .replace(/\\([\\`*_[\]{}()#+\-.!])/g, "$1")
    .replace(/[.,;:!?，。；：！？'"”’)\]}>*]+$/g, "");
}

function matchesDownloadSource(candidate: string, source: DownloadSource) {
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    return downloadSourceHosts[source].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function extractDownloadInput(value: string, source: DownloadSource) {
  const input = value.trim();
  if (!input) return "";

  if (source === "bilibili") {
    const bvid = input.match(/\bBV[0-9A-Za-z]{10,}\b/i)?.[0];
    if (bvid) return bvid;
  }

  const candidates = [
    ...Array.from(input.matchAll(/\]\(\s*(https?:\/\/[^)\s]+)\s*\)/gi), (match) => match[1]),
    ...Array.from(input.matchAll(/https?:\/\/[^\s<>"'[\]()]+/gi), (match) => match[0]),
  ];
  for (const rawCandidate of candidates) {
    const candidate = cleanSharedUrl(rawCandidate);
    if (matchesDownloadSource(candidate, source)) return candidate;
  }

  return input;
}

export const statusLabel: Record<JobStatus, string> = {
  queued: "Đang chờ",
  running: "Đang xử lý",
  succeeded: "Hoàn tất",
  completed: "Hoàn tất",
  done: "Hoàn tất",
  failed: "Thất bại",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
};

export const sourceLabel: Record<JobSource, string> = {
  bilibili: "Bilibili",
  douyin: "Douyin",
  tiktok: "TikTok",
  youtube: "YouTube",
  content_editor: "Content Editor",
};

export const activityActionLabel: Record<ActivityAction, string> = {
  crawl_video: "Crawl video",
  edit_sub: "Edit sub",
  post_video: "Post video",
};

export function jobAction(job: Job): ActivityAction {
  return job.source === "content_editor" ? "edit_sub" : "crawl_video";
}

export function formatDate(value: string | number) {
  const date = typeof value === "number" && value < 10_000_000_000 ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatBytes(value?: number) {
  if (!value) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function formatDuration(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "";
  const seconds = Math.max(0, Math.round(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function jobDisplayName(job: Job) {
  return job.title || job.input_name || job.url || `${sourceLabel[job.source]} job`;
}

export function isRemoteUrl(value?: string | null) {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function fileUrl(file: MediaFile, jobId: string) {
  return file.download_url ?? file.url ?? `/api/v1/jobs/${jobId}/files/${file.id ?? encodeURIComponent(file.filename ?? file.name)}`;
}
