import { FileVideo2, Languages, Scissors, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { ContentEditorCapabilities, ContentEditorOperation, ContentEditorVoice } from "../types";
import { formatBytes } from "../utils";

const DEFAULT_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".mkv"];
const DEFAULT_VOICES: ContentEditorVoice[] = [
  { id: "vi-VN-HoaiMyNeural", label: "Nữ · Hoài My" },
  { id: "vi-VN-NamMinhNeural", label: "Nam · Nam Minh" },
];
const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

function normalizedExtension(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

export function ContentEditorForm({ capabilities }: { capabilities?: ContentEditorCapabilities }) {
  const navigate = useNavigate();
  const [operation, setOperation] = useState<ContentEditorOperation>("translate");
  const [video, setVideo] = useState<File | null>(null);
  const [voice, setVoice] = useState("vi-VN-HoaiMyNeural");
  const [profile, setProfile] = useState("default");
  const [segmentMinutes, setSegmentMinutes] = useState(10);
  const [ttsRate, setTtsRate] = useState("");
  const [useGemini, setUseGemini] = useState(true);
  const [noTts, setNoTts] = useState(false);
  const [noRender, setNoRender] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const appliedConfiguredVoice = useRef(false);

  const extensions = useMemo(() => {
    const configured = capabilities?.accepted_extensions?.map(normalizedExtension).filter(Boolean);
    return configured?.length ? configured : DEFAULT_EXTENSIONS;
  }, [capabilities?.accepted_extensions]);
  const voices = useMemo(() => {
    const configured = capabilities?.voices?.map((item) => typeof item === "string" ? { id: item, label: item } : item);
    return configured?.length ? configured : DEFAULT_VOICES;
  }, [capabilities?.voices]);
  const operations: ContentEditorOperation[] = capabilities?.operations?.length ? capabilities.operations : ["translate", "split"];
  const profiles = capabilities?.profiles?.length ? capabilities.profiles : ["default"];
  const maxUploadBytes = capabilities?.max_upload_mb ? capabilities.max_upload_mb * 1024 * 1024 : DEFAULT_MAX_UPLOAD_BYTES;
  const splitMin = 1;
  const splitMax = 120;
  const splitDefault = capabilities?.default_segment_minutes ?? 10;
  const defaultVoice = capabilities?.default_voice || voices[0]?.id || DEFAULT_VOICES[0].id;

  useEffect(() => {
    if (capabilities && !appliedConfiguredVoice.current) {
      appliedConfiguredVoice.current = true;
      setVoice(voices.some((item) => item.id === defaultVoice) ? defaultVoice : voices[0]?.id || DEFAULT_VOICES[0].id);
      return;
    }
    if (!voices.some((item) => item.id === voice)) setVoice(defaultVoice);
  }, [capabilities, defaultVoice, voice, voices]);

  useEffect(() => {
    if (!operations.includes(operation)) setOperation(operations[0] || "translate");
  }, [operation, operations]);

  useEffect(() => {
    if (!profiles.includes(profile)) setProfile(profiles[0] || "default");
  }, [profile, profiles]);

  useEffect(() => {
    setSegmentMinutes(Math.max(splitMin, Math.min(splitMax, splitDefault)));
  }, [splitDefault, splitMax, splitMin]);

  function validateFile(file: File | null) {
    if (!file) return "Hãy chọn một file video trước khi tạo job.";
    if (file.size <= 0) return "File đang rỗng. Hãy chọn lại video có dữ liệu.";
    if (file.size > maxUploadBytes) return `File vượt giới hạn ${formatBytes(maxUploadBytes)}. Hãy nén hoặc chọn video nhỏ hơn.`;
    const extension = normalizedExtension(file.name.split(".").pop() || "");
    if (!extensions.includes(extension)) return `Định dạng ${extension || "không xác định"} chưa được hỗ trợ. Hãy dùng ${extensions.join(", ")}.`;
    return "";
  }

  function chooseFile(file: File | null) {
    setVideo(file);
    setError(file ? validateFile(file) : "");
    setStage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const fileError = validateFile(video);
    if (fileError || !video) {
      setError(fileError);
      return;
    }
    if (operation === "split" && (segmentMinutes < splitMin || segmentMinutes > splitMax)) {
      setError(`Độ dài mỗi phần phải từ ${splitMin} đến ${splitMax} phút.`);
      return;
    }

    setSubmitting(true);
    setError("");
    setStage(capabilities?.r2_upload_enabled
      ? "Đang chuẩn bị upload trực tiếp lên R2…"
      : "Đang tải video lên backend và tạo job…");
    try {
      const payload = {
        file: video,
        operation,
        voice,
        segment_minutes: segmentMinutes,
        profile,
        tts_rate: ttsRate,
        use_gemini: useGemini,
        no_tts: noTts,
        no_render: noRender || noTts,
      };
      const job = capabilities?.r2_upload_enabled
        ? await api.createContentEditorJobViaR2(payload, (percent) => {
          setStage(`Đang tải video thẳng lên R2 · ${percent}%`);
        })
        : await api.createContentEditorJob(payload);
      setStage("Đã đưa vào hàng đợi. Đang mở chi tiết job…");
      navigate(`/jobs/${job.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo job biên tập. Hãy kiểm tra kết nối rồi thử lại.");
      setStage("");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="content-editor-form" onSubmit={submit} aria-busy={submitting}>
    <fieldset className="editor-mode-picker">
      <legend>Tác vụ biên tập</legend>
      <label className={`choice ${operation === "translate" ? "is-selected" : ""}`}>
        <input type="radio" name="editor-operation" value="translate" checked={operation === "translate"} disabled={!operations.includes("translate")} onChange={() => setOperation("translate")} />
        <Languages aria-hidden="true" />
        <span><strong>Dịch và lồng tiếng</strong><small>Phụ đề, voice và video tiếng Việt</small></span>
      </label>
      <label className={`choice ${operation === "split" ? "is-selected" : ""}`}>
        <input type="radio" name="editor-operation" value="split" checked={operation === "split"} disabled={!operations.includes("split")} onChange={() => setOperation("split")} />
        <Scissors aria-hidden="true" />
        <span><strong>Tách video</strong><small>Chia video dài thành nhiều phần</small></span>
      </label>
    </fieldset>

    <div className="field">
      <span className="editor-field-label">Video input</span>
      <label className={`editor-file-control ${dragging ? "is-dragging" : ""}`} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0] || null); }}>
        <input className="editor-file-input" type="file" accept={extensions.join(",")} required aria-required="true" aria-invalid={Boolean(error)} aria-describedby="editor-file-help" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
        <FileVideo2 aria-hidden="true" />
        <span><strong>{video?.name || "Chọn hoặc thả video vào đây"}</strong><small>{video ? `${formatBytes(video.size)} · ${operation === "translate" ? "sẵn sàng dịch" : "sẵn sàng tách"}` : `Tối đa ${formatBytes(maxUploadBytes)} · ${extensions.join(" ")}`}</small></span>
        <span className="editor-file-action">Chọn file</span>
      </label>
      <small id="editor-file-help" className={error ? "field-error" : ""}>{error || "Video chỉ được gửi khi bạn bấm tạo job."}</small>
    </div>

    {operation === "translate" ? <>
      <div className="editor-translate-options">
        <div className="field">
          <label htmlFor="editor-voice">Giọng đọc tiếng Việt</label>
          <select id="editor-voice" value={voice} onChange={(event) => setVoice(event.target.value)}>
            {voices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <small>Voice dùng cho bản lồng tiếng.</small>
        </div>
        <div className="field">
          <label htmlFor="editor-profile">Phong cách nội dung</label>
          <select id="editor-profile" value={profile} onChange={(event) => setProfile(event.target.value)}>
            {profiles.map((item) => <option key={item} value={item}>{item === "default" ? "Mặc định · bám sát nội dung" : item}</option>)}
          </select>
          <small>Profile hướng dẫn cách viết lại lời thoại.</small>
        </div>
      </div>
      <details className="editor-advanced">
        <summary>Thiết lập nâng cao</summary>
        <div className="editor-advanced__body">
          <div className="editor-advanced__toggles">
            <label className="toggle-field"><input type="checkbox" checked={useGemini} onChange={(event) => setUseGemini(event.target.checked)} /><span><strong>Dùng Gemini</strong><small>Viết lại transcript thành tiếng Việt tự nhiên.</small></span></label>
            <label className="toggle-field"><input type="checkbox" checked={!noTts} onChange={(event) => { const disabled = !event.target.checked; setNoTts(disabled); if (disabled) setNoRender(true); }} /><span><strong>Tạo voice</strong><small>Sinh audio tiếng Việt bằng giọng đã chọn.</small></span></label>
            <label className="toggle-field"><input type="checkbox" checked={!noRender && !noTts} disabled={noTts} onChange={(event) => setNoRender(!event.target.checked)} /><span><strong>Render video</strong><small>Ghép voice, phụ đề và video thành MP4.</small></span></label>
          </div>
          <div className="field"><label htmlFor="editor-tts-rate">Tốc độ giọng đọc</label><input id="editor-tts-rate" value={ttsRate} disabled={noTts} onChange={(event) => setTtsRate(event.target.value)} placeholder="Theo cấu hình backend, ví dụ +8%" /><small>Để trống để dùng tốc độ mặc định của service.</small></div>
        </div>
      </details>
    </> : <div className="field">
      <label htmlFor="editor-segment-minutes">Độ dài tối đa mỗi phần</label>
      <input id="editor-segment-minutes" type="number" min={splitMin} max={splitMax} value={segmentMinutes} onChange={(event) => setSegmentMinutes(Math.max(splitMin, Math.min(splitMax, Number(event.target.value) || splitMin)))} />
      <small>Từ {splitMin} đến {splitMax} phút; video ngắn hơn sẽ được giữ thành một phần.</small>
    </div>}

    <button className="button button--primary editor-submit" type="submit" disabled={!video || submitting || Boolean(error)} data-state={submitting ? "loading" : undefined}>
      {!submitting && <UploadCloud aria-hidden="true" />}{submitting ? "Đang tạo job…" : operation === "translate" ? "Tạo job lồng tiếng" : "Tạo job tách video"}
    </button>
    <p className="editor-stage" role="status" aria-live="polite">{stage}</p>
  </form>;
}
