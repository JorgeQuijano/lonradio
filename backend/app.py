"""lonradio API — generate lo-fi tracks from parameter JSON."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from engine import PRESETS, TrackParams, render
from engine.params import (BASS_STYLES, CHORD_EXTS, DRUM_STYLES, KEYS, MELODY_STYLES,
                           MODES, PROGRESSIONS, VOICINGS)

BASE = Path(__file__).resolve().parent
TRACKS = BASE / "tracks"
TRACKS.mkdir(exist_ok=True)

app = FastAPI(title="lonradio engine", version="0.1.0")
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


# serve built frontend when present (npm run build first)
_dist = BASE.parent / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")
