"""Render pipeline: compose -> synthesize stems -> sidechain pump ->
vinyl bed -> master chain -> WAV + MIDI + JSON sidecar."""
from __future__ import annotations

import dataclasses
import json
import time
from pathlib import Path
from typing import List

import numpy as np

from . import fx, synths, theory
from .params import TrackParams


@dataclasses.dataclass
class RenderResult:
    wav_path: Path
    midi_path: Path
    json_path: Path
    name: str
    duration_s: float
    chords: List[str]
    sections: List[dict]
    took_ms: int


def render(p: TrackParams, out_dir: Path) -> RenderResult:
    t0 = time.perf_counter()
    rng = p.rng()
    comp = theory.compose(p)
    duration_s = comp.duration_sec
    sr = synths.SR

    # ---- stems ----
    ep = synths.render_ep(comp.notes_ep, p.bpm, p.ep_tone, rng, duration_s, sr)
    bass = synths.render_bass(comp.notes_bass, p.bpm, rng, duration_s, sr)
    mel = synths.render_ep(comp.melody, p.bpm, p.ep_tone * 0.85, rng, duration_s, sr) * 1.15
    drums = synths.render_drums(comp.drums, p.bpm, rng, duration_s, sr)
    crackle = synths.render_crackle(duration_s, p.fx_crackle, rng, sr)

    # pad stems to a common length before mixing
    n_total = max(len(s) for s in (ep, bass, mel, drums, crackle))

    def _pad(s: np.ndarray, n: int) -> np.ndarray:
        if len(s) < n:
            return np.vstack([s, np.zeros((n - len(s), s.shape[1]))])
        return s

    ep, bass, mel, drums, crackle = (_pad(s, n_total) for s in (ep, bass, mel, drums, crackle))

    # ---- sidechain pump: duck everything but the drums ----
    kick_times = [d.start * 60.0 / p.bpm for d in comp.drums if d.kind == "kick"]
    ducked = synths.sidechain_pump(ep + bass + mel, kick_times, p.bpm, p.fx_pump, sr)

    # ---- vinyl bed ----
    mix = ducked + drums + crackle
    # ---- master chain ----
    mix = fx.master(mix, p, sr)

    # ---- write artifacts ----
    out_dir.mkdir(parents=True, exist_ok=True)
    wav_path = out_dir / "audio.wav"
    midi_path = out_dir / "track.mid"
    json_path = out_dir / "track.json"
    fx.write_wav(mix, wav_path, sr)
    theory.export_midi(comp, str(midi_path))

    chord_names = [name for (_s, _d, name) in comp.chords]
    beat_s = 60.0 / p.bpm
    sections = [
        {
            "name": s.name,
            "start_bar": s.start_bar,
            "bars": s.bars,
            "start_s": round(s.start_bar * 4 * beat_s, 1),
            "dur_s": round(s.bars * 4 * beat_s, 1),
            "drums": s.drums,
            "bass": s.bass,
            "melody": s.melody,
        }
        for s in comp.sections
    ]
    payload = {
        "name": p.track_name(),
        "describe": p.describe(),
        "params": p.to_dict(),
        "chords": chord_names,
        "key": f"{p.key} {p.mode}",
        "bpm": p.bpm,
        "bars": p.bars,
        "duration_s": round(duration_s, 2),
        "sections": sections,
    }
    json_path.write_text(json.dumps(payload, indent=2))

    took_ms = int((time.perf_counter() - t0) * 1000)
    return RenderResult(
        wav_path=wav_path, midi_path=midi_path, json_path=json_path,
        name=p.track_name(), duration_s=duration_s, chords=chord_names,
        sections=sections, took_ms=took_ms,
    )
