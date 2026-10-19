import { AlertCircle, ArrowRight, Link2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { DouyinModePicker, DOUYIN_MODE_META } from "../components/DouyinModePicker";
import {
  DEFAULT_DOUYIN_OPTIONS,
  DouyinOptions,
  type DouyinOptionsState,
  douyinModeSupportsAudioOnly,
  isDouyinDiscoveryMode,
} from "../components/DouyinOptions";
import { DouyinSessionControl } from "../components/DouyinRunSheet";
import type { CreateDownload, DouyinSelectableMode, DouyinSession, DownloadSource } from "../types";
import { extractDownloadInput } from "../utils";

const sourceConfig: Record<DownloadSource, {
  title: string;
  domain: string;
  example: string;
  icon: string;
}> = {
  bilibili: {
    title: "Bilibili",
    domain: "bilibili.com, b23.tv hoặc mã BV",
    example: "BV1xx411c7mD",
    icon: "/bilibili.jpg",
  },
  douyin: {
    title: "Douyin",
    domain: "video, note, profile, mix, music hoặc live",
    example: "https://v.douyin.com/…",
    icon: "/douyin.jpg",
  },
  tiktok: {
    title: "TikTok",
    domain: "tiktok.com, vm.tiktok.com hoặc vt.tiktok.com",
    example: "https://www.tiktok.com/@creator/video/…",
    icon: "/tiktok.jpg",
  },
  youtube: {
    title: "YouTube",
    domain: "youtube.com hoặc youtu.be",
    example: "https://www.youtube.com/watch?v=…",
    icon: "/youtube.jpg",
  },
};

const downloadSources: DownloadSource[] = ["bilibili", "douyin", "tiktok", "youtube"];

export function DownloadPage() {
  const params = useParams();
  const source = (params.source && params.source in sourceConfig ? params.source : "youtube") as DownloadSource;
  const config = useMemo(() => sourceConfig[source], [source]);
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [audioOnly, setAudioOnly] = useState(false);
  const [bilibiliIncludeAudio, setBilibiliIncludeAudio] = useState(true);
  const [mode, setMode] = useState<DouyinSelectableMode>("auto");
  const [douyinOptions, setDouyinOptions] = useState<DouyinOptionsState>(DEFAULT_DOUYIN_OPTIONS);
  const [douyinSession, setDouyinSession] = useState<DouyinSession>();
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [restoringSession, setRestoringSession] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (source !== "douyin") return;
    setMode("auto");
    setAudioOnly(false);
    let active = true;
    setSessionLoading(true);
    setSessionError("");
    void api.douyinSession()
      .then((session) => {
        if (active) setDouyinSession(session);
      })
      .catch((reason) => {
        if (active) setSessionError(reason instanceof Error ? reason.message : "Không đọc được phiên Douyin.");
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [source]);

  const discoveryMode = source === "douyin" && isDouyinDiscoveryMode(mode);
  const accountMode = source === "douyin" && mode === "favorites";
  const effectiveAudioOnly = source === "douyin"
    ? douyinModeSupportsAudioOnly(mode) && audioOnly
    : audioOnly;
  const douyinSessionReady = Boolean(
    douyinSession?.authenticated
    || douyinSession?.stored_login_markers
    || douyinSession?.state === "authenticated"
    || douyinSession?.state === "stored",
  );
  const requestUrl = source !== "douyin"
    ? extractDownloadInput(url, source)
    : mode === "hot_board"
      ? "https://www.douyin.com/hot"
      : mode === "search"
        ? `https://www.douyin.com/search/${encodeURIComponent(douyinOptions.searchKeyword.trim())}`
        : accountMode
          ? "https://www.douyin.com/user/self?showTab=favorite_collection"
          : extractDownloadInput(url, source);
  const canSubmit = source !== "douyin"
    ? Boolean(url.trim())
    : mode === "search"
      ? Boolean(douyinOptions.searchKeyword.trim())
      : accountMode
        ? douyinSessionReady
        : discoveryMode || Boolean(url.trim());
  const submitLabel = source === "douyin" ? DOUYIN_MODE_META[mode].cta : "Bắt đầu tải";
  const douyinFormError = error || (
    accountMode && !sessionLoading && !douyinSessionReady
      ? "Favorites cần phiên đăng nhập. Hãy dùng nút Khôi phục phiên ở phía trên."
      : ""
  );

  function updateDouyinOption<K extends keyof DouyinOptionsState>(key: K, value: DouyinOptionsState[K]) {
    setDouyinOptions((current) => ({ ...current, [key]: value }));
  }

  function changeMode(nextMode: DouyinSelectableMode) {
    setMode(nextMode);
    if (!douyinModeSupportsAudioOnly(nextMode)) setAudioOnly(false);
    setError("");
  }

  async function restoreSession() {
    setRestoringSession(true);
    setSessionError("");
    try {
      setDouyinSession(await api.restoreDouyinSession());
    } catch (reason) {
      setSessionError(reason instanceof Error ? reason.message : "Không thể khôi phục phiên Douyin.");
    } finally {
      setRestoringSession(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const douyinAccountExtras = source === "douyin" && (mode === "profile" || mode === "favorites");
    const douyinProfilePostExtras = source === "douyin" && mode === "profile" && douyinOptions.profileModes.includes("post");
    const douyinCommentExtras = source === "douyin" && !discoveryMode && !["live", "music"].includes(mode);
    const douyinIncludedAudio = source === "douyin" && !discoveryMode && !["live", "music"].includes(mode);

    const payload: CreateDownload = {
      source,
      url: requestUrl,
      audio_only: effectiveAudioOnly,
      include_audio: source === "bilibili"
        ? bilibiliIncludeAudio
        : douyinIncludedAudio && !effectiveAudioOnly && douyinOptions.includeAudio,
      mode: source === "douyin" ? mode : "auto",
      write_metadata: source === "douyin" && !discoveryMode && douyinOptions.writeMetadata,
      include_cover: source === "douyin" && !discoveryMode && !["note", "live"].includes(mode) && !effectiveAudioOnly && douyinOptions.includeCover,
      include_avatar: douyinAccountExtras && !effectiveAudioOnly && douyinOptions.includeAvatar,
      include_comments: douyinCommentExtras && douyinOptions.includeComments,
      include_comment_replies: douyinCommentExtras && douyinOptions.includeComments && douyinOptions.includeCommentReplies,
      browser_fallback: douyinProfilePostExtras && douyinOptions.browserFallback,
      profile_modes: douyinOptions.profileModes,
      favorite_modes: douyinOptions.favoriteModes,
      increase: douyinAccountExtras && douyinOptions.increase,
      start_time: douyinAccountExtras && douyinOptions.startTime ? douyinOptions.startTime : null,
      end_time: douyinAccountExtras && douyinOptions.endTime ? douyinOptions.endTime : null,
      download_pinned: douyinProfilePostExtras && douyinOptions.downloadPinned,
      search_keyword: source === "douyin" && mode === "search" ? douyinOptions.searchKeyword.trim() : "",
      search_sort_type: douyinOptions.searchSortType,
      search_publish_time: douyinOptions.searchPublishTime,
    };

    try {
      const job = await api.createDownload(payload);
      navigate(`/jobs/${job.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo job tải video. Kiểm tra đầu vào rồi thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--download">
      <nav className="download-source-tabs" aria-label="Nguồn tải video">
        {downloadSources.map((item) => (
          <NavLink key={item} to={`/download/${item}`}>{sourceConfig[item].title}</NavLink>
        ))}
      </nav>

      <section className="download-intro">
        <span className={`source-emblem source-emblem--${source}`} aria-hidden="true">
          <img src={config.icon} alt="" />
        </span>
        <div>
          <h1>Tải từ {config.title}</h1>
          <p>{source === "douyin" ? "Chọn mode, giới hạn phạm vi rồi tạo job cho worker Douyin." : "Backend nhận URL, đưa vào hàng đợi rồi lưu kết quả vào kho file chung."}</p>
        </div>
      </section>

      <div className="download-workbench">
        <form className="download-form" onSubmit={submit}>
          {source === "douyin" ? (
            <>
              <div className="douyin-mode-toolbar">
                <DouyinModePicker value={mode} onChange={changeMode} />
                <DouyinSessionControl
                  session={douyinSession}
                  sessionLoading={sessionLoading}
                  sessionError={sessionError}
                  restoring={restoringSession}
                  onRestore={() => void restoreSession()}
                />
              </div>
              <DouyinOptions
                mode={mode}
                url={url}
                error={douyinFormError}
                audioOnly={effectiveAudioOnly}
                value={douyinOptions}
                onUrlChange={setUrl}
                onAudioOnlyChange={setAudioOnly}
                onChange={updateDouyinOption}
              />
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="video-url">Đường dẫn hoặc mã nội dung</label>
                <div className="input-wrap">
                  <Link2 aria-hidden="true" />
                  <input
                    id="video-url"
                    type="text"
                    required
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder={config.example}
                    aria-describedby={error ? "download-error" : "download-help"}
                    aria-invalid={Boolean(error)}
                  />
                </div>
                <small id={error ? "download-error" : "download-help"} className={error ? "field-error" : ""}>
                  {error ? <><AlertCircle aria-hidden="true" />{error}</> : `Dán URL hoặc nguyên đoạn chia sẻ; hệ thống tự lấy link ${config.domain}.`}
                </small>
              </div>

              {source === "bilibili" && !audioOnly && (
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={bilibiliIncludeAudio}
                    onChange={(event) => setBilibiliIncludeAudio(event.target.checked)}
                  />
                  <span>
                    <strong>Tạo thêm MP3</strong>
                    <small>Một job xuất cả MP4 và MP3.</small>
                  </span>
                </label>
              )}

            </>
          )}

          <button
            className="button button--primary button--submit"
            disabled={submitting || !canSubmit}
            data-state={submitting ? "loading" : undefined}
          >
            {submitting ? "Đang tạo job…" : <>{submitLabel}<ArrowRight aria-hidden="true" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
