import { AlertCircle, Link2, Music2, Video } from "lucide-react";
import type { DouyinFavoriteMode, DouyinProfileMode, DouyinSelectableMode } from "../types";

export interface DouyinOptionsState {
  writeMetadata: boolean;
  includeAudio: boolean;
  includeCover: boolean;
  includeAvatar: boolean;
  includeComments: boolean;
  includeCommentReplies: boolean;
  browserFallback: boolean;
  profileModes: DouyinProfileMode[];
  favoriteModes: DouyinFavoriteMode[];
  increase: boolean;
  startTime: string;
  endTime: string;
  downloadPinned: boolean;
  searchKeyword: string;
  searchSortType: number;
  searchPublishTime: number;
}

export const DEFAULT_DOUYIN_OPTIONS: DouyinOptionsState = {
  writeMetadata: true,
  includeAudio: true,
  includeCover: false,
  includeAvatar: false,
  includeComments: false,
  includeCommentReplies: false,
  browserFallback: false,
  profileModes: ["post"],
  favoriteModes: ["collect"],
  increase: false,
  startTime: "",
  endTime: "",
  downloadPinned: false,
  searchKeyword: "",
  searchSortType: 0,
  searchPublishTime: 0,
};

const discoveryModes: DouyinSelectableMode[] = ["search", "hot_board"];
const audioOutputModes: DouyinSelectableMode[] = ["auto", "video", "profile", "mix", "favorites"];
const includedAudioModes: DouyinSelectableMode[] = ["auto", "video", "note", "profile", "mix", "favorites"];

export function isDouyinDiscoveryMode(mode: DouyinSelectableMode) {
  return discoveryModes.includes(mode);
}

export function douyinModeNeedsUrl(mode: DouyinSelectableMode) {
  return !["favorites", "search", "hot_board"].includes(mode);
}

export function douyinModeSupportsAudioOnly(mode: DouyinSelectableMode) {
  return audioOutputModes.includes(mode);
}

function clampNumber(value: string, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

interface ToggleFieldProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  help: string;
  onChange: (checked: boolean) => void;
}

function ToggleField({ checked, disabled, label, help, onChange }: ToggleFieldProps) {
  return (
    <label className="toggle-field">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
      </span>
    </label>
  );
}

interface DouyinOptionsProps {
  mode: DouyinSelectableMode;
  url: string;
  error: string;
  audioOnly: boolean;
  value: DouyinOptionsState;
  onUrlChange: (url: string) => void;
  onAudioOnlyChange: (audioOnly: boolean) => void;
  onChange: <K extends keyof DouyinOptionsState>(key: K, value: DouyinOptionsState[K]) => void;
}

const sourceFields: Partial<Record<DouyinSelectableMode, { label: string; placeholder: string; help: string }>> = {
  auto: {
    label: "Link Douyin",
    placeholder: "https://v.douyin.com/…",
    help: "Dán URL hoặc nguyên đoạn chia sẻ; hệ thống tự lấy link Douyin. Lưu ý: bài ảnh/ảnh động dễ lỗi hơn video (có thể thiếu ảnh).",
  },
  video: {
    label: "Link video",
    placeholder: "https://www.douyin.com/video/…",
    help: "Dùng link chia sẻ hoặc URL video đầy đủ.",
  },
  note: {
    label: "Link note",
    placeholder: "https://www.douyin.com/note/…",
    help: "Backend lưu bộ ảnh gốc cùng metadata. Bài ảnh/ảnh động dễ lỗi hơn video (có thể thiếu ảnh).",
  },
  profile: {
    label: "Link profile",
    placeholder: "https://www.douyin.com/user/…",
    help: "Dùng trang profile cần quét; cookie có thể cần cho nội dung riêng tư.",
  },
  mix: {
    label: "Link mix / collection",
    placeholder: "https://www.douyin.com/collection/…",
    help: "Backend quét lần lượt các item trong collection.",
  },
  music: {
    label: "Link music",
    placeholder: "https://www.douyin.com/music/…",
    help: "Backend tải audio gốc; nếu API không trả audio, worker dùng tác phẩm đầu tiên làm fallback.",
  },
  live: {
    label: "Link phòng live",
    placeholder: "https://live.douyin.com/…",
    help: "Phiên live phải đang phát khi worker bắt đầu.",
  },
};

const profileModeLabels: Record<DouyinProfileMode, string> = {
  post: "Bài đăng",
  like: "Đã thích",
  mix: "Mix",
  music: "Music",
};

const favoriteModeLabels: Record<DouyinFavoriteMode, string> = {
  collect: "Video đã lưu",
  collectmix: "Mix đã lưu",
};

export function DouyinOptions({
  mode,
  url,
  error,
  audioOnly,
  value,
  onUrlChange,
  onAudioOnlyChange,
  onChange,
}: DouyinOptionsProps) {
  const isDiscovery = isDouyinDiscoveryMode(mode);
  const supportsAudioOnly = douyinModeSupportsAudioOnly(mode);
  const supportsIncludedAudio = includedAudioModes.includes(mode);
  const hasAccountExtras = mode === "profile" || mode === "favorites";
  const supportsProfilePostExtras = mode === "profile" && value.profileModes.includes("post");
  const sourceField = sourceFields[mode];
  const hasScope = mode === "profile" || mode === "favorites" || mode === "search";
  const supportsComments = mode !== "live" && mode !== "music";

  const enabledExtras = [
    value.writeMetadata,
    supportsIncludedAudio && !audioOnly && value.includeAudio,
    mode !== "note" && mode !== "live" && !isDiscovery && value.includeCover,
    hasAccountExtras && value.includeAvatar,
    supportsComments && !isDiscovery && value.includeComments,
    supportsComments && !isDiscovery && value.includeCommentReplies,
    supportsProfilePostExtras && value.browserFallback,
    hasAccountExtras && value.increase,
    supportsProfilePostExtras && value.downloadPinned,
  ].filter(Boolean).length;

  function toggleProfileMode(profileMode: DouyinProfileMode) {
    const next = value.profileModes.includes(profileMode)
      ? value.profileModes.length > 1
        ? value.profileModes.filter((item) => item !== profileMode)
        : value.profileModes
      : [...value.profileModes, profileMode];
    onChange("profileModes", next);
  }

  function toggleFavoriteMode(favoriteMode: DouyinFavoriteMode) {
    const next = value.favoriteModes.includes(favoriteMode)
      ? value.favoriteModes.length > 1
        ? value.favoriteModes.filter((item) => item !== favoriteMode)
        : value.favoriteModes
      : [...value.favoriteModes, favoriteMode];
    onChange("favoriteModes", next);
  }

  return (
    <div className="douyin-context">
      <section className="douyin-section" aria-labelledby="douyin-source-title">
        <div className="douyin-section-head">
          <h2 id="douyin-source-title">Nguồn cần xử lý</h2>
          <p>Mỗi mode chỉ nhận đúng loại đầu vào của nó.</p>
        </div>

        {mode === "search" ? (
          <div className="field">
            <label htmlFor="douyin-search-keyword">Từ khóa tìm kiếm</label>
            <div className="input-wrap">
              <Link2 aria-hidden="true" />
              <input
                id="douyin-search-keyword"
                required
                value={value.searchKeyword}
                onChange={(event) => onChange("searchKeyword", event.target.value)}
                placeholder="son môi, thời trang, món ngon…"
                aria-describedby={error ? "download-error" : "douyin-search-help"}
                aria-invalid={Boolean(error)}
              />
            </div>
            <small id={error ? "download-error" : "douyin-search-help"} className={error ? "field-error" : ""}>
              {error ? <><AlertCircle aria-hidden="true" />{error}</> : "Kết quả được lưu thành JSONL trong job."}
            </small>
          </div>
        ) : mode === "favorites" ? (
          <div className="douyin-source-callout">
            <strong>Favorites của tài khoản đang đăng nhập</strong>
            <p>Không cần URL. Worker dùng cookie Douyin và ngữ cảnh user/self.</p>
            {error && <small className="field-error" id="download-error"><AlertCircle aria-hidden="true" />{error}</small>}
          </div>
        ) : mode === "hot_board" ? (
          <div className="douyin-source-callout">
            <strong>Hot board Douyin hiện tại</strong>
            <p>Không cần URL. Worker lấy bảng xu hướng tại thời điểm job chạy và ghi JSONL.</p>
            {error && <small className="field-error" id="download-error"><AlertCircle aria-hidden="true" />{error}</small>}
          </div>
        ) : sourceField ? (
          <div className="field">
            <label htmlFor="douyin-url">{sourceField.label}</label>
            <div className="input-wrap">
              <Link2 aria-hidden="true" />
              <input
                id="douyin-url"
                type="text"
                required
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder={sourceField.placeholder}
                aria-describedby={error ? "download-error" : "douyin-url-help"}
                aria-invalid={Boolean(error)}
              />
            </div>
            <small id={error ? "download-error" : "douyin-url-help"} className={error ? "field-error" : ""}>
              {error ? <><AlertCircle aria-hidden="true" />{error}</> : sourceField.help}
            </small>
          </div>
        ) : null}
      </section>

      {hasScope && (
        <section className="douyin-section" aria-labelledby="douyin-scope-title">
          <div className="douyin-section-head">
            <h2 id="douyin-scope-title">Phạm vi job</h2>
            <p>Giới hạn khối lượng trước khi đưa vào queue.</p>
          </div>

          <div className="douyin-scope-grid">
            {mode === "profile" && (
              <div className="douyin-mode-scope">
                <fieldset className="douyin-inline-checks">
                  <legend>Nội dung profile</legend>
                  {(Object.keys(profileModeLabels) as DouyinProfileMode[]).map((profileMode) => (
                    <label key={profileMode}>
                      <input
                        type="checkbox"
                        checked={value.profileModes.includes(profileMode)}
                        onChange={() => toggleProfileMode(profileMode)}
                      />
                      {profileModeLabels[profileMode]}
                    </label>
                  ))}
                </fieldset>
                {value.profileModes.includes("like") && <small>Mục “Đã thích” có thể cần phiên đăng nhập và còn phụ thuộc quyền hiển thị của profile.</small>}
              </div>
            )}

            {mode === "favorites" && (
              <div className="douyin-mode-scope">
                <fieldset className="douyin-inline-checks">
                  <legend>Loại favorites</legend>
                  {(Object.keys(favoriteModeLabels) as DouyinFavoriteMode[]).map((favoriteMode) => (
                    <label key={favoriteMode}>
                      <input
                        type="checkbox"
                        checked={value.favoriteModes.includes(favoriteMode)}
                        onChange={() => toggleFavoriteMode(favoriteMode)}
                      />
                      {favoriteModeLabels[favoriteMode]}
                    </label>
                  ))}
                </fieldset>
                <small>Cả “Video đã lưu” và “Mix đã lưu” đều dùng tài khoản trong phiên Douyin hiện tại.</small>
              </div>
            )}

            {(mode === "profile" || mode === "favorites") && (
              <div className="range-options">
                <div className="field">
                  <label htmlFor="douyin-start-time">Từ ngày</label>
                  <input
                    id="douyin-start-time"
                    type="date"
                    value={value.startTime}
                    onChange={(event) => onChange("startTime", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="douyin-end-time">Đến ngày</label>
                  <input
                    id="douyin-end-time"
                    type="date"
                    min={value.startTime || undefined}
                    value={value.endTime}
                    onChange={(event) => onChange("endTime", event.target.value)}
                  />
                </div>
              </div>
            )}

            {mode === "search" && (
              <div className="search-options">
                <div className="field">
                  <label htmlFor="douyin-search-sort">Sắp xếp</label>
                  <select
                    id="douyin-search-sort"
                    value={value.searchSortType}
                    onChange={(event) => onChange("searchSortType", Number(event.target.value))}
                  >
                    <option value="0">Mặc định</option>
                    <option value="1">Mới nhất</option>
                    <option value="2">Nhiều tương tác</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="douyin-search-publish">Thời gian đăng</label>
                  <select
                    id="douyin-search-publish"
                    value={value.searchPublishTime}
                    onChange={(event) => onChange("searchPublishTime", Number(event.target.value))}
                  >
                    <option value="0">Mọi lúc</option>
                    <option value="1">Trong ngày</option>
                    <option value="7">Trong tuần</option>
                    <option value="182">Trong 6 tháng</option>
                  </select>
                </div>
              </div>
            )}

          </div>
        </section>
      )}

      {!isDiscovery && (
        <section className="douyin-section" aria-labelledby="douyin-output-title">
          <div className="douyin-section-head">
            <h2 id="douyin-output-title">Đầu ra</h2>
            <p>Định dạng và chất lượng file worker sẽ lưu.</p>
          </div>

          {supportsAudioOnly ? (
            <fieldset className="douyin-output-picker">
              <legend className="sr-only">Định dạng đầu ra</legend>
              <label className={`choice ${!audioOnly ? "is-selected" : ""}`}>
                <input type="radio" checked={!audioOnly} onChange={() => onAudioOnlyChange(false)} />
                <Video aria-hidden="true" />
                <span>
                  <strong>Video tốt nhất</strong>
                  <small>MP4 chất lượng cao nhất kèm âm thanh</small>
                </span>
              </label>
              <label className={`choice ${audioOnly ? "is-selected" : ""}`}>
                <input type="radio" checked={audioOnly} onChange={() => onAudioOnlyChange(true)} />
                <Music2 aria-hidden="true" />
                <span>
                  <strong>Chỉ âm thanh</strong>
                  <small>MP3 hoặc M4A</small>
                </span>
              </label>
            </fieldset>
          ) : (
            <div className="douyin-output-note">
              <strong>
                {mode === "note"
                  ? "Bộ ảnh gốc + metadata"
                  : mode === "music"
                    ? "Audio gốc của music / sound"
                    : "Bản ghi video của luồng live"}
              </strong>
              <p>
                {mode === "note"
                  ? "Note không dùng tùy chọn chất lượng video hoặc audio-only."
                  : mode === "music"
                    ? "Music tải một audio asset; worker chỉ fallback sang tác phẩm đầu tiên khi nguồn không trả audio trực tiếp."
                    : "Live được ghi nguyên luồng; thời lượng nằm trong phần phạm vi job."}
              </p>
            </div>
          )}

          <details className="douyin-extras">
            <summary>
              <span>Tùy chọn thêm</span>
              <small>{enabledExtras} đang bật</small>
            </summary>
            <div className="douyin-extra-grid">
              <ToggleField
                checked={value.writeMetadata}
                label="Lưu metadata"
                help="Giữ JSON và manifest phục vụ autopost."
                onChange={(checked) => onChange("writeMetadata", checked)}
              />

              {supportsIncludedAudio && (
                <ToggleField
                  checked={value.includeAudio}
                  disabled={audioOnly}
                  label="Lưu thêm audio"
                  help="Xuất riêng track nhạc nếu nội dung có audio."
                  onChange={(checked) => onChange("includeAudio", checked)}
                />
              )}

              {mode !== "note" && mode !== "live" && (
                <ToggleField
                  checked={value.includeCover}
                  disabled={audioOnly}
                  label="Ảnh bìa"
                  help="Tải cover của từng nội dung."
                  onChange={(checked) => onChange("includeCover", checked)}
                />
              )}

              {hasAccountExtras && (
                <ToggleField
                  checked={value.includeAvatar}
                  disabled={audioOnly}
                  label="Avatar tác giả"
                  help="Lưu avatar đi kèm dữ liệu tài khoản."
                  onChange={(checked) => onChange("includeAvatar", checked)}
                />
              )}

              {supportsComments && (
                <ToggleField
                  checked={value.includeComments}
                  label="Bình luận"
                  help="Thu thập comment vào metadata."
                  onChange={(checked) => {
                    onChange("includeComments", checked);
                    if (!checked) onChange("includeCommentReplies", false);
                  }}
                />
              )}

              {supportsComments && (
                <ToggleField
                  checked={value.includeCommentReplies}
                  disabled={!value.includeComments}
                  label="Phản hồi comment"
                  help="Lấy cả reply của bình luận."
                  onChange={(checked) => onChange("includeCommentReplies", checked)}
                />
              )}

              {supportsProfilePostExtras && (
                <ToggleField
                  checked={value.browserFallback}
                  label="Browser fallback"
                  help="Dùng Playwright khi API không trả đủ dữ liệu."
                  onChange={(checked) => onChange("browserFallback", checked)}
                />
              )}

              {hasAccountExtras && (
                <ToggleField
                  checked={value.increase}
                  label="Chỉ tải phần mới"
                  help="Dừng tại item đã tồn tại trong database."
                  onChange={(checked) => onChange("increase", checked)}
                />
              )}

              {supportsProfilePostExtras && (
                <ToggleField
                  checked={value.downloadPinned}
                  label="Tải bài ghim"
                  help="Bao gồm bài được pin trên profile."
                  onChange={(checked) => onChange("downloadPinned", checked)}
                />
              )}

            </div>
          </details>
        </section>
      )}
    </div>
  );
}
