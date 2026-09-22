from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
import threading
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

import yt_dlp
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
FILES_DIR = DATA_DIR / "files"
DB_PATH = DATA_DIR / "pulsedrop.db"
DATA_DIR.mkdir(parents=True, exist_ok=True)
FILES_DIR.mkdir(parents=True, exist_ok=True)

db_lock = threading.RLock()
executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pulsedrop-download")
cancel_flags: dict[int, threading.Event] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with db_lock, connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_url TEXT NOT NULL,
                title TEXT NOT NULL,
                channel TEXT NOT NULL DEFAULT '',
                thumbnail_url TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'queued',
                progress REAL NOT NULL DEFAULT 0,
                mode TEXT NOT NULL DEFAULT 'video',
                chapter_mode TEXT NOT NULL DEFAULT 'full',
                include_subtitles INTEGER NOT NULL DEFAULT 0,
                format_id TEXT NOT NULL DEFAULT 'best',
                format_label TEXT NOT NULL DEFAULT 'Smart best',
                file_name TEXT,
                file_url TEXT,
                error TEXT,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                format_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                chapter_mode TEXT NOT NULL,
                include_subtitles INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            """
        )


init_db()


class AnalyzeInput(BaseModel):
    url: str = Field(min_length=8)


class DownloadInput(BaseModel):
    url: str = Field(min_length=8)
    title: str | None = None
    formatId: str = "best"
    mode: Literal["video", "audio"] = "video"
    chapterMode: Literal["full", "split"] = "full"
    includeSubtitles: bool = False


class PresetInput(BaseModel):
    name: str = Field(min_length=1)
    formatId: str
    mode: Literal["video", "audio"]
    chapterMode: Literal["full", "split"]
    includeSubtitles: bool


def ensure_youtube_url(value: str) -> str:
    parsed = urlparse(value.strip())
    hostname = (parsed.hostname or "").lower()
    allowed = hostname in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"}
    if parsed.scheme not in {"http", "https"} or not allowed:
        raise HTTPException(status_code=400, detail="PulseDrop currently supports YouTube URLs only.")
    return value.strip()


def row_to_download(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "sourceUrl": row["source_url"],
        "title": row["title"],
        "channel": row["channel"],
        "thumbnailUrl": row["thumbnail_url"],
        "status": row["status"],
        "progress": round(float(row["progress"]), 1),
        "mode": row["mode"],
        "chapterMode": row["chapter_mode"],
        "includeSubtitles": bool(row["include_subtitles"]),
        "formatLabel": row["format_label"],
        "fileName": row["file_name"],
        "fileUrl": row["file_url"],
        "error": row["error"],
        "durationSeconds": row["duration_seconds"],
        "createdAt": row["created_at"],
        "completedAt": row["completed_at"],
    }


def get_download(download_id: int) -> sqlite3.Row | None:
    with db_lock, connection() as conn:
        return conn.execute("SELECT * FROM downloads WHERE id = ?", (download_id,)).fetchone()


def update_download(download_id: int, **values: Any) -> None:
    if not values:
        return
    columns = ", ".join(f"{key} = ?" for key in values)
    with db_lock, connection() as conn:
        conn.execute(
            f"UPDATE downloads SET {columns} WHERE id = ?",
            (*values.values(), download_id),
        )
        conn.commit()


def extract_metadata(url: str) -> dict[str, Any]:
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "extract_flat": False,
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        return ydl.extract_info(url, download=False)


def readable_size(value: float | int | None) -> float:
    if not value:
        return 0
    return round(float(value) / 1_000_000, 1)


def format_options(info: dict[str, Any]) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = [
        {
            "formatId": "best",
            "label": "Smart best",
            "extension": "mp4",
            "quality": "Best available",
            "sizeMb": readable_size(info.get("filesize") or info.get("filesize_approx")),
            "hasAudio": True,
            "recommended": True,
        },
        {
            "formatId": "bestaudio",
            "label": "Audio only",
            "extension": "m4a",
            "quality": "Original audio",
            "sizeMb": readable_size(info.get("filesize") or info.get("filesize_approx")),
            "hasAudio": True,
            "recommended": False,
        },
    ]
    seen = {"best", "bestaudio"}
    for item in info.get("formats", []):
        format_id = str(item.get("format_id") or "")
        if not format_id or format_id in seen or not item.get("vcodec") or not item.get("acodec"):
            continue
        height = item.get("height")
        label = f"{height}p" if height else str(item.get("format_note") or "Video")
        options.append(
            {
                "formatId": format_id,
                "label": f"{label} {str(item.get('ext') or 'video').upper()}",
                "extension": str(item.get("ext") or "mp4"),
                "quality": str(item.get("format_note") or label),
                "sizeMb": readable_size(item.get("filesize") or item.get("filesize_approx")),
                "hasAudio": bool(item.get("acodec") and item.get("acodec") != "none"),
                "recommended": False,
            }
        )
        seen.add(format_id)
        if len(options) >= 7:
            break
    return options


def analysis_payload(url: str, info: dict[str, Any]) -> dict[str, Any]:
    chapters = [
        {
            "title": str(chapter.get("title") or f"Chapter {index + 1}"),
            "start": float(chapter.get("start") or 0),
            "end": float(chapter.get("end") or 0),
        }
        for index, chapter in enumerate(info.get("chapters") or [])
    ]
    title = str(info.get("title") or "Untitled video")
    duration = int(info.get("duration") or 0)
    options = format_options(info)
    return {
        "sourceUrl": url,
        "videoId": str(info.get("id") or ""),
        "title": title,
        "channel": str(info.get("channel") or info.get("uploader") or "Unknown channel"),
        "durationSeconds": duration,
        "thumbnailUrl": str(info.get("thumbnail") or ""),
        "chapters": chapters,
        "formats": options,
        "smartRecommendation": "Smart best keeps the original picture and audio together, then lets PulseDrop optimize the container.",
    }


def file_label(download: sqlite3.Row) -> str:
    if download["mode"] == "audio":
        return "Audio / M4A"
    if download["chapter_mode"] == "split":
        return "Chapter bundle / MP4"
    return "Video / MP4"


def make_ydl_options(download: sqlite3.Row, folder: Path) -> dict[str, Any]:
    requested_format = download["format_id"]
    if download["mode"] == "audio":
        format_selector = "bestaudio/best"
        postprocessors = [{"key": "FFmpegExtractAudio", "preferredcodec": "m4a"}]
    elif requested_format == "best":
        format_selector = "bv*+ba/b"
        postprocessors = [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}]
    else:
        format_selector = requested_format
        postprocessors = [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}]
    folder.mkdir(parents=True, exist_ok=True)
    cancel_event = cancel_flags.setdefault(download["id"], threading.Event())

    def progress_hook(progress: dict[str, Any]) -> None:
        if cancel_event.is_set():
            raise yt_dlp.utils.DownloadCancelled()
        if progress.get("status") == "downloading":
            raw = progress.get("_percent_str", "0%").replace("%", "").strip()
            try:
                update_download(download["id"], progress=min(float(raw), 99.0), status="downloading")
            except ValueError:
                pass
        elif progress.get("status") == "finished":
            update_download(download["id"], progress=99.0, status="downloading")

    options: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": format_selector,
        "outtmpl": str(folder / "%(title).180B [%(id)s].%(ext)s"),
        "progress_hooks": [progress_hook],
        "postprocessors": postprocessors,
        "merge_output_format": "mp4",
        "restrictfilenames": True,
        "overwrites": True,
    }
    if download["chapter_mode"] == "split":
        options["split_chapters"] = True
    if download["include_subtitles"]:
        options.update(
            {
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": ["en", "en-US"],
                "subtitlesformat": "vtt",
            }
        )
    return options


def run_download(download_id: int) -> None:
    download = get_download(download_id)
    if not download:
        return
    cancel_flags[download_id] = threading.Event()
    folder = FILES_DIR / str(download_id)
    if folder.exists():
        shutil.rmtree(folder)
    try:
        update_download(download_id, status="downloading", progress=0, error=None)
        with yt_dlp.YoutubeDL(make_ydl_options(download, folder)) as ydl:
            ydl.download([download["source_url"]])
        if cancel_flags[download_id].is_set():
            update_download(download_id, status="canceled", progress=0)
            return
        files = sorted(path for path in folder.rglob("*") if path.is_file())
        media_files = [path for path in files if path.suffix.lower() not in {".vtt", ".srt"}]
        if not media_files:
            raise RuntimeError("The source did not produce a downloadable media file.")
        if download["chapter_mode"] == "split" and len(media_files) > 1:
            archive = folder / f"pulsedrop-{download_id}-chapters.zip"
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
                for path in media_files:
                    bundle.write(path, path.name)
            file_name = archive.name
        else:
            file_name = media_files[0].name
        update_download(
            download_id,
            status="completed",
            progress=100,
            file_name=file_name,
            file_url=f"/api/downloads/{download_id}/file",
            format_label=file_label(download),
            completed_at=utc_now(),
            error=None,
        )
    except yt_dlp.utils.DownloadCancelled:
        update_download(download_id, status="canceled", error=None)
    except Exception as exc:  # the UI receives a useful failure state
        update_download(download_id, status="failed", error=str(exc)[:400], progress=0)
    finally:
        cancel_flags.pop(download_id, None)


app = FastAPI(title="PulseDrop API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/summary")
def summary() -> dict[str, int | float]:
    with db_lock, connection() as conn:
        counts = conn.execute(
            """
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status IN ('queued', 'downloading') THEN 1 ELSE 0 END) AS active,
              COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_seconds ELSE 0 END), 0) AS minutes
            FROM downloads
            """
        ).fetchone()
        completed_bytes = 0
        for file_path in FILES_DIR.rglob("*"):
            if file_path.is_file():
                completed_bytes += file_path.stat().st_size
    return {
        "totalDownloads": int(counts["total"] or 0),
        "completedDownloads": int(counts["completed"] or 0),
        "activeDownloads": int(counts["active"] or 0),
        "storageUsedMb": round(completed_bytes / 1_000_000, 1),
        "minutesSaved": round(int(counts["minutes"] or 0) / 60),
        "streakDays": 0,
    }


@app.get("/api/insights")
def insights() -> dict[str, Any]:
    with db_lock, connection() as conn:
        format_rows = conn.execute(
            "SELECT mode, COUNT(*) AS total FROM downloads GROUP BY mode ORDER BY total DESC"
        ).fetchall()
        recent_rows = conn.execute(
            "SELECT * FROM downloads ORDER BY created_at DESC LIMIT 5"
        ).fetchall()
    total = sum(int(row["total"]) for row in format_rows) or 1
    format_mix = [
        {
            "label": "Audio" if row["mode"] == "audio" else "Video",
            "value": round(int(row["total"]) / total * 100),
            "detail": f"{int(row['total'])} saved",
        }
        for row in format_rows
    ]
    return {"formatMix": format_mix, "recentActivity": [row_to_download(row) for row in recent_rows]}


@app.post("/api/downloads/analyze")
def analyze(payload: AnalyzeInput) -> dict[str, Any]:
    url = ensure_youtube_url(payload.url)
    try:
        return analysis_payload(url, extract_metadata(url))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not inspect this video: {str(exc)[:220]}") from exc


@app.get("/api/downloads")
def list_downloads(
    search: str = Query(default=""),
    status: str = Query(default="all"),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    values: list[Any] = []
    if search.strip():
        clauses.append("(title LIKE ? OR channel LIKE ?)")
        term = f"%{search.strip()}%"
        values.extend([term, term])
    if status != "all":
        clauses.append("status = ?")
        values.append(status)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with db_lock, connection() as conn:
        rows = conn.execute(
            f"SELECT * FROM downloads {where} ORDER BY created_at DESC LIMIT ?",
            (*values, limit),
        ).fetchall()
    return [row_to_download(row) for row in rows]


@app.post("/api/downloads", status_code=201)
def create_download(payload: DownloadInput) -> dict[str, Any]:
    url = ensure_youtube_url(payload.url)
    created_at = utc_now()
    title = payload.title or "Queued YouTube video"
    with db_lock, connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO downloads
              (source_url, title, mode, chapter_mode, include_subtitles, format_id, format_label, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                url,
                title,
                payload.mode,
                payload.chapterMode,
                int(payload.includeSubtitles),
                payload.formatId,
                "Audio / M4A" if payload.mode == "audio" else "Smart best",
                created_at,
            ),
        )
        download_id = int(cursor.lastrowid)
        conn.commit()
    executor.submit(run_download, download_id)
    row = get_download(download_id)
    assert row is not None
    return row_to_download(row)


@app.get("/api/downloads/{download_id}")
def get_download_route(download_id: int) -> dict[str, Any]:
    row = get_download(download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Download not found.")
    return row_to_download(row)


@app.post("/api/downloads/{download_id}/start", status_code=202)
def start_download(download_id: int) -> dict[str, Any]:
    row = get_download(download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Download not found.")
    if row["status"] == "downloading":
        return row_to_download(row)
    executor.submit(run_download, download_id)
    update_download(download_id, status="queued", progress=0, error=None)
    refreshed = get_download(download_id)
    assert refreshed is not None
    return row_to_download(refreshed)


@app.post("/api/downloads/{download_id}/cancel")
def cancel_download(download_id: int) -> dict[str, Any]:
    row = get_download(download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Download not found.")
    event = cancel_flags.get(download_id)
    if event:
        event.set()
    else:
        update_download(download_id, status="canceled")
    refreshed = get_download(download_id)
    assert refreshed is not None
    return row_to_download(refreshed)


@app.delete("/api/downloads/{download_id}", status_code=204)
def delete_download(download_id: int) -> None:
    row = get_download(download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Download not found.")
    event = cancel_flags.get(download_id)
    if event:
        event.set()
    shutil.rmtree(FILES_DIR / str(download_id), ignore_errors=True)
    with db_lock, connection() as conn:
        conn.execute("DELETE FROM downloads WHERE id = ?", (download_id,))
        conn.commit()


@app.get("/api/downloads/{download_id}/file", response_model=None)
def download_file(download_id: int) -> Any:
    row = get_download(download_id)
    if not row or row["status"] != "completed":
        raise HTTPException(status_code=404, detail="This download is not ready yet.")
    folder = FILES_DIR / str(download_id)
    file_path = folder / str(row["file_name"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="The saved file is no longer available.")
    media_type = "application/zip" if file_path.suffix == ".zip" else "application/octet-stream"
    return FileResponse(file_path, media_type=media_type, filename=file_path.name)


@app.get("/api/presets")
def list_presets() -> list[dict[str, Any]]:
    with db_lock, connection() as conn:
        rows = conn.execute("SELECT * FROM presets ORDER BY created_at DESC").fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "formatId": row["format_id"],
            "mode": row["mode"],
            "chapterMode": row["chapter_mode"],
            "includeSubtitles": bool(row["include_subtitles"]),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


@app.post("/api/presets", status_code=201)
def create_preset(payload: PresetInput) -> dict[str, Any]:
    with db_lock, connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO presets (name, format_id, mode, chapter_mode, include_subtitles, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.name.strip(),
                payload.formatId,
                payload.mode,
                payload.chapterMode,
                int(payload.includeSubtitles),
                utc_now(),
            ),
        )
        preset_id = int(cursor.lastrowid)
        conn.commit()
    return {
        "id": preset_id,
        "name": payload.name.strip(),
        "formatId": payload.formatId,
        "mode": payload.mode,
        "chapterMode": payload.chapterMode,
        "includeSubtitles": payload.includeSubtitles,
        "createdAt": utc_now(),
    }


@app.delete("/api/presets/{preset_id}", status_code=204)
def delete_preset(preset_id: int) -> None:
    with db_lock, connection() as conn:
        cursor = conn.execute("DELETE FROM presets WHERE id = ?", (preset_id,))
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Preset not found.")
