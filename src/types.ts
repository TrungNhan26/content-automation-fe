export type DownloadSource = "bilibili" | "douyin" | "tiktok" | "youtube";
export type SourceName = DownloadSource;
export type JobSource = DownloadSource | "content_editor";
export type JobStatus = "queued" | "running" | "succeeded" | "completed" | "done" | "failed" | "cancelled" | "canceled";
export type ActivityAction = "crawl_video" | "edit_sub" | "post_video";
export type ContentEditorOperation = "translate" | "split";
export type DouyinMode = "auto" | "video" | "note" | "profile" | "mix" | "music" | "live" | "favorites" | "collect" | "collectmix" | "hot_board" | "search";
export type DouyinSelectableMode = Exclude<DouyinMode, "collect" | "collectmix">;
export type DouyinProfileMode = "post" | "like" | "mix" | "music";
export type DouyinFavoriteMode = "collect" | "collectmix";

export interface DouyinSession {
  state: "not_configured" | "unavailable" | "recoverable" | "stored" | "restoring" | "authenticated";
  configured: boolean;
  authenticated: boolean;
  restoring: boolean;
  restore_available: boolean;
  profile_may_require_login: boolean;
  profile_session_state: "missing" | "unknown" | "expired" | "login_markers_present" | "verified";
  cookie_file_exists: boolean;
  stored_cookie_count: number;
  stored_login_markers: boolean;
  selected_profile: string | null;
  candidate_profiles: string[];
  verified_at: string | null;
  detail: string;
  backup_created?: boolean;
  restored_cookie_count?: number;
}

export interface MediaFile {
  id?: string;
  name: string;
  filename?: string;
  size?: number;
  size_bytes?: number;
  download_url?: string;
  url?: string;
  mime_type?: string;
  duration_seconds?: number;
  role?: "input" | "output" | "part" | "artifact";
}

export interface Job {
  id: string;
  source: JobSource;
  url?: string | null;
  status: JobStatus;
  progress: number;
  message?: string;
  error?: string;
  title?: string;
  input_name?: string;
  operation?: ContentEditorOperation;
  voice?: string;
  input_preview_url?: string;
  output_preview_url?: string;
  created_at: string | number;
  updated_at: string | number;
  files: MediaFile[];
}

export interface ContentEditorVoice {
  id: string;
  label: string;
}

export interface ContentEditorCapabilities {
  service_id?: string;
  display_name?: string;
  operations?: ContentEditorOperation[];
  accepted_extensions?: string[];
  max_upload_mb?: number;
  upload_chunk_mb?: number;
  voices?: Array<ContentEditorVoice | string>;
  profiles?: string[];
  default_voice?: string;
  default_segment_minutes?: number;
  r2_upload_enabled?: boolean;
}

export interface CreateContentEditorJob {
  file: File;
  operation: ContentEditorOperation;
  voice: string;
  segment_minutes: number;
  profile: string;
  tts_rate?: string;
  use_gemini?: boolean;
  no_tts?: boolean;
  no_render?: boolean;
}

export interface ContentEditorPresign {
  upload_url: string;
  upload_token: string;
  object_key: string;
  headers: Record<string, string>;
  expires_in: number;
}

export interface AutopostStatus {
  state: "running" | "stopped";
  running: boolean;
  control: {
    autopost_enabled: boolean;
  };
  config_health: {
    api_key_configured: boolean;
    media_configured: boolean;
  };
  last_error: string | null;
}

export interface BufferOrganization {
  id: string;
  name: string;
  channels: Array<{
    id: string;
    name?: string;
    displayName?: string;
    service?: string;
    isQueuePaused?: boolean;
  }>;
}

export type PublishPlanStatus = "queued" | "scheduled" | "posting" | "posted" | "failed";

export interface PublishPlan {
  id: string;
  content_item_id: string;
  channel_id: string;
  channel_name: string;
  channel_service: string;
  caption: string;
  hashtags: string[];
  scheduled_at: string;
  status: PublishPlanStatus;
  post_id?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
  posted_at?: string | null;
}

export interface PublishActivity extends PublishPlan {
  title: string;
}

export interface ContentItem {
  id: string;
  project_id: string;
  source_job_id: string;
  source_file_id: string;
  source: DownloadSource;
  title: string;
  video_url: string;
  media_type?: "video" | "carousel";
  image_urls?: string[];
  original_caption: string;
  caption: string;
  hashtags: string[];
  caption_status: "ready" | "needs_review";
  created_at: string;
  updated_at: string;
  publish_plans: PublishPlan[];
}

export interface ContentProjectSummary {
  id: string;
  name: string;
  description: string;
  item_count: number;
  ready_count: number;
  scheduled_count: number;
  posted_count: number;
  cover_url?: string | null;
  media_type?: "video" | "carousel";
  created_at: string;
  updated_at: string;
}

export interface ContentProject extends ContentProjectSummary {
  items: ContentItem[];
}

export interface CreateDownload {
  source: DownloadSource;
  url: string;
  audio_only: boolean;
  include_audio: boolean;
  mode: DouyinMode;
  write_metadata: boolean;
  include_cover: boolean;
  include_avatar: boolean;
  include_comments: boolean;
  include_comment_replies: boolean;
  browser_fallback: boolean;
  profile_modes: DouyinProfileMode[];
  favorite_modes: DouyinFavoriteMode[];
  increase: boolean;
  start_time: string | null;
  end_time: string | null;
  download_pinned: boolean;
  search_keyword: string;
  search_sort_type: number;
  search_publish_time: number;
}

export interface StorageUsage {
  available: boolean;
  used_bytes: number;
  max_bytes: number;
  items: number;
}
