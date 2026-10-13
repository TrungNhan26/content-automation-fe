import { RotateCcw, Settings } from "lucide-react";
import type { DouyinSession } from "../types";

interface DouyinSessionControlProps {
  session?: DouyinSession;
  sessionLoading: boolean;
  sessionError: string;
  restoring: boolean;
  onRestore: () => void;
}

export function DouyinSessionControl({
  session,
  sessionLoading,
  sessionError,
  restoring,
  onRestore,
}: DouyinSessionControlProps) {
  const ready = Boolean(
    session?.authenticated
    || session?.stored_login_markers
    || session?.state === "authenticated"
    || session?.state === "stored",
  );
  const sessionIsRestoring = Boolean(restoring || session?.restoring || session?.state === "restoring");
  const restorable = Boolean(session?.restore_available);
  const selectedProfile = session?.selected_profile;
  const selectedProfileLabel = selectedProfile?.replace(".edge_cookie_profile_", "Edge ");
  const cookieCount = session?.stored_cookie_count;
  const sessionLabel = sessionLoading
    ? "Đang kiểm tra"
    : sessionIsRestoring
      ? "Đang khôi phục"
    : session?.authenticated
      ? "Đã xác minh đăng nhập"
      : session?.stored_login_markers
        ? "Đã lưu phiên đăng nhập"
      : restorable
        ? "Có thể khôi phục"
        : sessionError
          ? "Chưa đọc được trạng thái"
        : session?.state === "unavailable"
          ? "Profile chưa sẵn sàng"
          : session?.configured && session?.cookie_file_exists
            ? "Chỉ có cookie guest"
          : "Chưa cấu hình";
  const sessionTone = ready
    ? "is-ready"
    : restorable || sessionIsRestoring
      ? "is-restorable"
      : sessionError
        ? "is-error"
        : "is-missing";
  const sessionFacts = [
    selectedProfileLabel,
    typeof cookieCount === "number" ? `${cookieCount} cookies` : "",
  ].filter(Boolean).join(" · ");
  const sessionDescription = sessionError
    ? `${sessionError} Link công khai vẫn chạy; Favorites cần cookie hợp lệ.`
    : sessionIsRestoring
      ? "Edge đang mở profile cũ. Đăng nhập trong cửa sổ đó nếu Douyin yêu cầu."
      : ready
        ? sessionFacts || "Phiên đã được lưu và sẽ nạp lại ở đầu mỗi job."
        : session?.state === "recoverable"
          ? "Profile Edge cũ còn sẵn sàng để khôi phục."
          : session?.state === "unavailable"
            ? "Edge, Playwright hoặc profile cũ chưa sẵn sàng."
            : "Link công khai vẫn chạy; Favorites cần phiên đăng nhập.";

  return (
    <details className="douyin-session-settings">
      <summary
        aria-label={`Cài đặt phiên Douyin: ${sessionLabel}`}
        title="Cài đặt phiên Douyin"
      >
        <Settings aria-hidden="true" />
        <i className={`douyin-session-settings__indicator ${sessionTone}`} aria-hidden="true" />
      </summary>

      <section
        className="douyin-session-control"
        aria-labelledby="douyin-session-title"
        aria-busy={sessionLoading || sessionIsRestoring}
      >
        <div className="douyin-session-control__copy">
          <div className="douyin-session-control__heading">
            <h2 id="douyin-session-title">Phiên Douyin</h2>
            <span className={`douyin-session-state ${sessionTone}`} aria-live="polite">
              {sessionLabel}
            </span>
          </div>
          <p id="douyin-session-detail">{sessionDescription}</p>
        </div>

        {(restorable || sessionIsRestoring) && !session?.authenticated && (
          <button
            className="button douyin-session-restore"
            type="button"
            aria-describedby="douyin-session-detail"
            disabled={sessionIsRestoring}
            data-state={sessionIsRestoring ? "loading" : undefined}
            onClick={onRestore}
          >
            {!sessionIsRestoring && <RotateCcw aria-hidden="true" />}
            {sessionIsRestoring ? "Đang khôi phục…" : ready ? "Làm mới phiên" : "Khôi phục phiên"}
          </button>
        )}
      </section>
    </details>
  );
}
