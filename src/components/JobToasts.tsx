import { AlertTriangle, CircleX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Job } from "../types";
import { jobDisplayName } from "../utils";

type Toast = { id: string; jobId: string; kind: "error" | "warning"; title: string; text: string };

const AUTO_CLOSE_MS = 3000;

const RETRY_HINT = "Bấm “Chạy lại” trong job để thử lại.";

// Older jobs (and a few engine paths) still store English reasons; show them in plain Vietnamese.
const KNOWN_FAILURES: [RegExp, string][] = [
  [/Douyin engine (failed \d+ of \d+ item|produced no successful download|returned no result)/i,
    `Không tải được bài từ Douyin: Douyin chặn tạm thời, hoặc bài đã bị xoá/để riêng tư. ${RETRY_HINT}`],
  [/Could not resolve Douyin short URL/i, "Link rút gọn Douyin không mở được (link sai hoặc đã hết hạn)."],
  [/Unsupported Douyin URL/i, "Link Douyin không đúng dạng. Dán link chia sẻ của bài (v.douyin.com/…)."],
  [/expects a \w+ URL/i, "Chế độ đã chọn không khớp loại link. Để chế độ Auto rồi thử lại."],
  [/No safe output files|completed without output files/i, `Tải xong nhưng không có file nào dùng được. ${RETRY_HINT}`],
];

/** "Job failed: <reason>" is how the backend stores failures; the reason is what users need. */
export function failureReason(job: Job) {
  const reason = (job.message || "").replace(/^Job failed:\s*/, "").trim();
  if (!reason) return "Job thất bại.";
  return KNOWN_FAILURES.find(([pattern]) => pattern.test(reason))?.[1] ?? reason;
}

/** A finished job worth flagging even though it "succeeded" (warning, or nothing to download). */
export function successNote(job: Job, hasMedia: boolean) {
  if (job.status !== "succeeded") return "";
  if (job.warning) return job.warning;
  if (/no new items/i.test(job.message || "")) return "Không có file mới: bài này đã được tải ở job trước nên được bỏ qua.";
  if (!hasMedia) return "Xong nhưng không có ảnh hoặc video nào.";
  return "";
}

/**
 * Pops a notice when a job the user is waiting on fails or finishes with a warning.
 * Only jobs seen running (or created) after the page opened are announced: the list is empty
 * until the backend answers, and old failures must not pop up again on every visit.
 */
export function JobToasts({ jobs }: { jobs: Job[] }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const previous = useRef<Map<string, Job["status"]> | null>(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    // The first non-empty list is the baseline; nothing in it is news.
    if (!previous.current) {
      if (jobs.length) previous.current = new Map(jobs.map((job) => [job.id, job.status]));
      return;
    }
    const before = previous.current;
    previous.current = new Map(jobs.map((job) => [job.id, job.status]));
    const fresh: Toast[] = [];
    for (const job of jobs) {
      const was = before.get(job.id);
      const isNew = was === undefined && new Date(job.created_at).getTime() >= openedAt.current - 60_000;
      const wasActive = isNew || was === "queued" || was === "running";
      if (!wasActive || was === job.status) continue;
      if (job.status === "failed") {
        fresh.push({ id: `${job.id}-failed`, jobId: job.id, kind: "error", title: `Thất bại: ${jobDisplayName(job)}`, text: failureReason(job) });
      } else if (job.status === "succeeded" && job.warning) {
        fresh.push({ id: `${job.id}-warning`, jobId: job.id, kind: "warning", title: `Xong, cần kiểm tra: ${jobDisplayName(job)}`, text: job.warning });
      }
    }
    if (fresh.length) setToasts((current) => [...current.filter((t) => !fresh.some((f) => f.id === t.id)), ...fresh].slice(-4));
  }, [jobs]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => setToasts((current) => current.slice(1)), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (!toasts.length) return null;
  return <div className="job-toasts" role="status" aria-live="polite">
    {toasts.map((toast) => <div key={toast.id} className={`job-toast job-toast--${toast.kind}`}>
      {toast.kind === "error" ? <CircleX aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.text}</p>
        <Link to={`/jobs/${toast.jobId}`} onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}>Xem job</Link>
      </div>
      <button type="button" className="icon-button" aria-label="Đóng thông báo" onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}><X /></button>
    </div>)}
  </div>;
}
