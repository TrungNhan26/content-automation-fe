import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, XCircle } from "lucide-react";
import type { JobStatus } from "../types";
import { statusLabel } from "../utils";

export function StatusBadge({ status }: { status: JobStatus }) {
  const Icon = status === "running" ? LoaderCircle : status === "queued" ? Clock3 : status === "failed" ? AlertCircle : status.startsWith("cancel") ? XCircle : CheckCircle2;
  return <span className={`status status--${status}`}><Icon aria-hidden="true" />{statusLabel[status] ?? status}</span>;
}
