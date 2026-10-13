import { Activity, ArrowRight, CheckCircle2, Clock3, Search, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api";
import { JobTable } from "../components/JobTable";
import { usePolling } from "../hooks";
import type { ActivityAction, Job } from "../types";

type ActivityFilter = ActivityAction | "all";
type StatusFilter = "all" | "running" | "succeeded" | "failed";

export function OverviewPage() {
  const { jobs } = useOutletContext<{ jobs: Job[] }>();
  const { data: history, error: historyError } = usePolling(api.publishActivity, 20_000);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<ActivityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const posts = useMemo(() => history ?? [], [history]);
  const running = jobs.filter((job) => job.status === "running" || job.status === "queued").length
    + posts.filter((item) => ["queued", "scheduled", "posting"].includes(item.status)).length;
  const done = jobs.filter((job) => job.status === "done" || job.status === "completed" || job.status === "succeeded").length + posts.filter((item) => item.status === "posted").length;
  const failed = jobs.filter((job) => job.status === "failed").length + posts.filter((item) => item.status === "failed").length;
  const total = jobs.length + posts.length;

  return <div className="page page--overview">
    <section className="overview-head">
      <div><p className="context-line">Một màn hình, ba luồng nội dung.</p><h1>Crawl video. Edit sub. Post video.</h1><p>Theo dõi toàn bộ hoạt động tải, biên tập phụ đề và đăng video trong cùng một danh sách.</p></div>
      <Link className="button button--primary" to="/download">Crawl video<ArrowRight /></Link>
    </section>
    <section className="metric-strip" aria-label="Thống kê hoạt động">
      <div><Activity /><span><b>{total}</b>Tổng hoạt động</span></div>
      <div><Clock3 /><span><b>{running}</b>Đang xử lý</span></div>
      <div><CheckCircle2 /><span><b>{done}</b>Hoàn tất</span></div>
      <div><XCircle /><span><b>{failed}</b>Thất bại</span></div>
    </section>
    <section className="workbench-panel">
      <div className="section-head"><div><h2>Hoạt động</h2><p>Crawl, edit sub và post video được sắp theo thời gian cập nhật.</p></div></div>
      <div className="filters">
        <label className="search-field"><Search aria-hidden="true" /><span className="sr-only">Tìm hoạt động</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên video, URL hoặc mã job" /></label>
        <select aria-label="Lọc theo thao tác" value={action} onChange={(event) => setAction(event.target.value as ActivityFilter)}><option value="all">Tất cả thao tác</option><option value="crawl_video">Crawl video</option><option value="edit_sub">Edit sub</option><option value="post_video">Post video</option></select>
        <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">Tất cả trạng thái</option><option value="running">Đang xử lý</option><option value="succeeded">Hoàn tất</option><option value="failed">Thất bại</option></select>
      </div>
      {historyError && <p className="inline-error" role="alert">Không đọc được lịch sử post: {historyError}</p>}
      <JobTable jobs={jobs} postHistory={posts} query={query} action={action} status={status} />
    </section>
  </div>;
}
