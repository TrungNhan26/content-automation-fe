import { ImagePlus, Plus, Video, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { api } from "../api";
import type { ContentProject } from "../types";

type Kind = "video" | "carousel";

const VIDEO_TYPES = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
const IMAGE_TYPES = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const MAX_IMAGES = 20;
const MAX_FILE_MB = 95;

/** Create a Post video project from your own files; nothing here needs the crawling PC. */
export function NewPostForm({ onCreated }: { onCreated: (project: ContentProject) => void }) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("video");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");
  const busy = progress !== "";

  function reset() {
    setFiles([]);
    setTitle("");
    setCaption("");
    setHashtags("");
    setError("");
    setProgress("");
  }

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    const tooBig = chosen.find((file) => file.size > MAX_FILE_MB * 1_000_000);
    if (tooBig) {
      setError(`“${tooBig.name}” lớn hơn ${MAX_FILE_MB} MB. Hãy nén hoặc cắt ngắn rồi thử lại.`);
      return;
    }
    setError("");
    setFiles(kind === "video" ? chosen.slice(0, 1) : chosen.slice(0, MAX_IMAGES));
    if (!title && chosen[0]) setTitle(chosen[0].name.replace(/\.[^.]+$/, ""));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || files.length === 0) return;
    setError("");
    try {
      const keys: string[] = [];
      for (const [index, file] of files.entries()) {
        const label = files.length > 1 ? `Đang tải ${index + 1}/${files.length}` : "Đang tải lên";
        setProgress(`${label}… 0%`);
        keys.push(await api.uploadMedia(file, (percent) => setProgress(`${label}… ${percent}%`)));
      }
      setProgress("Đang tạo project…");
      const project = await api.createProject({
        title: title.trim() || files[0].name,
        caption: caption.trim(),
        hashtags: hashtags.split(/[\s,]+/).map((tag) => tag.trim()).filter(Boolean),
        media_type: kind,
        keys,
      });
      reset();
      setOpen(false);
      onCreated(project);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được bài mới.");
      setProgress("");
    }
  }

  if (!open) {
    return <button type="button" className="button button--primary" onClick={() => setOpen(true)}>
      <Plus aria-hidden="true" />Tạo bài mới
    </button>;
  }

  return <form className="new-post" onSubmit={submit} aria-busy={busy} aria-labelledby={`${ids}-title`}>
    <header>
      <h3 id={`${ids}-title`}>Tạo bài mới từ file của bạn</h3>
      <button type="button" className="icon-button" aria-label="Đóng" disabled={busy} onClick={() => { reset(); setOpen(false); }}><X aria-hidden="true" /></button>
    </header>
    <fieldset className="new-post__kind" disabled={busy}>
      <legend>Loại bài</legend>
      <label className={kind === "video" ? "is-selected" : undefined}>
        <input type="radio" name={`${ids}-kind`} checked={kind === "video"} onChange={() => { setKind("video"); setFiles([]); }} />
        <Video aria-hidden="true" /><span>Video</span>
      </label>
      <label className={kind === "carousel" ? "is-selected" : undefined}>
        <input type="radio" name={`${ids}-kind`} checked={kind === "carousel"} onChange={() => { setKind("carousel"); setFiles([]); }} />
        <ImagePlus aria-hidden="true" /><span>Ảnh (tối đa {MAX_IMAGES})</span>
      </label>
    </fieldset>
    <div className="field">
      <label htmlFor={`${ids}-files`}>{kind === "video" ? "File video" : "Ảnh"}</label>
      <input
        id={`${ids}-files`}
        type="file"
        accept={kind === "video" ? VIDEO_TYPES : IMAGE_TYPES}
        multiple={kind === "carousel"}
        disabled={busy}
        onChange={(event) => pick(event.currentTarget.files)}
      />
      <small>{files.length ? `${files.length} file · ${(files.reduce((sum, file) => sum + file.size, 0) / 1_000_000).toFixed(1)} MB` : `Mỗi file tối đa ${MAX_FILE_MB} MB.`}</small>
    </div>
    <div className="field">
      <label htmlFor={`${ids}-name`}>Tiêu đề</label>
      <input id={`${ids}-name`} value={title} maxLength={255} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
    </div>
    <div className="field">
      <label htmlFor={`${ids}-caption`}>Caption</label>
      <textarea id={`${ids}-caption`} value={caption} maxLength={2000} disabled={busy} onChange={(event) => setCaption(event.target.value)} />
    </div>
    <div className="field">
      <label htmlFor={`${ids}-tags`}>Hashtag</label>
      <input id={`${ids}-tags`} value={hashtags} placeholder="#hashtag #noidung (tối đa 4)" disabled={busy} onChange={(event) => setHashtags(event.target.value)} />
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {progress && <p className="inline-success" role="status">{progress}</p>}
    <button type="submit" className="button button--primary" data-state={busy ? "loading" : undefined} disabled={busy || files.length === 0}>
      Tải lên và tạo project
    </button>
  </form>;
}
