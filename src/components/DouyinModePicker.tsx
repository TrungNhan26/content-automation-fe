import type { DouyinSelectableMode } from "../types";

export interface DouyinModeMeta {
  label: string;
  description: string;
  cta: string;
}

export const DOUYIN_MODE_META: Record<DouyinSelectableMode, DouyinModeMeta> = {
  auto: {
    label: "Tự nhận diện",
    description: "Một link, backend tự chọn video hoặc note.",
    cta: "Bắt đầu tải",
  },
  video: {
    label: "Video",
    description: "Tải đúng một video từ link Douyin.",
    cta: "Tải video",
  },
  note: {
    label: "Ảnh / note",
    description: "Lưu bộ ảnh và metadata của note.",
    cta: "Tải note",
  },
  profile: {
    label: "Profile",
    description: "Quét bài đăng, lượt thích, mix hoặc music.",
    cta: "Crawl profile",
  },
  mix: {
    label: "Mix",
    description: "Tải nội dung trong một mix hoặc collection.",
    cta: "Crawl mix",
  },
  music: {
    label: "Music",
    description: "Tải audio gốc từ một trang music / sound.",
    cta: "Tải music",
  },
  favorites: {
    label: "Favorites",
    description: "Dùng phiên đăng nhập để lấy bộ sưu tập đã lưu.",
    cta: "Crawl favorites",
  },
  search: {
    label: "Tìm kiếm",
    description: "Tìm theo từ khóa và xuất kết quả JSONL.",
    cta: "Xuất JSONL",
  },
  hot_board: {
    label: "Hot board",
    description: "Chụp bảng xu hướng Douyin hiện tại.",
    cta: "Lấy hot board",
  },
  live: {
    label: "Live",
    description: "Ghi một phiên live đang phát từ URL.",
    cta: "Bắt đầu ghi live",
  },
};

const modeGroups: Array<{
  label: string;
  modes: DouyinSelectableMode[];
}> = [
  {
    label: "Tải từ URL",
    modes: ["auto", "video", "note"],
  },
  {
    label: "Crawl hàng loạt",
    modes: ["profile", "mix", "music", "favorites"],
  },
  {
    label: "Khám phá dữ liệu",
    modes: ["search", "hot_board"],
  },
  {
    label: "Ghi live",
    modes: ["live"],
  },
];

interface DouyinModePickerProps {
  value: DouyinSelectableMode;
  onChange: (mode: DouyinSelectableMode) => void;
}

export function DouyinModePicker({ value, onChange }: DouyinModePickerProps) {
  return (
    <div className="field douyin-mode-select">
      <label htmlFor="douyin-mode">Chế độ Douyin</label>
      <select
        id="douyin-mode"
        value={value}
        aria-describedby="douyin-mode-help"
        onChange={(event) => onChange(event.target.value as DouyinSelectableMode)}
      >
        {modeGroups.map((group) => (
          <optgroup label={group.label} key={group.label}>
            {group.modes.map((mode) => (
              <option value={mode} key={mode}>
                {mode === "auto" ? `Auto — ${DOUYIN_MODE_META[mode].label}` : DOUYIN_MODE_META[mode].label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <small id="douyin-mode-help">{DOUYIN_MODE_META[value].description}</small>
    </div>
  );
}
