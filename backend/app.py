"""lonradio API — generate lo-fi tracks from parameter JSON + 24/7 radio."""
from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from engine import PRESETS, TrackParams, render
from engine.params import (BASS_STYLES, CHORD_EXTS, DRUM_STYLES, KEYS, MELODY_STYLES,
                           MODES, PROGRESSIONS, VOICINGS)
from radio import RadioDJ

BASE = Path(__file__).resolve().parent
TRACKS = BASE / "tracks"
TRACKS.mkdir(exist_ok=True)

# 24/7 auto-DJ — set LONRADIO_RADIO=0 to disable
_RADIO_ENABLED = os.environ.get("LONRADIO_RADIO", "1") != "0"
dj = RadioDJ()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if _RADIO_ENABLED:
        dj.start()
    yield
    dj.stop()


app = FastAPI(title="lonradio engine", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only; tighten before prod deploy
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "engine": "lonradio"}


@app.get("/api/options")
def options() -> dict:
    """Vocabularies the UI uses to render its controls."""
    return {
        "keys": KEYS,
        "modes": MODES,
        "progressions": PROGRESSIONS,
        "chord_exts": CHORD_EXTS,
        "voicings": VOICINGS,
        "bass_styles": BASS_STYLES,
        "drums": DRUM_STYLES,
        "melodies": MELODY_STYLES,
        "presets": list(PRESETS),
    }


@app.get("/api/presets")
def presets() -> dict:
    return PRESETS


@app.post("/api/generate")
def generate(payload: dict) -> dict:
    p = TrackParams.from_dict(payload or {})
    errs = p.validate()
    if errs:
        raise HTTPException(status_code=422, detail={"errors": errs})
    track_id = uuid.uuid4().hex[:10]
    r = render(p, TRACKS / track_id)
    return {
        "id": track_id,
        "name": r.name,
        "wav": f"/api/tracks/{track_id}/audio.wav",
        "midi": f"/api/tracks/{track_id}/track.mid",
        "chords": r.chords,
        "duration_s": round(r.duration_s, 2),
        "bpm": p.bpm,
        "took_ms": r.took_ms,
        "params": p.to_dict(),
    }


def _track_dir(track_id: str) -> Path:
    d = (TRACKS / track_id).resolve()
    if not d.is_dir() or TRACKS.resolve() not in d.parents:
        raise HTTPException(status_code=404, detail="track not found")
    return d


@app.get("/api/tracks/{track_id}/audio.wav")
def track_audio(track_id: str) -> FileResponse:
    f = _track_dir(track_id) / "audio.wav"
    if not f.exists():
        raise HTTPException(status_code=404, detail="track not found")
    return FileResponse(f, media_type="audio/wav")


@app.get("/api/tracks/{track_id}/track.mid")
def track_midi(track_id: str) -> FileResponse:
    f = _track_dir(track_id) / "track.mid"
    if not f.exists():
        raise HTTPException(status_code=404, detail="track not found")
    return FileResponse(f, media_type="audio/midi")


@app.get("/api/tracks/{track_id}/info")
def track_info(track_id: str) -> JSONResponse:
    import json

    f = _track_dir(track_id) / "track.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="track not found")
    return JSONResponse(json.loads(f.read_text()))


# ---------------------------------------------------------------------------
# 24/7 radio
# ---------------------------------------------------------------------------

@app.get("/api/radio")
def radio_stream() -> StreamingResponse:
    """Endless MP3 stream — join at the start of the current track."""
    if not _RADIO_ENABLED:
        raise HTTPException(status_code=503, detail="radio disabled (LONRADIO_RADIO=0)")
    return StreamingResponse(
        dj.stream(),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache, no-store", "Connection": "keep-alive"},
    )


@app.get("/api/radio/now")
def radio_now() -> dict:
    return dj.now()


@app.get("/api/radio/status")
def radio_status() -> dict:
    return {
        "enabled": _RADIO_ENABLED,
        "listeners": dj.now()["listeners"],
        "tracks_played": dj.now()["tracks_played"],
        "uptime_s": dj.now()["uptime_s"],
    }


# serve built frontend when present (npm run build first)
_dist = BASE.parent / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        """SPA fallback — /radio and friends get index.html; real files served."""
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="not found")
        candidate = _dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
