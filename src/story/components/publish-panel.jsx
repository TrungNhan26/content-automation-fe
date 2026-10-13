import { useState } from 'react';
import { api } from '../api.js';
import { downloadBlob, pngBlobsToPdf, slugify } from '../lib/export.js';
import { DEFAULT_PUBLISH, PUBLISH_STATUSES, TIKTOK_MAX_PHOTOS, postText } from '../lib/publish.js';

/** Approval status, caption/music suggestion, hand-off of the final slides to Autopost and file export. */
export default function PublishPanel({ project, update, blobs, missingFrames }) {
  const publish = { ...DEFAULT_PUBLISH, ...project.publish };
  const setPublish = (patch) => update((p) => ({ publish: { ...DEFAULT_PUBLISH, ...p.publish, ...patch } }));
  const [busy, setBusy] = useState(''); // 'caption' | 'autopost' | 'export'
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [saved, setSaved] = useState('');

  const text = postText(publish);

  async function run(kind, fn) {
    setBusy(kind);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const writeCaption = () =>
    run('caption', async () => {
      if ((publish.caption || publish.hashtags) && !confirm('Ghi đè tiêu đề, caption và gợi ý nhạc hiện tại?')) return;
      const data = await api.generateCaption(project.id, {
        title: project.title,
        storyIdea: project.idea,
        slides: project.slides.map((s) => ({
          idea: s.idea,
          dialogues: s.frames.flatMap((f) => f.dialogues.map((d) => d.text)).filter(Boolean),
        })),
      });
      setPublish(data);
    });

  async function copy(key, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setError('Không copy được, hãy chọn chữ và copy thủ công.');
    }
  }

  const setStatus = (status) =>
    setPublish({ status, postedAt: status === 'posted' ? publish.postedAt || new Date().toISOString() : null });

  const saveForAutopost = () =>
    run('autopost', async () => {
      await api.saveRenderedSlides(project.id, blobs);
      const sent = await api.sendToAutopost(project.id, {
        title: publish.title || project.title,
        caption: publish.caption,
        hashtags: publish.hashtags,
      });
      setSaved(`Đã đưa ${sent.images} ảnh vào Autopost. Mở mục "Post video", chọn project "${publish.title || project.title}" để chọn kênh và hẹn giờ.`);
    });

  const exportFiles = (asPdf) =>
    run('export', async () => {
      const base = slugify(project.title);
      if (asPdf) downloadBlob(await pngBlobsToPdf(blobs), `${base}.pdf`);
      else blobs.forEach((blob, i) => downloadBlob(blob, `${base}-anh-${i + 1}.png`));
    });

  const field = (key, label, props = {}) => (
    <label>
      {label}
      <input value={publish[key]} onChange={(e) => setPublish({ [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <section className="card stack">
      <div className="row wrap between">
        <h3>Duyệt & đăng</h3>
        <div className="row">
          {PUBLISH_STATUSES.map((s) => (
            <button key={s.id} className={`tab ${publish.status === s.id ? 'active' : ''}`} onClick={() => setStatus(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="small checklist">
        <li className={missingFrames ? 'warning' : ''}>
          {missingFrames ? `Còn ${missingFrames} khung chưa có ảnh` : '✓ Tất cả khung đã có ảnh'}
        </li>
        <li className={blobs.length > TIKTOK_MAX_PHOTOS ? 'warning' : ''}>
          {blobs.length > TIKTOK_MAX_PHOTOS
            ? `TikTok chỉ cho tối đa ${TIKTOK_MAX_PHOTOS} ảnh mỗi bài (truyện đang có ${blobs.length})`
            : `✓ ${blobs.length} ảnh (TikTok tối đa ${TIKTOK_MAX_PHOTOS})`}
        </li>
        <li className={text ? '' : 'warning'}>{text ? '✓ Đã có caption' : 'Chưa có caption'}</li>
        {publish.postedAt && <li>Đã đăng lúc {new Date(publish.postedAt).toLocaleString('vi-VN')}</li>}
      </ul>

      <div className="publish-grid">
        <div className="stack">
          {field('title', `Tiêu đề (${publish.title.length}/90)`, { maxLength: 90 })}
          <label>
            Caption
            <textarea rows={4} value={publish.caption} onChange={(e) => setPublish({ caption: e.target.value })} />
          </label>
          {field('hashtags', 'Hashtag', { placeholder: '#truyentranh #cam_dong' })}
          <div className="row wrap">
            <button className="primary" disabled={Boolean(busy) || !project.slides.length} onClick={writeCaption}>
              {busy === 'caption' ? 'Gemini đang viết…' : '✨ Gemini viết caption'}
            </button>
            <button disabled={!publish.title} onClick={() => copy('title', publish.title)}>
              {copied === 'title' ? 'Đã copy ✓' : 'Copy tiêu đề'}
            </button>
            <button disabled={!text} onClick={() => copy('text', text)}>
              {copied === 'text' ? 'Đã copy ✓' : 'Copy caption + hashtag'}
            </button>
          </div>
          {field('musicMood', 'Gợi ý nhạc nền')}
          {field('musicKeywords', 'Từ khoá tìm nhạc trong TikTok')}
        </div>

        <div className="stack">
          <div className="label">Đưa vào Autopost</div>
          <div>
            <button className="primary" disabled={Boolean(busy) || !blobs.length || Boolean(missingFrames)} onClick={saveForAutopost}>
              {busy === 'autopost' ? 'Đang lưu…' : '📤 Đưa vào Autopost'}
            </button>
          </div>
          {saved && <p className="small">{saved}</p>}
          <p className="muted small">
            Đưa các ảnh đã ghép (có bóng thoại), tiêu đề, caption và hashtag sang mục Post video thành một project carousel để đăng qua Buffer.
            Sửa truyện hoặc caption ở đây thì bấm lại để cập nhật.
          </p>

          <div className="label">Hoặc tải về máy</div>
          <div className="row wrap">
            <button disabled={Boolean(busy)} onClick={() => exportFiles(false)}>Tải PNG tất cả ảnh</button>
            <button disabled={Boolean(busy)} onClick={() => exportFiles(true)}>Xuất PDF</button>
          </div>
        </div>
      </div>

      {error && <p className="error small">{error}</p>}
    </section>
  );
}
