"""Mastering chain — pedalboard (Spotify) when available, numpy fallbacks."""
from __future__ import annotations

import numpy as np

from . import synths

try:  # pedalboard is optional but preferred
    from pedalboard import Compressor, Limiter, LowpassFilter, Reverb
    HAVE_PEDALBOARD = True
except Exception:  # pragma: no cover
    HAVE_PEDALBOARD = False


def master(x: np.ndarray, p, sr: int = synths.SR) -> np.ndarray:
    """Full lo-fi master chain: wobble -> saturation -> lowpass -> reverb ->
    compression -> limiting -> normalize. `p` is a TrackParams-like object."""
    rng = p.rng()

    # 1. tape wobble (pitch warble)
    x = synths.apply_wobble(x, p.fx_wobble, rng, sr)

    # 2. tape saturation (soft clip)
    x = synths.tanh_saturate(x, p.fx_saturation)

    # 3. lowpass — the lo-fi blanket (3k..12k depending on dial)
    cutoff = 3000 + 9000 * p.fx_lowpass
    if HAVE_PEDALBOARD:
        x = LowpassFilter(cutoff_frequency_hz=cutoff)(x, sr)
    else:
        x = synths.one_pole_lowpass(x, cutoff, sr)
        x = synths.one_pole_lowpass(x, cutoff, sr)

    # 4. room reverb
    if p.fx_reverb > 0.01:
        if HAVE_PEDALBOARD:
            x = Reverb(room_size=0.35, damping=0.5, wet_level=p.fx_reverb * 0.55,
                       dry_level=1.0)(x, sr)
        else:
            x = synths.schroeder_reverb(x, p.fx_reverb, sr)

    # 5. glue + limiting
    if HAVE_PEDALBOARD:
        x = Compressor(threshold_db=-18.0, ratio=3.0, attack_ms=4.0,
                       release_ms=140.0)(x, sr)
        x = Limiter(threshold_db=-1.5, release_ms=90.0)(x, sr)

    # 6. normalize + safety clip
    peak = np.max(np.abs(x)) or 1.0
    x = x * (0.92 / peak)
    return np.clip(x, -1.0, 1.0)


def write_wav(x: np.ndarray, path, sr: int = synths.SR) -> None:
    import wave

    path = str(path)
    data = (x * 32767.0).astype(np.int16)
    interleaved = data.reshape(-1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(interleaved.tobytes())
