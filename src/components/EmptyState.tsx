import { Inbox } from "lucide-react";
import { Link } from "react-router-dom";

export function EmptyState({ compact = false }: { compact?: boolean }) {
  return <div className={`empty-state ${compact ? "empty-state--compact" : ""}`}>
    <Inbox aria-hidden="true" />
    <div><strong>Chưa có hoạt động phù hợp.</strong><p>Thử đổi bộ lọc hoặc bắt đầu một luồng nội dung mới.</p></div>
    {!compact && <Link className="button button--primary" to="/download">Crawl video</Link>}
  </div>;
}
