import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  FolderPlus,
  LoaderCircle,
  Pause,
  Play,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { NewPostForm } from "../components/NewPostForm";
import { formatDate } from "../utils";
import type {
  AutopostStatus,
  BufferOrganization,
  ContentItem,
  ContentProject,
  ContentProjectSummary,
  PostSettings,
  StorageUsage,
} from "../types";

type Channel = { id: string; name: string; service: string };
type Draft = { caption: string; hashtags: string };
type VideoFeedback = "error" | "success";

function localDateTime(minutesFromNow = 10) {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function channelList(organizations: BufferOrganization[]): Channel[] {
  return organizations.flatMap((organization) =>
    organization.channels.map((channel) => ({
      id: channel.id,
      name: channel.displayName || channel.name || channel.id,
      service: channel.service || organization.name,
    })),
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "Chờ đăng",
    scheduled: "Đã hẹn",
    posting: "Đang đăng",
    posted: "Đã đăng",
    failed: "Lỗi",
  };
  return labels[status] || status;
}

function projectStatus(project: ContentProjectSummary) {
  if (project.posted_count > 0) return { label: "Đã đăng", tone: "posted" };
  if (project.scheduled_count > 0) return { label: "Đã hẹn", tone: "scheduled" };
  return { label: "Chưa đăng", tone: "draft" };
}

export function AutopostProjectsPage() {
  const [projects, setProjects] = useState<ContentProjectSummary[]>([]);
  const [project, setProject] = useState<ContentProject>();
  const [autopost, setAutopost] = useState<AutopostStatus>();
  const [storage, setStorage] = useState<StorageUsage>();
  const [settings, setSettings] = useState<PostSettings>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [videoFeedback, setVideoFeedback] = useState<Record<string, VideoFeedback>>({});
  const [scheduledAt, setScheduledAt] = useState(localDateTime());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const projectOpenerRef = useRef<HTMLElement | null>(null);

  const refreshProjects = useCallback(async () => {
    const items = await api.projects();
    setProjects(items);
    // R2 usage changes whenever projects are scheduled or cleaned up; the backend caches it for 20 s.
    void api.storageUsage().then(setStorage).catch(() => undefined);
    return items;
  }, []);

  const openProject = useCallback(async (id: string, rememberOpener = false) => {
    if (rememberOpener && document.activeElement instanceof HTMLElement) {
      projectOpenerRef.current = document.activeElement;
    }
    setBusy(`project:${id}`);
    setError("");
    try {
      const detail = await api.project(id);
      setProject(detail);
      setDrafts(Object.fromEntries(detail.items.map((item) => [
        item.id,
        { caption: item.caption, hashtags: item.hashtags.join(" ") },
      ])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đọc được project.");
    } finally {
      setBusy("");
    }
  }, []);

  const finishProjectClose = useCallback(() => {
    setProject(undefined);
    window.requestAnimationFrame(() => projectOpenerRef.current?.focus());
  }, []);

  const closeProject = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    finishProjectClose();
  }, [finishProjectClose]);

  useEffect(() => {
    if (!project || !dialogRef.current) return;
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(() => {
      const firstControl = dialog.querySelector<HTMLInputElement>(".publish-config input:not(:disabled)");
      (firstControl || dialog.querySelector<HTMLButtonElement>(".project-modal__close"))?.focus();
    });
  }, [project?.id]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      refreshProjects(),
      api.autopostStatus().then((value) => { if (active) setAutopost(value); }),
      api.postSettings().then((value) => { if (active) setSettings(value); }),
      api.autopostChannels().then((value) => {
        if (active) setChannels(channelList(value));
      }),
    ]).then((results) => {
      if (!active) return;
      const rejected = results.find((item) => item.status === "rejected");
      if (rejected?.status === "rejected") {
        setError(rejected.reason instanceof Error ? rejected.reason.message : "Không đọc được dữ liệu autopost.");
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [refreshProjects]);

  useEffect(() => {
    if (!project) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return; // every Worker request counts against the free daily budget
      void api.project(project.id).then((detail) => {
        setProject(detail);
        void refreshProjects();
      }).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [project?.id, refreshProjects]);

  // A video goes to each channel once: channels it is already scheduled on or posted to
  // are locked (the Worker refuses them too).
  const usedChannels = useMemo(() => {
    const used = new Map<string, string>();
    for (const item of project?.items ?? []) {
      for (const plan of item.publish_plans) {
        if (plan.status === "posted") used.set(plan.channel_id, `Đã đăng ${formatDate(plan.posted_at || plan.scheduled_at)}`);
        else if (plan.status !== "failed" && !used.has(plan.channel_id)) used.set(plan.channel_id, `Đã hẹn ${formatDate(plan.scheduled_at)}`);
      }
    }
    return used;
  }, [project]);
  const chosenChannels = useMemo(
    () => channels.filter((channel) => selectedChannels.includes(channel.id) && !usedChannels.has(channel.id)),
    [channels, selectedChannels, usedChannels],
  );

  async function toggleAutopost() {
    if (!autopost) return;
    setBusy("autopost");
    setError("");
    try {
      setAutopost(await api.setAutopostEnabled(!autopost.control.autopost_enabled));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đổi được trạng thái worker.");
    } finally {
      setBusy("");
    }
  }

  async function toggleAutoImport() {
    if (!settings) return;
    setBusy("auto-import");
    setError("");
    try {
      setSettings(await api.setAutoImport(!settings.auto_import));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đổi được cài đặt tự tạo project.");
    } finally {
      setBusy("");
    }
  }

  function tagsFor(item: ContentItem) {
    return (drafts[item.id]?.hashtags || "")
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.startsWith("#") ? value : `#${value}`);
  }

  async function replaceVideo(item: ContentItem, file: File) {
    if (!project) return;
    const uploadState = `video:${item.id}`;
    setBusy(uploadState);
    setVideoFeedback((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setError("");
    setNotice("");
    try {
      const updated = await api.replaceContentItemVideo(item.id, file);
      setProject((current) => current ? {
        ...current,
        items: current.items.map((value) => value.id === updated.id ? updated : value),
        updated_at: updated.updated_at,
      } : current);
      setProjects((current) => current.map((value) => value.id === project.id ? {
        ...value,
        updated_at: updated.updated_at,
      } : value));
      setVideoFeedback((current) => ({ ...current, [item.id]: "success" }));
      setNotice(`Đã đổi video cho “${item.title}”. Caption và hashtag được giữ nguyên.`);
    } catch (reason) {
      setVideoFeedback((current) => ({ ...current, [item.id]: "error" }));
      setError(reason instanceof Error ? reason.message : "Không đổi được video.");
    } finally {
      setBusy("");
    }
  }

  async function deleteProject(item: ContentProjectSummary) {
    if (!window.confirm(`Xóa project “${item.name}” và toàn bộ dữ liệu đăng liên quan?`)) return;
    setBusy(`delete:${item.id}`);
    setError("");
    setNotice("");
    try {
      await api.deleteProject(item.id);
      setProjects((current) => current.filter((value) => value.id !== item.id));
      setNotice(`Đã xóa project “${item.name}”.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không xóa được project.");
    } finally {
      setBusy("");
    }
  }

  async function createPlans(now = false) {
    if (!project || !project.items.length || !chosenChannels.length) return;
    setBusy("schedule");
    setError("");
    setNotice("");
    try {
      const when = now ? new Date() : new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) throw new Error("Ngày giờ đăng không hợp lệ.");
      for (const item of project.items) {
        const draft = drafts[item.id] || { caption: item.caption, hashtags: item.hashtags.join(" ") };
        const hashtags = tagsFor(item);
        await api.updateContentItem(item.id, { caption: draft.caption.trim(), hashtags });
        await api.createPublishPlans(item.id, {
          channels: chosenChannels,
          scheduled_at: when.toISOString(),
          caption: draft.caption.trim(),
          hashtags,
        });
      }
      setNotice(now ? "Đã đưa nội dung vào hàng chờ đăng ngay." : "Đã lưu lịch đăng.");
      await openProject(project.id);
      await refreshProjects();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được lịch đăng.");
    } finally {
      setBusy("");
    }
  }

  const storagePercent = storage?.available && storage.max_bytes ? (storage.used_bytes / storage.max_bytes) * 100 : 0;
  const gigabytes = (bytes: number) => (bytes / 1_000_000_000).toFixed(2);

  return (
    <div className="page autopost-projects">
      <header className="autopost-projects__head">
        <div>
          <h1>Project đăng bài</h1>
          <p>Video crawl về và bài bạn tự tải lên đều nằm ở đây. Lịch đăng chạy trên Cloudflare nên không cần bật server.</p>
        </div>
      </header>

      <section className="autopost-runtime" aria-label="Trạng thái autopost">
        <span className={`worker-light ${autopost?.control.autopost_enabled ? "is-running" : ""}`} />
        <div>
          <strong>{autopost?.control.autopost_enabled ? "Lịch đăng đang hoạt động" : "Lịch đăng đang tạm dừng"}</strong>
          <small>Kế hoạch đến hạn sẽ được gửi qua Buffer.</small>
        </div>
        <button className="button" disabled={!autopost || busy === "autopost"} onClick={toggleAutopost}>
          {autopost?.control.autopost_enabled ? <Pause /> : <Play />}
          {busy === "autopost" ? "Đang lưu…" : autopost?.control.autopost_enabled ? "Tạm dừng" : "Bật lịch"}
        </button>
      </section>

      {storage?.available && (
        <section className={`r2-usage${storagePercent >= 100 ? " is-full" : storagePercent >= 80 ? " is-warm" : ""}`} aria-label="Dung lượng R2">
          <div>
            <strong>Bộ nhớ R2 tạm: {gigabytes(storage.used_bytes)} / {gigabytes(storage.max_bytes)} GB</strong>
            <small>
              {storagePercent >= 100
                ? "R2 đã đầy: chưa hẹn thêm được cho tới khi các bài đã đăng được dọn."
                : `${storage.items} nội dung đang giữ trên R2. Tự xóa 24 giờ sau khi đăng; gói miễn phí của Cloudflare là 10 GB.`}
            </small>
          </div>
          <progress value={Math.min(storage.used_bytes, storage.max_bytes)} max={storage.max_bytes} aria-label={`Đã dùng ${Math.round(storagePercent)}% dung lượng R2`} />
        </section>
      )}

      {!project && (error || notice) && (
        <p className={error ? "inline-error" : "inline-success"} role={error ? "alert" : "status"}>
          {error || notice}
        </p>
      )}

      <section className="project-catalogue" aria-labelledby="project-catalogue-heading">
        <div className="section-head">
          <div>
            <div className="catalogue-title">
              <h2 id="project-catalogue-heading">Thư viện project</h2>
              <button
                type="button"
                role="switch"
                className="mini-switch"
                aria-checked={Boolean(settings?.auto_import)}
                disabled={!settings || busy === "auto-import"}
                onClick={toggleAutoImport}
                title={settings?.auto_import
                  ? "Đang bật: video crawl xong tự thành project"
                  : "Đang tắt: crawl xong không tự tạo project; bấm “Đưa vào Post video” ở trang job nếu cần"}
              >
                <span className="mini-switch__track" aria-hidden="true"><span className="mini-switch__thumb" /></span>
                <span>Tự tạo từ crawl</span>
              </button>
            </div>
            <p>{projects.length} project.{settings && !settings.auto_import ? " Crawl xong sẽ không tự vào đây." : ""}</p>
          </div>
          <NewPostForm onCreated={(created) => {
            setNotice(`Đã tạo project “${created.name}”. Chọn kênh và giờ đăng ở bên dưới.`);
            void refreshProjects().then(() => openProject(created.id));
          }} />
        </div>
        {loading ? (
          <div className="project-skeletons" aria-label="Đang tải project">
            {[0, 1, 2].map((item) => <i key={item} />)}
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((item) => {
              const state = projectStatus(item);
              const deleting = busy === `delete:${item.id}`;
              const opening = busy === `project:${item.id}`;
              return (
                <article className="project-card" data-state={deleting ? "loading" : undefined} key={item.id}>
                  <button
                    className="project-card__open"
                    disabled={deleting || opening}
                    aria-busy={opening}
                    onClick={() => void openProject(item.id, true)}
                  >
                    <span className="project-card__media">
                      {item.cover_url && item.media_type === "carousel"
                        ? <img
                            key={`${item.id}:${item.updated_at}`}
                            src={`${item.cover_url}?v=${encodeURIComponent(item.updated_at)}`}
                            alt=""
                            aria-hidden="true"
                          />
                        : item.cover_url
                        ? <video
                            key={`${item.id}:${item.updated_at}`}
                            src={`${item.cover_url}?v=${encodeURIComponent(item.updated_at)}`}
                            muted
                            preload="metadata"
                            aria-hidden="true"
                          />
                        : <span><FolderPlus aria-hidden="true" /></span>}
                    </span>
                    <span className="project-card__body">
                      <strong>{item.name}</strong>
                      <small>{item.item_count} {item.media_type === "carousel" ? "truyện ảnh" : "video"} · {item.scheduled_count} lịch · {item.posted_count} lượt đăng</small>
                      <span className={`project-state project-state--${state.tone}`}>{state.label}</span>
                    </span>
                    {opening
                      ? <LoaderCircle className="is-spinning" aria-hidden="true" />
                      : <ChevronRight aria-hidden="true" />}
                  </button>
                  <button
                    className="icon-button project-card__delete"
                    type="button"
                    disabled={deleting || opening}
                    data-state={deleting ? "loading" : undefined}
                    aria-label={`Xóa project ${item.name}`}
                    title="Xóa project"
                    onClick={() => void deleteProject(item)}
                  >
                    {!deleting && <Trash2 aria-hidden="true" />}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {project && (
        <dialog
          ref={dialogRef}
          className="project-modal"
          aria-labelledby="project-workbench-heading"
          aria-describedby="project-workbench-description"
          onClose={finishProjectClose}
          onMouseDown={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const outside = (
              event.clientX < bounds.left
              || event.clientX > bounds.right
              || event.clientY < bounds.top
              || event.clientY > bounds.bottom
            );
            if (outside) closeProject();
          }}
        >
          <section className="project-workbench">
            <header className="project-modal__header">
              <div>
                <h2 id="project-workbench-heading">{project.name}</h2>
                <p id="project-workbench-description">Kiểm tra video, chọn kênh và thời gian. Caption được lưu khi đăng hoặc hẹn lịch.</p>
              </div>
              <div className="project-modal__tools">
                <button
                  className="icon-button project-modal__close"
                  type="button"
                  aria-label="Đóng project"
                  title="Đóng"
                  onClick={closeProject}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="project-modal__body">
              {(error || notice) && (
                <p className={error ? "inline-error" : "inline-success"} role={error ? "alert" : "status"}>
                  {error || notice}
                </p>
              )}

              <div className="publish-config">
                <fieldset>
                  <legend>Kênh đăng</legend>
                  {channels.length ? channels.map((channel) => (
                    <label key={channel.id} className={usedChannels.has(channel.id) ? "is-used" : undefined}>
                      <input
                        type="checkbox"
                        disabled={usedChannels.has(channel.id)}
                        checked={selectedChannels.includes(channel.id) && !usedChannels.has(channel.id)}
                        onChange={(event) => setSelectedChannels((current) =>
                          event.target.checked
                            ? [...current, channel.id]
                            : current.filter((id) => id !== channel.id)
                        )}
                      />
                      <span><strong>{channel.name}</strong><small>{usedChannels.get(channel.id) ?? (channel.service || "Buffer")}</small></span>
                    </label>
                  )) : <p><AlertTriangle /> Chưa đọc được kênh Buffer. Kiểm tra API key của autopost.</p>}
                  {channels.length > 0 && chosenChannels.length === 0 && (
                    <p className="publish-channel-hint" role="status">
                      <AlertTriangle /> Hãy chọn ít nhất một kênh để đăng.
                    </p>
                  )}
                </fieldset>
                <div className="publish-time">
                  <label htmlFor="publish-time"><Clock3 /> Ngày giờ đăng</label>
                  <input
                    id="publish-time"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                  <small>Múi giờ theo thiết bị hiện tại.</small>
                </div>
                <div className="publish-actions">
                  <button
                    className="button"
                    disabled={!project.items.length || !chosenChannels.length || busy === "schedule" || busy.startsWith("video:")}
                    onClick={() => void createPlans(true)}
                  >
                    <Send /> Đăng ngay
                  </button>
                  <button
                    className="button button--primary"
                    disabled={!project.items.length || !chosenChannels.length || busy === "schedule" || busy.startsWith("video:")}
                    data-state={busy === "schedule" ? "loading" : undefined}
                    onClick={() => void createPlans(false)}
                  >
                    <CalendarClock /> {busy === "schedule" ? "Đang lưu…" : "Hẹn lịch"}
                  </button>
                </div>
              </div>

              <div className="content-list">
                {project.items.length ? project.items.map((item) => {
                  const draft = drafts[item.id] || { caption: item.caption, hashtags: item.hashtags.join(" ") };
                  const latestPlan = item.publish_plans[0];
                  const videoInputId = `content-video-${item.id}`;
                  const isReplacingVideo = busy === `video:${item.id}`;
                  const replaceState = isReplacingVideo ? "loading" : videoFeedback[item.id];
                  const replaceLabel = isReplacingVideo
                    ? "Đang tải…"
                    : replaceState === "success"
                      ? "Đã đổi video"
                      : replaceState === "error"
                        ? "Thử lại"
                        : "Đổi video";
                  return (
                    <article className="content-card" key={item.id}>
                      {item.media_type === "carousel"
                        ? <div className="content-carousel" aria-label={`${item.image_urls?.length ?? 0} ảnh`}>
                            {(item.image_urls ?? []).map((url, index) => (
                              <img
                                key={url}
                                src={`${url}?v=${encodeURIComponent(item.updated_at)}`}
                                alt={`Ảnh ${index + 1}`}
                                loading="lazy"
                              />
                            ))}
                          </div>
                        : item.has_media === false
                          ? <div className="content-media-missing" role="note">
                              <AlertTriangle aria-hidden="true" />
                              <span>Video đã được dọn khỏi R2 sau khi đăng. Bấm “Đổi video” để tải lại nếu muốn đăng tiếp.</span>
                            </div>
                          : <video
                              key={`${item.id}:${item.updated_at}`}
                              controls
                              preload="metadata"
                              src={`${item.video_url}?v=${encodeURIComponent(item.updated_at)}`}
                            />}
                      <div className="content-card__editor">
                        <header>
                          <div>
                            <strong title={item.title}>{item.title}</strong>
                            <small>{item.source} · {item.caption_status === "ready" ? "Caption đã chuẩn bị" : "Cần kiểm tra caption"}</small>
                          </div>
                          {latestPlan && (
                            <span className={`plan-state plan-state--${latestPlan.status}`}>
                              {latestPlan.status === "posted" && <Check />}
                              {statusLabel(latestPlan.status)}
                            </span>
                          )}
                        </header>
                        <label>
                          <span>Caption</span>
                          <textarea
                            value={draft.caption}
                            onChange={(event) => setDrafts((current) => ({
                              ...current,
                              [item.id]: { ...draft, caption: event.target.value },
                            }))}
                            maxLength={2000}
                          />
                        </label>
                        <label>
                          <span>Hashtag</span>
                          <input
                            value={draft.hashtags}
                            onChange={(event) => setDrafts((current) => ({
                              ...current,
                              [item.id]: { ...draft, hashtags: event.target.value },
                            }))}
                            placeholder="#hashtag #noidung (tối đa 4)"
                          />
                        </label>
                        {latestPlan?.error && <small className="field-error">{latestPlan.error}</small>}
                        {item.media_type !== "carousel" && <>
                        <input
                          id={videoInputId}
                          className="content-video-input"
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
                          disabled={isReplacingVideo}
                          aria-label={`Đổi video cho ${item.title}`}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            if (file) void replaceVideo(item, file);
                          }}
                        />
                        <button
                          className="button content-reupload"
                          type="button"
                          data-state={replaceState}
                          disabled={isReplacingVideo}
                          aria-controls={videoInputId}
                          onClick={() => document.getElementById(videoInputId)?.click()}
                        >
                          {!isReplacingVideo && (
                            replaceState === "success"
                              ? <Check aria-hidden="true" />
                              : replaceState === "error"
                                ? <AlertTriangle aria-hidden="true" />
                                : <Upload aria-hidden="true" />
                          )}
                          <span>{replaceLabel}</span>
                        </button>
                        </>}
                      </div>
                    </article>
                  );
                }) : (
                  <div className="empty-state">
                    <FolderPlus />
                    <div><strong>Project chưa có video.</strong><p>Tạo bài mới từ file của bạn, hoặc crawl video khi server đang bật.</p></div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </dialog>
      )}
    </div>
  );
}
