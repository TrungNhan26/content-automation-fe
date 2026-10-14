import { LockKeyhole, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccess } from "./AccessGate";

/** Crawl, Edit sub and Truyện tranh run on the crawling PC: show them only while it answers. */
export function RequireBackend({ children }: { children: ReactNode }) {
  const { backendOnline, recheckBackend } = useAccess();
  const [checking, setChecking] = useState(false);

  if (backendOnline !== false) return <>{children}</>;

  async function retry() {
    setChecking(true);
    try {
      await recheckBackend();
    } finally {
      setChecking(false);
    }
  }

  return <section className="backend-required" aria-labelledby="backend-required-title">
    <span className="access-card__icon"><LockKeyhole aria-hidden="true" /></span>
    <h1 id="backend-required-title">Cần bật server</h1>
    <p>Chức năng này chạy trên server. Hãy bật server rồi thử lại.</p>
    <p>Post video vẫn dùng được bình thường khi server tắt.</p>
    <div className="backend-required__actions">
      <button type="button" className="button button--primary" data-state={checking ? "loading" : undefined} disabled={checking} onClick={() => void retry()}>
        <RefreshCw aria-hidden="true" />Thử lại
      </button>
      <Link className="button" to="/workers">Mở Post video</Link>
    </div>
  </section>;
}
