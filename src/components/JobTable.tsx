import { ArrowDownToLine, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { ActivityAction, Job, JobStatus, PublishActivity } from "../types";
import { activityActionLabel, fileUrl, formatBytes, formatDate, jobAction, jobDisplayName, sourceLabel } from "../utils";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";

type ActionFilter = ActivityAction | "all";
type StatusFilter = "all" | "running" | "succeeded" | "failed";

type ActivityRow = {
  id: string;
  action: ActivityAction;
  source: string;
  sourceClass: string;
  title: string;
  detail: string;
  timestamp: string | number;
  progress: number | null;
  status: JobStatus;
  job?: Job;
};

function statusMatches(status: JobStatus, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "running") return status === "queued" || status === "running";
  if (filter === "succeeded") return status === "succeeded" || status === "completed" || status === "done";
  return status === "failed" || status === "cancelled" || status === "canceled";
}

function jobRow(job: Job): ActivityRow {
  return {
    id: job.id,
    action: jobAction(job),
    source: sourceLabel[job.source],
    sourceClass: job.source,
    title: jobDisplayName(job),
    detail: `#${job.id.slice(0, 8)}`,
    timestamp: job.updated_at || job.created_at,
    progress: job.progress || 0,
    status: job.status,
    job,
  };
}

function postRow(item: PublishActivity): ActivityRow {
  const complete = item.status === "posted";
  const failed = item.status === "failed";
  return {
    id: `post-${item.id}`,
    action: "post_video",
    source: "Autopost",
    sourceClass: "autopost",
    title: item.title,
    detail: item.channel_name || item.channel_service || "Buffer",
    timestamp: item.updated_at || item.scheduled_at,
    progress: complete ? 100 : failed ? null : 50,
    status: complete ? "succeeded" : failed ? "failed" : "running",
  };
}

export function JobTable({ jobs, limit, postHistory = [], query = "", action = "all", status = "all" }: { jobs: Job[]; limit?: number; postHistory?: PublishActivity[]; query?: string; action?: ActionFilter; status?: StatusFilter }) {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const activity = [...jobs.map(jobRow), ...postHistory.map(postRow)]
    .filter((row) => action === "all" || row.action === action)
    .filter((row) => statusMatches(row.status, status))
    .filter((row) => !normalizedQuery || `${row.title} ${row.source} ${row.detail} ${row.id}`.toLocaleLowerCase("vi").includes(normalizedQuery))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  const rows = typeof limit === "number" ? activity.slice(0, limit) : activity;

  if (!rows.length) return <EmptyState compact />;
  return <div className="job-table" role="table" aria-label="Danh sách hoạt động">
    <div className="job-row job-row--head" role="row">
      <span role="columnheader">Thao tác</span><span role="columnheader">Nguồn</span><span role="columnheader">Nội dung</span><span role="columnheader">Tiến độ</span><span role="columnheader">Trạng thái</span><span role="columnheader" aria-label="Mở hoặc tải" />
    </div>
    {rows.map((row) => {
      const firstFile = row.job?.files?.find((file) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) ?? row.job?.files?.[0];
      return <div className="job-row" role="row" key={row.id}>
        <span role="cell" className={`activity-action activity-action--${row.action}`}>{activityActionLabel[row.action]}</span>
        <span role="cell" className={`source-mark source-mark--${row.sourceClass}`}>{row.source}</span>
        <span role="cell" className="job-title"><strong>{row.title}</strong><small>{formatDate(row.timestamp)} · {row.detail}</small></span>
        <span role="cell" className="progress-cell">{row.progress === null ? <span>—</span> : <><span>{Math.round(row.progress)}%</span><i><b style={{ transform: `scaleX(${Math.min(100, Math.max(0, row.progress)) / 100})` }} /></i></>}</span>
        <span role="cell" className="status-cell"><StatusBadge status={row.status} /></span>
        <span role="cell" className="row-actions">
          {row.job && firstFile && <a className="icon-button" href={fileUrl(firstFile, row.job.id)} aria-label={`Tải ${firstFile.name}`} title={`${formatBytes(firstFile.size ?? firstFile.size_bytes)}`}><ArrowDownToLine /></a>}
          <Link className="icon-button" to={row.job ? `/jobs/${row.job.id}` : "/workers"} aria-label={row.job ? "Xem chi tiết job" : "Mở Post video"}><ExternalLink /></Link>
        </span>
      </div>;
    })}
  </div>;
}
