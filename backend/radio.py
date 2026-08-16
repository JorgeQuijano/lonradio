"""24/7 auto-DJ radio.

A background thread renders tracks endlessly (random-walk between moods),
encodes each to MP3 with ffmpeg, and publishes complete-track chunks to a
shared buffer. HTTP listeners stream the buffer: each listener joins at the
start of the currently playing track.

API (in app.py):
  GET /api/radio        -> endless audio/mpeg stream
  GET /api/radio/now    -> {current, history, listeners, uptime_s, tracks_played}
"""
from __future__ import annotations

import subprocess
import threading
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from engine import TrackParams, render
from engine.params import (BASS_STYLES, DRUM_STYLES, MELODY_STYLES, PRESETS,
                           PROGRESSIONS)

BASE = Path(__file__).resolve().parent
RADIO_DIR = BASE / "tracks" / "_radio"
HLS_DIR = RADIO_DIR / "hls"
RADIO_DIR.mkdir(parents=True, exist_ok=True)
HLS_DIR.mkdir(parents=True, exist_ok=True)

GAP_S = 0.6                      # silence between tracks — the radio "breath"
BUFFER_BYTES = 6_000_000         # ~6 min of history kept for late joiners
HISTORY_LEN = 12
HLS_WINDOW = 12                  # segments kept in the playlist / on disk


@dataclass
class _Chunk:
    data: bytes
    meta: dict
    seq: int


class RadioDJ:
    def __init__(self) -> None:
        self._chunks: List[_Chunk] = []
        self._bytes = 0
        self._current_idx: Optional[int] = None
        self._current: Optional[dict] = None
        self._history: List[dict] = []
        self._cond = threading.Condition()
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._started = time.time()
        self._played = 0
        self._listeners = 0
        self._seq = 0
        self._params = TrackParams.from_dict(PRESETS["Rainy Study"])

    # ------------------------------------------------------------------ api
    def start(self) -> None:
        with self._lock:
            if self._thread and self._thread.is_alive():
                return
            self._stop.clear()
            self._thread = threading.Thread(target=self._run, name="lonradio-dj", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        with self._cond:
            self._cond.notify_all()

    def now(self) -> dict:
        with self._lock:
            return {
                "current": self._current,
                "history": list(self._history),
                "listeners": self._listeners,
                "uptime_s": int(time.time() - self._started),
                "tracks_played": self._played,
                "upcoming": self._upcoming(3),
            }

    def _upcoming(self, n: int) -> List[dict]:
        """Preview of the next tracks — names are deterministic from seeds,
        so no rendering is needed to know what's coming."""
        out: List[dict] = []
        cur = self._params
        for _ in range(n):
            out.append({
                "name": cur.track_name(),
                "seed": cur.seed,
                "key": f"{cur.key} {cur.mode}",
                "bpm": cur.bpm,
                "bars": cur.bars,
            })
            cur = self._next_params(cur)
        return out

    def stream(self):
        """Infinite byte generator for one HTTP listener."""
        with self._lock:
            self._listeners += 1
        try:
            yield from self._read()
        finally:
            with self._lock:
                self._listeners -= 1

    # ------------------------------------------------------------- internals
    def _run(self) -> None:
        while not self._stop.is_set():
            t0 = time.time()
            try:
                r = render(self._params, RADIO_DIR)
                mp3 = self._encode_mp3(r.wav_path)
                seq = self._seq
                self._seq += 1
                self._encode_ts(r.wav_path, seq)
                self._rotate_hls(seq)
                meta = {
                    "name": r.name,
                    "seed": self._params.seed,
                    "key": f"{self._params.key} {self._params.mode}",
                    "bpm": self._params.bpm,
                    "bars": self._params.bars,
                    "chords": r.chords,
                    "sections": r.sections,
                    "duration_s": round(r.duration_s, 2),
                    "rendered_ms": r.took_ms,
                    "started_at": time.time(),
                }
                self._publish(mp3, meta, seq)
                self._params = self._next_params(self._params)
                # real-time pacing: the engine renders ~6x faster than
                # playback, so wait out the remainder so "on air" metadata
                # always matches what listeners actually hear.
                wait = (t0 + r.duration_s + GAP_S) - time.time()
                if wait > 0:
                    self._stop.wait(wait)
            except Exception as e:  # keep the radio alive no matter what
                print(f"[radio] error: {e}", flush=True)
                time.sleep(2)

    def _publish(self, data: bytes, meta: dict, seq: int) -> None:
        with self._cond:
            self._chunks.append(_Chunk(data, meta, seq))
            self._bytes += len(data)
            self._current_idx = len(self._chunks) - 1
            self._current = meta
            self._history.insert(0, meta)
            del self._history[HISTORY_LEN:]
            while self._bytes > BUFFER_BYTES and len(self._chunks) > 3:
                popped = self._chunks.pop(0)
                self._bytes -= len(popped.data)
                if self._current_idx is not None:
                    self._current_idx -= 1
            self._played += 1
            self._cond.notify_all()

    def _read(self):
        """Iterate chunks from the current track's start, waiting for new
        ones. Never yields while holding the condition lock."""
        with self._cond:
            if not self._chunks:
                self._cond.wait(timeout=30)
            if not self._chunks:
                return
            i = max(0, min(self._current_idx or 0, len(self._chunks) - 1))
        while not self._stop.is_set():
            with self._cond:
                if i < len(self._chunks):
                    data = self._chunks[i].data
                    i += 1
                elif self._stop.is_set():
                    return
                else:
                    data = None
                    self._cond.wait(timeout=5)
            if data is not None:
                yield data

    # ---------------------------------------------------------------- tools
    @staticmethod
    def _pad_wav(wav_path: Path) -> Path:
        """Append a breath of silence; returns a temp padded WAV path."""
        with wave.open(str(wav_path)) as w:
            n = w.getnframes()
            sr = w.getframerate()
            ch = w.getnchannels()
            sw = w.getsampwidth()
            data = w.readframes(n)
        tmp = wav_path.with_suffix(".padded.wav")
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(ch)
            w.setsampwidth(sw)
            w.setframerate(sr)
            w.writeframes(data + bytes(int(sr * ch * sw * GAP_S)))
        return tmp

    @classmethod
    def _encode_mp3(cls, wav_path: Path) -> bytes:
        """Raw MP3 frames (for the plain /api/radio stream)."""
        tmp = cls._pad_wav(wav_path)
        try:
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(tmp),
                "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                "-write_xing", "0", "-id3v2_version", "0", "-map_metadata", "-1",
                "-f", "mp3", "-",
            ]
            out = subprocess.run(cmd, capture_output=True, check=True).stdout
        finally:
            tmp.unlink(missing_ok=True)
        if not out:
            raise RuntimeError("ffmpeg produced empty mp3")
        return out

    @classmethod
    def _encode_ts(cls, wav_path: Path, seq: int) -> Path:
        """MPEG-TS segment with AAC audio (for HLS)."""
        tmp = cls._pad_wav(wav_path)
        dest = HLS_DIR / f"seg-{seq}.ts"
        try:
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(tmp),
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                "-f", "mpegts", str(dest),
            ]
            subprocess.run(cmd, capture_output=True, check=True)
        finally:
            tmp.unlink(missing_ok=True)
        if not dest.exists() or dest.stat().st_size == 0:
            raise RuntimeError("ffmpeg produced empty ts segment")
        return dest

    @staticmethod
    def _rotate_hls(seq: int) -> None:
        """Keep only the last HLS_WINDOW segments on disk."""
        for f in HLS_DIR.glob("seg-*.ts"):
            try:
                n = int(f.stem.split("-")[1])
            except (IndexError, ValueError):
                continue
            if n < seq - HLS_WINDOW + 1:
                f.unlink(missing_ok=True)

    def hls_playlist(self) -> str:
        """Live m3u8 over the current buffer window (no ENDLIST = live)."""
        with self._cond:
            chunks = list(self._chunks)
        if not chunks:
            return "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:60\n#EXT-X-MEDIA-SEQUENCE:0\n"
        lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
        max_dur = max(c.meta["duration_s"] for c in chunks) + GAP_S
        lines.append(f"#EXT-X-TARGETDURATION:{int(max_dur) + 1}")
        lines.append(f"#EXT-X-MEDIA-SEQUENCE:{chunks[0].seq}")
        for c in chunks:
            dur = c.meta["duration_s"] + GAP_S
            lines.append(f"#EXTINF:{dur:.3f},")
            lines.append(f"seg-{c.seq}.ts")
        return "\n".join(lines) + "\n"

    @staticmethod
    def _next_params(prev: TrackParams) -> TrackParams:
        """Random walk between tracks: mood blocks for harmony, slow FX drift.
        Tracks are 3-7 minutes, built from 4-bar sections (the arrangement
        engine changes the feel every 30-45s inside each track)."""
        rng = prev.rng()
        d = prev.to_dict()
        d["seed"] = (prev.seed + 1) % (2**31 - 1)

        if rng.random() < 0.18:  # new mood block (key/progression change rarely)
            d["progression"] = rng.choice(PROGRESSIONS)
            d["key"] = rng.choice(["C", "D", "E", "F", "G", "A", "Bb", "Eb"])
            d["mode"] = rng.choice(["minor", "minor", "major"])
            d["voicing"] = rng.choice(["spread", "spread", "drop2"])
            d["chord_ext"] = rng.choice(["9", "9", "7", "add9"])
        d["bpm"] = min(96, max(64, prev.bpm + rng.choice([-6, -4, -2, 0, 0, 2, 4, 6])))
        # 3-7 minutes, rounded to 4-bar blocks
        target_s = rng.uniform(180, 420)
        d["bars"] = min(72, max(24, round(target_s * d["bpm"] / 240 / 4) * 4))
        if rng.random() < 0.30:
            d["bass_style"] = rng.choice(BASS_STYLES)
        if rng.random() < 0.25:
            d["drums"] = rng.choice(DRUM_STYLES)
        if rng.random() < 0.30:
            d["melody"] = rng.choice(MELODY_STYLES)
        for f in ("ep_tone", "fx_crackle", "fx_wobble", "fx_lowpass",
                  "fx_saturation", "fx_reverb", "fx_pump"):
            d[f] = min(1.0, max(0.0, round(getattr(prev, f) + rng.uniform(-0.08, 0.08), 2)))
        d["swing"] = min(0.45, max(0.10, round(prev.swing + rng.uniform(-0.05, 0.05), 2)))
        return TrackParams.from_dict(d)
