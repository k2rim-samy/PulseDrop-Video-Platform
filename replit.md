# PulseDrop

PulseDrop analyzes permitted YouTube links, recommends a format, and downloads saved files with chapter-aware exports.

## Run & Operate

- `uv run uvicorn --app-dir artifacts/api-server/python pulsedrop_server:app --host 0.0.0.0 --port 8080` — run the Python API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/pulsedrop run typecheck` — check the web app
- `PORT=18372 BASE_PATH=/ pnpm --filter @workspace/pulsedrop run build` — production web build check

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Python FastAPI + Uvicorn
- Download engine: yt-dlp + FFmpeg
- Database: Python standard-library SQLite at `artifacts/api-server/data/pulsedrop.db`
- API contract: OpenAPI + Orval-generated React Query hooks
- Frontend: React + Vite + Tailwind CSS

## Where things live

- `artifacts/pulsedrop/src/pulsedrop-ui.tsx` — product UI, routes, hooks, and interaction states
- `artifacts/pulsedrop/src/index.css` — PulseDrop visual system and motion
- `artifacts/api-server/python/main.py` — FastAPI routes, SQLite schema, download jobs, file serving
- `artifacts/api-server/python/pulsedrop_server.py` — stable Uvicorn entrypoint
- `lib/api-spec/openapi.yaml` — API source of truth

## Architecture decisions

- The service is Python-first and runs behind the existing `/api` artifact route.
- SQLite stores job metadata; downloaded bytes stay in per-job folders under `artifacts/api-server/data/files`.
- Downloads are asynchronous jobs with polling-friendly status/progress and explicit cancel/restart actions.
- YouTube URL analysis happens before download so format recommendations and chapter options are based on source metadata.
- Format choices are normalized to `mp4:<height>` and `audio:<source-format>` IDs so the UI never exposes incompatible source containers.

## Product

- Analyze permitted YouTube URLs and inspect available formats.
- Choose smart video or audio output, split chapter bundles, and optional subtitles.
- Track active/completed/failed jobs in a searchable library.
- Save reusable format presets and view summary insights.

## User preferences

- The user requested a professional website with focused animation, unusual but useful downloader features, and Python service/database code.

## Gotchas

- The API workflow resolves its Python working directory from the repository root; use the managed workflow rather than a hand-created duplicate.
- The frontend build needs workflow-style `PORT` and `BASE_PATH` values when run manually.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
