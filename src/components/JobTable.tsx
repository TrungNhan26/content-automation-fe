import { ArrowDownToLine, CircleX, ExternalLink, FileX, Film, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { ActivityAction, Job, JobStatus, PublishActivity } from "../types";
import { activityActionLabel, fileUrl, formatBytes, formatDate, jobAction, jobDisplayName, sourceLabel } from "../utils";
import { EmptyState } from "./EmptyState";
import { failureReason } from "./JobToasts";
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

/** Small preview of what the job produced; the backend builds and caches it once per job. */
const MEDIA_FILE = /\.(mp4|mov|m4v|webm|mkv|jpe?g|png|webp|gif)$/i;
const VIDEO_FILE = /\.(mp4|mov|m4v|webm|mkv)$/i;

function mediaFiles(job?: Job) {
  return (job?.files ?? []).filter((file) => MEDIA_FILE.test(file.name ?? file.filename ?? ""));
}

function RowThumb({ job }: { job?: Job }) {
  const [failed, setFailed] = useState(false);
  if (!job) return <span className="row-thumb row-thumb--empty" aria-hidden="true"><Send /></span>;
  if (job.status === "failed" || job.status === "cancelled") {
    return <span className="row-thumb row-thumb--empty row-thumb--failed" title="Job lỗi, không có file"><CircleX /></span>;
  }
  if (job.status !== "succeeded") return <span className="row-thumb row-thumb--empty" aria-hidden="true"><Film /></span>;
  if (!mediaFiles(job).length || failed) {
    return <span className="row-thumb row-thumb--empty" title="Không có ảnh hoặc video"><FileX /></span>;
  }
  return <img className="row-thumb" src={`/api/v1/jobs/${job.id}/thumbnail`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
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
      // One video/image: download it. Several (image posts): one zip of all of them. Never the .json.
      const media = mediaFiles(row.job);
      const download = !row.job || !media.length ? null : media.length === 1
        ? { href: fileUrl(media[0], row.job.id), label: `Tải ${media[0].name}`, title: formatBytes(media[0].size ?? media[0].size_bytes) }
        : { href: `/api/v1/jobs/${row.job.id}/media.zip`, label: `Tải ${media.length} file (.zip)`, title: `${media.filter((f) => !VIDEO_FILE.test(f.name)).length} ảnh, ${media.filter((f) => VIDEO_FILE.test(f.name)).length} video (.zip)` };
      return <div className="job-row" role="row" key={row.id}>
        <span role="cell" className={`activity-action activity-action--${row.action}`}>{activityActionLabel[row.action]}</span>
        <span role="cell" className={`source-mark source-mark--${row.sourceClass}`}>{row.source}</span>
        <span role="cell" className="job-title"><RowThumb key={`${row.id}-${row.status}`} job={row.job} /><span className="job-title__text"><strong>{row.title}</strong><small>{formatDate(row.timestamp)} · {row.detail}</small>{row.job?.status === "failed" && <small className="row-note row-note--error" title={failureReason(row.job)}>{failureReason(row.job)}</small>}{row.job?.status === "succeeded" && row.job.warning && <small className="row-note row-note--warning" title={row.job.warning}>⚠ {row.job.warning}</small>}</span></span>
        <span role="cell" className="progress-cell">{row.progress === null ? <span>—</span> : <><span>{Math.round(row.progress)}%</span><i><b style={{ transform: `scaleX(${Math.min(100, Math.max(0, row.progress)) / 100})` }} /></i></>}</span>
        <span role="cell" className="status-cell"><StatusBadge status={row.status} /></span>
        <span role="cell" className="row-actions">
          {download && <a className="icon-button" href={download.href} download aria-label={download.label} title={download.title}><ArrowDownToLine /></a>}
          <Link className="icon-button" to={row.job ? `/jobs/${row.job.id}` : "/workers"} aria-label={row.job ? "Xem chi tiết job" : "Mở Post video"}><ExternalLink /></Link>
        </span>
      </div>;
    })}
  </div>;
}
