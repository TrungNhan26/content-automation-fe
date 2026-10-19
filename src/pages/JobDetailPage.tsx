import { ArrowDownToLine, Ban, RefreshCw, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { usePolling } from "../hooks";
import { fileUrl, formatBytes, formatDate, formatDuration, isRemoteUrl, jobDisplayName, sourceLabel } from "../utils";

function isVideoFile(name: string, mimeType?: string) {
  return Boolean(mimeType?.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(name));
}

function splitFileName(name: string) {
  const extensionStart = name.lastIndexOf(".");
  if (extensionStart <= 0 || extensionStart === name.length - 1) {
    return { stem: name, extension: "" };
  }
  return {
    stem: name.slice(0, extensionStart),
    extension: name.slice(extensionStart),
  };
}

export function JobDetailPage() {
  const { id = "" } = useParams();
  const loader = useCallback(() => api.job(id), [id]);
  const { data: job, error, loading, refresh } = usePolling(loader, 1500);
  const [postState, setPostState] = useState("");
  if (loading) return <div className="page"><div className="skeleton skeleton--title" /><div className="skeleton skeleton--panel" /></div>;
  if (!job) return <div className="page"><h1>Không đọc được job</h1><p>{error}</p><Link to="/">Về hoạt động</Link></div>;
  const active = job.status === "queued" || job.status === "running";
  const contentEditor = job.source === "content_editor";
  const inputValue = job.input_name || job.url;
  const previewFile = job.files?.find((file) => file.role === "output" && isVideoFile(file.name, file.mime_type))
    ?? job.files?.find((file) => isVideoFile(file.name, file.mime_type));
  const outputPreviewUrl = job.output_preview_url || (contentEditor && previewFile ? fileUrl(previewFile, job.id) : "");

  async function sendToPost() {
    if (!job) return;
    setPostState("busy");
    try {
      const { created, existing } = await api.sendJobToPost(job.id);
      setPostState(existing
        ? "Job này đã có project bên Post video rồi."
        : created ? `Đã tạo ${created} project bên Post video.` : "Job này không có video hoặc ảnh để đăng.");
    } catch (reason) {
      setPostState(reason instanceof Error ? reason.message : "Không đưa sang Post video được.");
    }
  }

  return <div className="page">
    <div className="job-detail-head"><div><Link to="/">← Hoạt động</Link><h1>{jobDisplayName(job)}</h1><p className="mono">#{job.id}</p></div><StatusBadge status={job.status} /></div>
    <section className="job-progress"><div><span>Tiến độ</span><strong>{Math.round(job.progress || 0)}%</strong></div><i><b style={{ transform: `scaleX(${Math.min(100, Math.max(0, job.progress || 0)) / 100})` }} /></i><p>{job.message || "Backend đang chuẩn bị job."}</p></section>
    {contentEditor && (job.input_preview_url || outputPreviewUrl) && <section className="editor-preview-grid" aria-label="Preview Content Editor">
      {job.input_preview_url && <figure><figcaption>Video input</figcaption><video controls preload="metadata" src={job.input_preview_url} aria-label="Video input của job" /></figure>}
      {outputPreviewUrl && <figure><figcaption>Video output</figcaption><video controls preload="metadata" src={outputPreviewUrl} aria-label="Video output của job" /></figure>}
    </section>}
    <div className="detail-grid">
      <section className="detail-facts">
        <h2>Thông tin</h2>
        <dl>
          <div><dt>Nguồn</dt><dd>{sourceLabel[job.source]}</dd></div>
          <div><dt>Tạo lúc</dt><dd>{formatDate(job.created_at)}</dd></div>
          <div><dt>Cập nhật</dt><dd>{formatDate(job.updated_at)}</dd></div>
          {inputValue && <div><dt>{contentEditor ? "Input" : "URL"}</dt><dd>{isRemoteUrl(inputValue) ? <a href={inputValue} target="_blank" rel="noreferrer">{inputValue}</a> : inputValue}</dd></div>}
          {contentEditor && job.operation && <div><dt>Tác vụ</dt><dd>{job.operation === "split" ? "Tách video" : "Dịch và lồng tiếng"}</dd></div>}
          {contentEditor && job.voice && <div><dt>Giọng</dt><dd>{job.voice}</dd></div>}
        </dl>
        <div className="job-buttons">
          {active && <button className="button button--danger" onClick={async () => { await api.cancelJob(job.id); await refresh(); }}><Ban />Hủy job</button>}
          {job.status === "failed" && <button className="button" onClick={async () => { await api.retryJob(job.id); await refresh(); }}><RefreshCw />Chạy lại</button>}
          {job.status === "succeeded" && !contentEditor && <button className="button" disabled={postState === "busy"} onClick={sendToPost}><Send />{postState === "busy" ? "Đang tạo project…" : "Đưa vào Post video"}</button>}
        </div>
        {postState && postState !== "busy" && <p className="job-post-note" role="status">{postState}</p>}
        {job.error && <div className="error-block"><strong>Job thất bại</strong><pre>{job.error}</pre></div>}
      </section>
      <section className="output-files"><h2>File đầu ra</h2>{job.files?.length ? job.files.map((file) => {
        const fileName = file.name ?? file.filename ?? "file";
        const { stem, extension } = splitFileName(fileName);
        const detail = [formatBytes(file.size ?? file.size_bytes), formatDuration(file.duration_seconds)].filter(Boolean).join(" · ");
        return <a key={file.id ?? fileName} href={fileUrl(file, job.id)} title={`Tải ${fileName}`}><span><strong><span className="file-name-stem">{stem}</span>{extension && <span className="file-name-extension">{extension}</span>}</strong><small>{detail}</small></span><ArrowDownToLine aria-hidden="true" /></a>;
      }) : <p>File sẽ xuất hiện ở đây khi job hoàn tất.</p>}</section>
    </div>
  </div>;
}
