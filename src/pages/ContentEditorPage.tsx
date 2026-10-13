import { Captions, Film } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api";
import { ContentEditorForm } from "../components/ContentEditorForm";
import { JobTable } from "../components/JobTable";
import { usePolling } from "../hooks";
import type { Job } from "../types";
import { formatBytes } from "../utils";

const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export function ContentEditorPage() {
  const { jobs } = useOutletContext<{ jobs: Job[] }>();
  const loader = useCallback(api.contentEditorCapabilities, []);
  const { data: capabilities, error, loading } = usePolling(loader, 60_000);
  const editorJobs = useMemo(() => jobs.filter((job) => job.source === "content_editor"), [jobs]);
  const maxUploadBytes = capabilities?.max_upload_mb ? capabilities.max_upload_mb * 1024 * 1024 : DEFAULT_MAX_UPLOAD_BYTES;
  const formats = capabilities?.accepted_extensions?.join(" · ") || ".mp4 · .mov · .m4v · .webm · .mkv";

  return <div className="page page--content-editor">
    <section className="editor-intro">
      <div><h1>Content Editor Automation</h1><p>Dịch, lồng tiếng hoặc tách video trong cùng hàng đợi với downloader và autopost.</p></div>
      <span className="editor-emblem" aria-hidden="true"><Captions /></span>
    </section>

    {(loading || error) && <p className={error ? "inline-error" : "editor-config-state"} role={error ? "alert" : "status"}>{error ? "Không đọc được cấu hình editor; form đang dùng giới hạn an toàn mặc định và backend sẽ xác thực lại." : "Đang đọc cấu hình Content Editor…"}</p>}

    <div className="editor-workbench">
      <ContentEditorForm capabilities={capabilities} />
      <aside className="editor-run-sheet" aria-labelledby="editor-run-sheet-heading">
        <div><h2 id="editor-run-sheet-heading">Từ video thô đến nội dung sẵn đăng</h2><p>Job chạy nền; bạn có thể rời trang và theo dõi tiếp trong lịch sử.</p></div>
        <ol>
          <li><span>Nhận file</span><small>Kiểm tra định dạng và đưa vào kho tạm.</small></li>
          <li><span>Xử lý</span><small>Dịch/lồng tiếng hoặc tách part bằng FFmpeg.</small></li>
          <li><span>Bàn giao</span><small>Tải output, xem preview và đưa video dịch vào autopost.</small></li>
        </ol>
        <dl>
          <div><dt>Dung lượng tối đa</dt><dd>{formatBytes(maxUploadBytes)}</dd></div>
          <div><dt>Định dạng</dt><dd>{formats}</dd></div>
          <div><dt>Upload</dt><dd>{capabilities?.r2_upload_enabled ? "Cloudflare R2" : "Backend local"}</dd></div>
        </dl>
      </aside>
    </div>

    <section className="workbench-panel editor-history" aria-labelledby="editor-history-heading">
      <div className="section-head"><div><h2 id="editor-history-heading">Job biên tập gần đây</h2><p>{editorJobs.length ? `${editorJobs.length} job đang được lưu trong workspace.` : "Job mới sẽ xuất hiện ở đây ngay sau khi upload."}</p></div></div>
      {editorJobs.length ? <JobTable jobs={editorJobs} limit={8} /> : <div className="editor-empty"><Film aria-hidden="true" /><div><strong>Chưa có job Content Editor.</strong><p>Chọn video ở workbench phía trên để bắt đầu.</p></div></div>}
    </section>
  </div>;
}
