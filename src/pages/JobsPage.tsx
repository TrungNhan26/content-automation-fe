import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { JobTable } from "../components/JobTable";
import type { Job, JobSource, JobStatus } from "../types";

export function JobsPage() {
  const { jobs } = useOutletContext<{ jobs: Job[] }>();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<JobSource | "all">("all");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const filtered = useMemo(() => jobs.filter((job) => (source === "all" || job.source === source) && (status === "all" || job.status === status) && `${job.title ?? ""} ${job.input_name ?? ""} ${job.url ?? ""} ${job.id}`.toLowerCase().includes(query.toLowerCase())), [jobs, query, source, status]);
  return <div className="page"><div className="page-heading"><div><h1>Hàng đợi và lịch sử</h1><p>Tìm, kiểm tra và tải file kết quả của mọi nguồn.</p></div></div><div className="filters"><label className="search-field"><Search /><span className="sr-only">Tìm job</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên video, URL hoặc mã job" /></label><select aria-label="Lọc theo nguồn" value={source} onChange={(event) => setSource(event.target.value as JobSource | "all")}><option value="all">Tất cả nguồn</option><option value="bilibili">Bilibili</option><option value="douyin">Douyin</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="content_editor">Content Editor</option></select><select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => setStatus(event.target.value as JobStatus | "all")}><option value="all">Tất cả trạng thái</option><option value="queued">Đang chờ</option><option value="running">Đang xử lý</option><option value="succeeded">Hoàn tất</option><option value="failed">Thất bại</option></select></div><section className="workbench-panel"><JobTable jobs={filtered} /></section></div>;
}
