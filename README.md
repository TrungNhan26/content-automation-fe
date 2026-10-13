# Content Station Frontend

React + Vite + TypeScript frontend for the unified Content Station API. The workbench includes Bilibili, Douyin, TikTok and YouTube downloads, Content Editor Automation, job history, media previews and autopost handoff.

The Douyin screen separates direct URL downloads, profile/mix/music/favorites crawls,
search/hot-board JSONL discovery and live recording. It only exposes options used by
the selected runtime mode and reads safe session metadata from `GET /douyin/session`.
Session restore calls `POST /douyin/session/restore` with the required
`X-Content-Station-Action` header; cookie values never enter frontend state.

## Development

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to `http://127.0.0.1:8000`.

## Content Editor API

Relative to the configured API base (default `/api/v1`), the Content Editor screen reads service options from `GET /content-editor/capabilities`. It uses signed direct R2 upload through `/content-editor/uploads/presign` and `/complete` when configured, or streams multipart data to `POST /content-editor/jobs` otherwise. Any compatible completed video can be handed to `POST /jobs/{id}/autopost` with an explicit Beauty, Fashion or Food profile and optional caption.

The upload form sends `file`, `operation`, `voice`, `segment_minutes` and `profile`, plus the optional `tts_rate`, `use_gemini`, `no_tts` and `no_render` fields.

## Production build

```powershell
npm run build
```

Set `VITE_API_URL` when the backend is hosted on another origin.
