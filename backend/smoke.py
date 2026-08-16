"""CLI smoke test — render a track and print diagnostics."""
import sys, wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np

from engine import PRESETS, TrackParams, render


def analyze(path: str, music_end_s: float):
    with wave.open(path) as w:
        n = w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, 2) / 32767.0
    sr = w.getframerate()
    dur = n / sr

    def rms(a, b):
        s = x[int(a * sr):int(b * sr)]
        return float(np.sqrt(np.mean(s ** 2))) if len(s) else 0.0

    stats = {
        "dur_s": round(dur, 2),
        "sr": sr,
        "rms": float(np.sqrt(np.mean(x ** 2))),
        "peak": float(np.max(np.abs(x))),
        "rms_music": rms(0.5, music_end_s - 0.5),
        "rms_last_chord": rms(music_end_s - 2.0, music_end_s),
        "rms_tail": rms(music_end_s, dur),
    }
    # spectral: bass energy share + stereo width
    mono = x.mean(axis=1)
    spec = np.abs(np.fft.rfft(mono))
    freqs = np.fft.rfftfreq(len(mono), 1 / sr)
    low = spec[(freqs >= 30) & (freqs <= 250)].sum()
    total = spec[(freqs >= 30) & (freqs <= 12000)].sum() + 1e-12
    stats["bass_share"] = float(low / total)
    corr = np.corrcoef(x[:, 0], x[:, 1])[0, 1]
    stats["lr_corr"] = round(float(corr), 3)
    return stats


def main() -> None:
    p = TrackParams.from_dict(PRESETS["Rainy Study"])
    out = Path("/tmp/lonradio_smoke")
    r = render(p, out)
    print(f"name:      {r.name}")
    print(f"chords:    {' '.join(r.chords)}")
    print(f"duration:  {r.duration_s:.2f}s  render: {r.took_ms}ms")
    for f in (r.wav_path, r.midi_path, r.json_path):
        print(f"  {f.name}: {f.stat().st_size} bytes")

    s = analyze(str(r.wav_path), r.duration_s)
    for k, v in s.items():
        print(f"  {k}: {v}")

    # seeded reproducibility: identical bytes for identical params
    r2 = render(p, out)
    same = r.wav_path.read_bytes() == r2.wav_path.read_bytes()
    print(f"  deterministic: {same}")

    # arrangement: long tracks must have multiple distinct sections
    long = TrackParams(bpm=80, bars=48, seed=7)
    rl = render(long, out)
    names = [s["name"] for s in rl.sections]
    drums = {s["drums"] for s in rl.sections}
    print(f"  long track: {rl.duration_s:.0f}s sections={names} drums={drums}")
    sections_ok = len(rl.sections) >= 4 and len(drums) >= 2

    ok = (
        s["rms_music"] > 0.01 and s["rms_last_chord"] > 0.005
        and s["bass_share"] > 0.15 and s["lr_corr"] < 0.995
        and abs(s["dur_s"] - r.duration_s) < 3.0 and same  # +2s decay tail
        and sections_ok
    )
    print("SMOKE:", "PASS" if ok else "FAIL")


if __name__ == "__main__":
    main()
