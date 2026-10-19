import { AlertTriangle, CircleX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Job } from "../types";
import { jobDisplayName } from "../utils";

type Toast = { id: string; jobId: string; kind: "error" | "warning"; title: string; text: string };

const AUTO_CLOSE_MS = 15000;

/** "Job failed: <reason>" is how the backend stores failures; the reason is what users need. */
export function failureReason(job: Job) {
  return (job.message || "").replace(/^Job failed:\s*/, "") || "Job thất bại.";
}

/**
 * Pops a notice when a job the user is waiting on fails or finishes with a warning.
 * Jobs already finished when the page loads are not announced again.
 */
export function JobToasts({ jobs }: { jobs: Job[] }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const previous = useRef<Map<string, Job["status"]> | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = new Map(jobs.map((job) => [job.id, job.status]));
    if (!before) return;
    const fresh: Toast[] = [];
    for (const job of jobs) {
      const was = before.get(job.id);
      const wasActive = was === undefined || was === "queued" || was === "running";
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
