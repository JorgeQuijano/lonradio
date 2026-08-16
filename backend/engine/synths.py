"""Synthesis layer — every sound is generated from math, no samples, no
soundfonts. Rhodes-style electric piano, electric bass, synthesized drums,
vinyl crackle and tape wobble, all seeded-reproducible.
"""
from __future__ import annotations

import random
from typing import List, Tuple

import numpy as np

SR = 44100


def midi_to_freq(m: int) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def _fade(x: np.ndarray, attack: float, release: float, sr: int = SR) -> np.ndarray:
    n_a, n_r = int(attack * sr), int(release * sr)
    n_a = min(n_a, len(x) // 2)
    n_r = min(n_r, len(x) // 2)
    if n_a > 0:
        x[:n_a] *= np.linspace(0.0, 1.0, n_a)
    if n_r > 0:
        x[-n_r:] *= np.linspace(1.0, 0.0, n_r)
    return x


# ---------------------------------------------------------------------------
# Rhodes-style electric piano
# ---------------------------------------------------------------------------

def rhodes_note(freq: float, dur_s: float, vel: float, tone: float,
                detune_cents: float = 0.0, rng: random.Random | None = None,
                sr: int = SR) -> np.ndarray:
    """Additive EP: inharmonic partials + tine ping + slight detune.

    tone: 0 = dull felt, 1 = bright tine. vel: 0..1.
    """
    rng = rng or random.Random(0)
    n = int(dur_s * sr) + sr // 4  # +250ms tail
    t = np.arange(n) / sr
    total = np.zeros(n)

    # partial ratios & weights (Rhodes-ish inharmonicity)
    ratios = [1.0, 2.0, 3.0, 4.0, 5.0]
    amps = [1.0, 0.62, 0.36, 0.24, 0.13]
    bright = 0.35 + 0.65 * tone
    decay_base = 1.35 - 0.55 * tone  # brighter tines ring shorter

    f = freq * (1 + detune_cents / 1200.0)
    for r, a in zip(ratios, amps):
        fr = f * r
        tau = decay_base / (r ** 1.15)
        env = np.exp(-t / tau)
        phase = rng.uniform(0, 2 * np.pi)
        total += a * env * np.sin(2 * np.pi * fr * t + phase)

    # tine ping: high inharmonic partial, very fast decay
    ping_f = f * 14.6
    env = np.exp(-t / 0.028)
    total += (0.5 * bright) * env * np.sin(2 * np.pi * ping_f * t + rng.uniform(0, 2 * np.pi))

    # felt thump: low noise burst at attack
    n_click = min(int(0.006 * sr), n)
    nprng = np.random.default_rng(rng.randint(0, 2**32 - 1))
    click = nprng.uniform(-1, 1, n_click) * np.exp(-np.arange(n_click) / (0.0022 * sr))
    total[:n_click] += 0.25 * (1 - bright * 0.5) * click

    amp = (vel ** 1.5) * 0.30
    return _fade(total * amp, 0.004, 0.05)


def render_ep(events, bpm: float, tone: float, rng: random.Random,
              duration_s: float, sr: int = SR) -> np.ndarray:
    """Render EP chord events to a stereo stem. L/R get opposite detune."""
    n = int((duration_s + 2.0) * sr)
    left = np.zeros(n)
    right = np.zeros(n)
    for e in events:
        start = max(0, int(e.start * 60.0 / bpm * sr))
        dur_s = e.dur * 60.0 / bpm
        vel = e.vel / 127.0
        for m in (e.tones or [e.midi]):
            f = midi_to_freq(m)
            L = rhodes_note(f, dur_s, vel, tone, -2.8, rng)
            R = rhodes_note(f, dur_s, vel, tone, +2.8, rng)
            end = min(start + len(L), n)
            left[start:end] += L[: end - start]
            right[start:end] += R[: end - start]
        # root doubling adds warmth (mono-ish, less detune)
        if e.root:
            f = midi_to_freq(e.root)
            R0 = rhodes_note(f, dur_s, vel * 0.85, tone, 0.0, rng)
            end = min(start + len(R0), n)
            left[start:end] += 0.7 * R0[: end - start]
            right[start:end] += 0.7 * R0[: end - start]

    # slow tremolo — the classic lo-fi EP pulse
    tt = np.arange(n) / sr
    lfo = 1.0 + 0.10 * np.sin(2 * np.pi * 0.55 * tt)
    left *= lfo
    right *= lfo
    return np.column_stack([left, right])


# ---------------------------------------------------------------------------
# bass
# ---------------------------------------------------------------------------

def bass_note(freq: float, dur_s: float, vel: float, rng: random.Random,
              sr: int = SR) -> np.ndarray:
    n = int(dur_s * sr) + sr // 6
    nprng = np.random.default_rng(4)
    t = np.arange(n) / sr
    total = np.zeros(n)
    # saw-ish partial stack with plucky decay
    for r, a in [(1, 1.0), (2, 0.45), (3, 0.22), (4, 0.10)]:
        tau = 0.9 / r
        env = np.exp(-t / tau)
        total += a * env * np.sin(2 * np.pi * freq * r * t + nprng.uniform(0, 2 * np.pi))
    # sub sine for weight
    total += 0.7 * np.exp(-t / 1.2) * np.sin(2 * np.pi * freq * t)
    total = np.tanh(total * 1.4) / np.tanh(1.4)  # gentle pluck saturation
    amp = (vel ** 1.2) * 0.30
    return _fade(total * amp, 0.003, 0.05)


def render_bass(events, bpm: float, rng: random.Random, duration_s: float,
                sr: int = SR) -> np.ndarray:
    n = int((duration_s + 1.5) * sr)
    mono = np.zeros(n)
    for e in events:
        start = int(e.start * 60.0 / bpm * sr)
        dur_s = e.dur * 60.0 / bpm
        b = bass_note(midi_to_freq(e.midi), dur_s, e.vel / 127.0, rng)
        end = min(start + len(b), n)
        mono[start:end] += b[: end - start]
    return np.column_stack([mono, mono])


# ---------------------------------------------------------------------------
# drums (all synthesized)
# ---------------------------------------------------------------------------

def _kick(sr: int = SR) -> np.ndarray:
    n = int(0.30 * sr)
    t = np.arange(n) / sr
    # pitch sweep 165 -> 46 Hz
    f = 45 + 120 * np.exp(-t / 0.030)
    phase = 2 * np.pi * np.cumsum(f) / sr
    body = np.sin(phase) * np.exp(-t / 0.16)
    click = np.zeros(n)
    click[: int(0.004 * sr)] = 0.5 * np.random.default_rng(0).uniform(-1, 1, int(0.004 * sr))
    return _fade((body * 0.9 + click), 0.001, 0.03) * 0.9


def _snare(sr: int = SR) -> np.ndarray:
    n = int(0.24 * sr)
    t = np.arange(n) / sr
    noise = np.random.default_rng(1).uniform(-1, 1, n) * np.exp(-t / 0.055)
    # crude bandpass: diff of smoothed noise
    k = int(0.0003 * sr)
    kernel = np.ones(k) / k
    noise_s = np.convolve(noise, kernel, mode="same")
    noise_bp = noise - np.convolve(noise_s, kernel, mode="same")
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.09)
    return _fade((noise_bp * 0.8 + tone * 0.55), 0.001, 0.04) * 0.85


def _hat(open_: bool, sr: int = SR) -> np.ndarray:
    dur = 0.35 if open_ else 0.05
    n = int(dur * sr)
    t = np.arange(n) / sr
    rng = np.random.default_rng(2)
    noise = rng.uniform(-1, 1, n)
    # highpass-ish: subtract smoothed
    k = int(0.0002 * sr)
    kernel = np.ones(k) / k
    hp = noise - np.convolve(noise, kernel, mode="same")
    env = np.exp(-t / (0.10 if open_ else 0.016))
    return _fade(hp * env, 0.001, 0.02) * 0.35


def _rim(sr: int = SR) -> np.ndarray:
    n = int(0.07 * sr)
    t = np.arange(n) / sr
    rng = np.random.default_rng(3)
    noise = rng.uniform(-1, 1, n)
    k = int(0.0004 * sr)
    kernel = np.ones(k) / k
    bp = noise - np.convolve(noise, kernel, mode="same")
    return _fade(bp * np.exp(-t / 0.018), 0.001, 0.02) * 0.7


_DRUM_SYNTHS = {"kick": _kick, "snare": _snare, "hatc": lambda: _hat(False),
                "hato": lambda: _hat(True), "rim": _rim}
_DRUM_PAN = {"kick": 0.0, "snare": 0.0, "hatc": 0.18, "hato": 0.25, "rim": -0.2}


def render_drums(drum_events, bpm: float, rng: random.Random, duration_s: float,
                 sr: int = SR) -> np.ndarray:
    n = int((duration_s + 1.0) * sr)
    left = np.zeros(n)
    right = np.zeros(n)
    for d in drum_events:
        start = int(d.start * 60.0 / bpm * sr)
        buf = _DRUM_SYNTHS[d.kind]()
        end = min(start + len(buf), n)
        pan = _DRUM_PAN[d.kind]
        g = 0.5 * (1 - pan), 0.5 * (1 + pan)
        left[start:end] += buf[: end - start] * g[0] * d.vel
        right[start:end] += buf[: end - start] * g[1] * d.vel
    return np.column_stack([left, right])


# ---------------------------------------------------------------------------
# vinyl & tape character
# ---------------------------------------------------------------------------

def render_crackle(duration_s: float, amount: float, rng: random.Random,
                   sr: int = SR) -> np.ndarray:
    """Vinyl pops (impulsive) + a quiet hiss bed with slow LFO."""
    n = int(duration_s * sr)
    nprng = np.random.default_rng(rng.randint(0, 2**32 - 1))
    pops = np.zeros(n)
    n_pops = int(duration_s * 9 * amount)
    for _ in range(n_pops):
        pos = rng.randint(0, n - 8)
        amp = np.exp(rng.gauss(-3.2, 0.9)) * (0.25 + 1.5 * amount)
        ln = rng.randint(3, 9)
        pops[pos:pos + ln] += amp * nprng.uniform(-1, 1, ln)
    # differencing = crude highpass, makes pops crack
    pops = np.diff(pops, prepend=0)

    hiss = nprng.uniform(-1, 1, n)
    k = int(0.002 * sr)
    kernel = np.ones(k) / k
    hiss = np.convolve(hiss, kernel, mode="same") * 0.5
    tt = np.arange(n) / sr
    hiss *= (0.5 + 0.5 * np.sin(2 * np.pi * 0.31 * tt + rng.uniform(0, 6))) * 0.5
    hiss *= 0.020 * amount

    m = pops * 0.55 + hiss
    return np.column_stack([m, m])


def apply_wobble(x: np.ndarray, depth: float, rng: random.Random,
                 sr: int = SR) -> np.ndarray:
    """Tape-style pitch wobble via slow resampling modulation."""
    if depth <= 0.001:
        return x
    n = len(x)
    idx = np.arange(n, dtype=np.float64)
    mod = np.sin(2 * np.pi * 0.35 * idx / sr + rng.uniform(0, 6))
    offset = depth * 900.0 * mod  # samples of displacement
    src = np.clip(idx + offset, 0, n - 1)
    out = np.empty_like(x)
    for ch in range(x.shape[1]):
        out[:, ch] = np.interp(src, idx, x[:, ch])
    return out


def sidechain_pump(x: np.ndarray, kick_times_s: List[float], bpm: float,
                   depth: float, sr: int = SR) -> np.ndarray:
    """Duck the track after every kick — the lo-fi breathing pump."""
    if depth <= 0.001 or not kick_times_s:
        return x
    n = len(x)
    t = np.arange(n) / sr
    gain = np.ones(n)
    for kt in kick_times_s:
        rel = t - kt
        m = (rel >= 0) & (rel < 1.2)
        env = 0.55 * np.exp(-np.clip(rel[m], 0, None) / 0.085) + \
              0.25 * np.exp(-np.clip(rel[m], 0, None) / 0.32)
        gain[m] *= 1.0 - depth * env
    gain = np.maximum(gain, 1.0 - depth * 0.8)
    return x * gain[:, None]


# ---------------------------------------------------------------------------
# shared FX helpers (numpy fallbacks; pedalboard used when available)
# ---------------------------------------------------------------------------

def one_pole_lowpass(x: np.ndarray, cutoff: float, sr: int = SR) -> np.ndarray:
    a = 1.0 - np.exp(-2 * np.pi * cutoff / sr)
    y = np.empty_like(x)
    prev = np.zeros(x.shape[1])
    for i in range(len(x)):
        prev = prev + a * (x[i] - prev)
        y[i] = prev
    return y


def tanh_saturate(x: np.ndarray, drive: float) -> np.ndarray:
    g = 1.0 + 5.0 * drive
    return np.tanh(x * g) / np.tanh(g)


def schroeder_reverb(x: np.ndarray, mix: float, sr: int = SR) -> np.ndarray:
    """Cheap Schroeder reverb fallback (used only if pedalboard is missing)."""
    if mix <= 0.001:
        return x
    n = len(x)
    out = np.zeros_like(x)
    for ch in range(x.shape[1]):
        signal = x[:, ch]
        wet = np.zeros(n)
        comb_delays = [1557, 1617, 1491, 1422]
        fb = 0.77
        for d in comb_delays:
            buf = np.zeros(d)
            for i in range(n):
                s = signal[i] + buf[i % d] * fb
                buf[i % d] = s
                wet[i] += s
        wet /= len(comb_delays)
        allpass = [225, 556]
        for d in allpass:
            buf = np.zeros(d)
            for i in range(n):
                xin = wet[i] + buf[i % d] * 0.7
                buf[i % d] = xin
                wet[i] = buf[i % d] - xin * 0.7
        out[:, ch] = signal * (1 - mix) + wet * mix * 1.4
    return out
