"""Track parameters — the full contract between the UI and the engine."""
from __future__ import annotations

import dataclasses
import random
from typing import Any, Dict, List

# ---- option vocabularies (used by the UI to render controls) ----
KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
MODES = ["minor", "major"]
PROGRESSIONS = ["classic", "soulful", "jazzy", "dreamy"]
CHORD_EXTS = ["7", "9", "add9"]
VOICINGS = ["spread", "drop2", "close"]
BASS_STYLES = ["root-eighths", "walk", "octave-bounce", "syncopated", "pedal"]
DRUM_STYLES = ["boom-bap", "brushed", "four-floor", "none"]
MELODY_STYLES = ["sparse", "flowing", "none"]
THEMES = ["dark", "light", "midnight", "cassette", "synthwave"]  # frontend-only


@dataclasses.dataclass
class TrackParams:
    key: str = "A"
    mode: str = "minor"
    bpm: int = 78
    bars: int = 8
    progression: str = "classic"
    chord_ext: str = "9"
    voicing: str = "spread"
    bass_style: str = "root-eighths"
    drums: str = "boom-bap"
    swing: float = 0.28
    melody: str = "sparse"
    ep_tone: float = 0.45       # 0 dull tine -> 1 bright tine
    fx_crackle: float = 0.35    # vinyl crackle amount
    fx_wobble: float = 0.25     # tape wobble depth
    fx_lowpass: float = 0.5     # 0 = dark (3k) -> 1 = open (12k)
    fx_saturation: float = 0.35 # tape drive
    fx_reverb: float = 0.3      # room reverb mix
    fx_pump: float = 0.4        # sidechain ducking depth
    seed: int = 0

    # ---------------- validation ----------------
    def validate(self) -> List[str]:
        errs: List[str] = []
        if self.key not in KEYS:
            errs.append(f"key must be one of {KEYS}")
        if self.mode not in MODES:
            errs.append(f"mode must be one of {MODES}")
        if not (40 <= self.bpm <= 140):
            errs.append("bpm must be 40-140")
        if not (2 <= self.bars <= 72):
            errs.append("bars must be 2-72")
        if self.progression not in PROGRESSIONS:
            errs.append(f"progression must be one of {PROGRESSIONS}")
        if self.chord_ext not in CHORD_EXTS:
            errs.append(f"chord_ext must be one of {CHORD_EXTS}")
        if self.voicing not in VOICINGS:
            errs.append(f"voicing must be one of {VOICINGS}")
        if self.bass_style not in BASS_STYLES:
            errs.append(f"bass_style must be one of {BASS_STYLES}")
        if self.drums not in DRUM_STYLES:
            errs.append(f"drums must be one of {DRUM_STYLES}")
        if self.melody not in MELODY_STYLES:
            errs.append(f"melody must be one of {MELODY_STYLES}")
        for f in ("swing", "ep_tone", "fx_crackle", "fx_wobble", "fx_lowpass",
                  "fx_saturation", "fx_reverb", "fx_pump"):
            if not (0.0 <= getattr(self, f) <= 1.0):
                errs.append(f"{f} must be 0-1")
        if not (0 <= self.seed <= 2**32 - 1):
            errs.append("seed must be a uint32")
        return errs

    def rng(self) -> random.Random:
        return random.Random(self.seed)

    # ---------------- serialization ----------------
    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TrackParams":
        known = {f.name for f in dataclasses.fields(cls)}
        clean = {k: v for k, v in (d or {}).items() if k in known}
        return cls(**clean)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)

    def track_name(self) -> str:
        """Deterministic human name from the seed — 'Rainy Window No. 42'."""
        prefixes = [
            "Rainy Window", "Midnight Drive", "Coffee Stain", "Neon Rain",
            "Cigarette Break", "VHS Sunrise", "City Bus", "Potted Plant",
            "Phone Booth", "Moth & Lamp", "Basement Tapes", "Late Study",
            "Windowsill", "Tape Deck", "Fire Escape", "Corner Store",
        ]
        rng = self.rng()
        return f"{rng.choice(prefixes)} No. {self.seed % 997}"

    def describe(self) -> str:
        return (f"{self.key} {self.mode} · {self.bpm} BPM · {self.bars} bars · "
                f"{self.progression}/{self.chord_ext} · bass: {self.bass_style} · "
                f"drums: {self.drums} · melody: {self.melody} · seed {self.seed}")


# ---------------- presets (one-click moods) ----------------
PRESETS: Dict[str, Dict[str, Any]] = {
    "Rainy Study": {"key": "A", "mode": "minor", "bpm": 76, "bars": 8,
                    "progression": "classic", "chord_ext": "9", "voicing": "spread",
                    "bass_style": "root-eighths", "drums": "boom-bap", "swing": 0.3,
                    "melody": "sparse", "ep_tone": 0.4, "fx_crackle": 0.45,
                    "fx_wobble": 0.3, "fx_lowpass": 0.45, "fx_saturation": 0.35,
                    "fx_reverb": 0.35, "fx_pump": 0.45, "seed": 42},
    "Midnight Drive": {"key": "E", "mode": "minor", "bpm": 88, "bars": 8,
                       "progression": "jazzy", "chord_ext": "7", "voicing": "drop2",
                       "bass_style": "walk", "drums": "four-floor", "swing": 0.2,
                       "melody": "flowing", "ep_tone": 0.6, "fx_crackle": 0.25,
                       "fx_wobble": 0.2, "fx_lowpass": 0.6, "fx_saturation": 0.45,
                       "fx_reverb": 0.3, "fx_pump": 0.35, "seed": 1337},
    "Coffee Stain": {"key": "F", "mode": "minor", "bpm": 72, "bars": 8,
                     "progression": "soulful", "chord_ext": "9", "voicing": "spread",
                     "bass_style": "syncopated", "drums": "brushed", "swing": 0.35,
                     "melody": "none", "ep_tone": 0.35, "fx_crackle": 0.55,
                     "fx_wobble": 0.4, "fx_lowpass": 0.35, "fx_saturation": 0.3,
                     "fx_reverb": 0.4, "fx_pump": 0.4, "seed": 7},
    "VHS Sunrise": {"key": "C", "mode": "major", "bpm": 82, "bars": 8,
                    "progression": "dreamy", "chord_ext": "add9", "voicing": "spread",
                    "bass_style": "octave-bounce", "drums": "boom-bap", "swing": 0.25,
                    "melody": "flowing", "ep_tone": 0.5, "fx_crackle": 0.2,
                    "fx_wobble": 0.15, "fx_lowpass": 0.65, "fx_saturation": 0.2,
                    "fx_reverb": 0.3, "fx_pump": 0.3, "seed": 99},
}
