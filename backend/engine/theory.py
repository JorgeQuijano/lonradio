"""Composition layer — music theory, progressions, voicings, rhythms.

Uses music21 for the score/MIDI export layer (the same pattern real
algorithmic-composition projects use); the theory itself is explicit and
deterministic so everything is seeded-reproducible.
"""
from __future__ import annotations

import dataclasses
import random
from typing import Dict, List, Tuple

from .params import TrackParams

# ---------------------------------------------------------------------------
# scales & spelling
# ---------------------------------------------------------------------------

# 12-key spelling tables so chords display as "Fmaj7", "Bbm9" etc. correctly.
# Each entry: the 7 natural-letter spellings for scale degrees 1..7.
_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]

# keys spelled with flats (minor and major)
_FLAT_KEYS = {"Db", "Eb", "F", "Ab", "Bb", "C", "D", "G"}  # major
_FLAT_KEYS_MINOR = {"Bb", "C", "D", "Eb", "F", "G", "Ab"}  # minor


def _spelling(key: str, mode: str) -> List[str]:
    root = _SHARP.index(key)
    intervals = MINOR_INTERVALS if mode == "minor" else MAJOR_INTERVALS
    use_flat = (key in _FLAT_KEYS_MINOR) if mode == "minor" else (key in _FLAT_KEYS)
    table = _FLAT if use_flat else _SHARP
    return [table[(root + i) % 12] for i in intervals]


def scale_degrees(key: str, mode: str) -> List[int]:
    """MIDI pitch classes (0=C) for scale degrees 1..7."""
    root = _SHARP.index(key)
    intervals = MINOR_INTERVALS if mode == "minor" else MAJOR_INTERVALS
    return [(root + i) % 12 for i in intervals]


# ---------------------------------------------------------------------------
# chords
# ---------------------------------------------------------------------------

# quality -> semitone offsets from the root
_QUALITY_OFFSETS = {
    "maj7": [0, 4, 7, 11],
    "min7": [0, 3, 7, 10],
    "dom7": [0, 4, 7, 10],
    "halfdim7": [0, 3, 6, 10],
    "maj9": [0, 4, 7, 11, 14],
    "min9": [0, 3, 7, 10, 14],
    "dom9": [0, 4, 7, 10, 14],
    "maj-add9": [0, 4, 7, 14],
    "min-add9": [0, 3, 7, 14],
}

# progression presets: list of (degree 1-based, quality) — degree indexes the
# diatonic scale, quality gives the color (may be non-diatonic on purpose, e.g.
# V7 in minor uses the raised 7th).
_PRESETS_MINOR = {
    "classic": [(1, "min7"), (6, "maj7"), (3, "maj7"), (7, "dom7")],       # Am7 Fmaj7 Cmaj7 G7
    "soulful": [(1, "min7"), (4, "min7"), (7, "dom7"), (3, "maj7")],       # Am7 Dm7 G7 Cmaj7
    "jazzy": [(1, "min7"), (2, "halfdim7"), (5, "dom7"), (1, "min7")],     # Am7 Bm7b5 E7 Am7
    "dreamy": [(1, "min7"), (7, "dom7"), (6, "maj7"), (3, "maj7")],        # Am7 G7 Fmaj7 Cmaj7
}
_PRESETS_MAJOR = {
    "classic": [(1, "maj7"), (6, "min7"), (4, "maj7"), (5, "dom7")],       # Cmaj7 Am7 Fmaj7 G7
    "soulful": [(1, "maj7"), (4, "maj7"), (6, "min7"), (5, "dom7")],       # Cmaj7 Fmaj7 Am7 G7
    "jazzy": [(2, "min7"), (5, "dom7"), (1, "maj7"), (6, "min7")],         # Dm7 G7 Cmaj7 Am7
    "dreamy": [(1, "maj7"), (5, "dom7"), (6, "min7"), (4, "maj7")],        # Cmaj7 G7 Am7 Fmaj7
}

_QUALITY_NAME = {
    "maj7": "maj7", "min7": "m7", "dom7": "7", "halfdim7": "m7b5",
    "maj9": "maj9", "min9": "m9", "dom9": "9", "maj-add9": "add9", "min-add9": "add9",
}

_CADENCE = {"minor": (5, "dom7"), "major": (5, "dom7")}  # last bar -> V7


def _quality_for_ext(base: str, ext: str) -> str:
    if ext == "7":
        return base
    if ext == "9":
        if base == "maj7":
            return "maj9"
        if base == "min7":
            return "min9"
        if base == "dom7":
            return "dom9"
        return base
    # add9 — drop the 7th for an airy open sound
    if base in ("maj7", "dom7"):
        return "maj-add9"
    if base in ("min7", "halfdim7"):
        return "min-add9"
    return base


def build_chord(scale: List[int], degree: int, quality: str) -> List[int]:
    """Chord as MIDI pitch classes, from a diatonic scale + quality."""
    root = scale[(degree - 1) % 7]
    return [(root + o) % 12 for o in _QUALITY_OFFSETS[quality]]


def chord_name(root_pc: int, quality: str, key: str, mode: str) -> str:
    """Chord display name, spelled in the key's own spelling (Am9, Fmaj7…)."""
    table = _FLAT if key in (_FLAT_KEYS_MINOR if mode == "minor" else _FLAT_KEYS) else _SHARP
    return table[root_pc % 12] + _QUALITY_NAME[quality]


# cache spelling lists per key/mode for speed & reuse in chord_name
_SPELLING_CACHE: Dict[Tuple[str, str], List[str]] = {}
for _k in _SHARP:
    for _m in ("minor", "major"):
        _SPELLING_CACHE[(_k, _m)] = _spelling(_k, _m)


# ---------------------------------------------------------------------------
# events model
# ---------------------------------------------------------------------------

@dataclasses.dataclass
class NoteEvent:
    part: str          # "ep" | "bass" | "melody"
    start: float       # in beats
    dur: float         # in beats
    midi: int
    vel: int
    tones: List[int] = dataclasses.field(default_factory=list)  # EP chords
    root: int = 0                                              # EP bass root


@dataclasses.dataclass
class DrumEvent:
    start: float       # beats
    kind: str          # kick | snare | hatc | hato | rim


@dataclasses.dataclass
class Composition:
    key: str
    mode: str
    bpm: int
    bars: int
    chords: List[Tuple[float, float, str]]   # (start_beat, dur_beats, "Am9")
    notes: List[NoteEvent]
    drums: List[DrumEvent]
    melody: List[NoteEvent]

    @property
    def duration_beats(self) -> float:
        return self.bars * 4.0

    @property
    def duration_sec(self) -> float:
        return self.duration_beats * 60.0 / self.bpm

    @property
    def notes_ep(self) -> List[NoteEvent]:
        return [e for e in self.notes if e.part == "ep"]

    @property
    def notes_bass(self) -> List[NoteEvent]:
        return [e for e in self.notes if e.part == "bass"]


# ---------------------------------------------------------------------------
# composition
# ---------------------------------------------------------------------------

def compose(p: TrackParams) -> Composition:
    rng = p.rng()
    scale = scale_degrees(p.key, p.mode)
    preset = (_PRESETS_MINOR if p.mode == "minor" else _PRESETS_MAJOR)[p.progression]
    root_pc = scale[0]

    # ---- chord sequence over bars ----
    bars = p.bars
    chords: List[Tuple[float, float, str]] = []
    chord_data: List[Tuple[int, int, str]] = []  # (start_beat, degree, quality)
    prog_len = len(preset)
    for bar in range(bars):
        idx = bar % prog_len
        if bars >= 8 and bar >= bars // 2:
            idx = (idx + 2) % prog_len  # B section: rotate for movement
        if bar == bars - 1:
            degree, quality = _CADENCE[p.mode]
        else:
            degree, quality = preset[idx]
        quality = _quality_for_ext(quality, p.chord_ext)
        start = bar * 4.0
        dur = 4.0
        tones = build_chord(scale, degree, quality)
        name = chord_name(tones[0], quality, p.key, p.mode)
        chords.append((start, dur, name))
        chord_data.append((int(start), degree, quality))

    # ---- voicing: map chord pitch classes -> playable MIDI notes ----
    def voice(tones: List[int], ext: str) -> Tuple[int, List[int]]:
        """Return (bass_root_midi, ep_midi_notes) for a chord's pitch classes."""
        root = tones[0]
        # root placed low (C1..B2)
        root_midi = 24 + 12 * (root // 12) + root % 12
        while root_midi < 33:
            root_midi += 12
        while root_midi > 44:
            root_midi -= 12
        others = tones[1:]
        if p.voicing == "spread":
            # airy: non-root tones land in C4..C5, top tone +12 for a 9th sparkle
            placed = []
            for t in others:
                n = 60 + t % 12
                while n < 60:
                    n += 12
                while n >= 72:
                    n -= 12
                placed.append(n)
            if len(placed) >= 4:
                placed[-1] += 12
        elif p.voicing == "drop2":
            close = [60 + t % 12 for t in others]
            close.sort()
            if len(close) >= 4:
                # drop second-from-top down an octave
                close[-2] -= 12
            placed = close
        else:  # close
            placed = []
            for t in others:
                n = 60 + t % 12
                while n < 64:
                    n += 12
                while n >= 76:
                    n -= 12
                placed.append(n)
        # dedupe octave collisions
        seen, uniq = set(), []
        for n in [root_midi] + placed:
            if n not in seen:
                seen.add(n)
                uniq.append(n)
        return root_midi, uniq

    # ---- EP events (one chord per bar, held; slight human timing) ----
    ep_events: List[NoteEvent] = []
    bass_events: List[NoteEvent] = []
    bass_root_midis: List[int] = []
    for (start, dur, _name), (_, degree, quality) in zip(chords, chord_data):
        tones = build_chord(scale, degree, quality)
        root_midi, notes = voice(tones, p.chord_ext)
        bass_root_midis.append(root_midi)
        vel = int(74 + rng.uniform(-8, 8))
        ev = NoteEvent("ep", start + rng.uniform(-0.01, 0.01), dur * 0.98, notes[0], vel)
        ev.tones = notes
        ev.root = root_midi
        ep_events.append(ev)

    # ---- bass patterns ----
    bass_events = _make_bass(p, rng, chord_data, bass_root_midis)

    # ---- drums ----
    drum_events = _make_drums(p, rng)

    # ---- melody ----
    melody_events = _make_melody(p, rng, scale, chord_data)

    return Composition(
        key=p.key, mode=p.mode, bpm=p.bpm, bars=bars,
        chords=chords, notes=ep_events + bass_events,
        drums=drum_events, melody=melody_events,
    )


def _swing_offbeat(beat: float, swing: float) -> float:
    """Delay offbeat 8th/16th notes for a swung feel (lo-fi staple)."""
    frac = beat % 1.0
    if abs(frac - 0.5) < 0.01 or abs(frac - 0.75) < 0.01:
        return beat + swing * 0.5 * 0.5  # delay off-8ths / off-16ths by swing*eighth/2
    return beat


def _make_bass(p: TrackParams, rng: random.Random,
               chord_data: List[Tuple[int, int, str]],
               roots: List[int]) -> List[NoteEvent]:
    ev: List[NoteEvent] = []
    style = p.bass_style
    scale = scale_degrees(p.key, p.mode)

    def root_for(bar: int) -> int:
        return roots[bar]

    for bar, (start, degree, _q) in enumerate(chord_data):
        root = root_for(bar)
        bar_start = start
        if style == "root-eighths":
            for i in range(8):  # 8th notes
                beat = bar_start + i * 0.5
                note = root
                vel = 82 if i % 2 == 0 else 62
                if i % 2 == 1 and rng.random() < 0.6:
                    note = root + 12
                ev.append(NoteEvent("bass", _swing_offbeat(beat, p.swing), 0.46,
                                    note, vel + rng.randint(-4, 4)))
        elif style == "walk":
            target = roots[(bar + 1) % len(roots)]
            current = root
            for i in range(4):  # quarter notes, stepwise toward next root
                beat = bar_start + i
                if i < 3:
                    # step 1-2 scale tones toward target
                    diff = (target - current)
                    step = 2 if rng.random() < 0.3 else 1
                    nxt = current + (step if diff > 0 else -step)
                    if abs(nxt - target) < 2:
                        nxt = target
                    ev.append(NoteEvent("bass", beat, 0.9, current, 70 + rng.randint(-5, 5)))
                    current = nxt
                else:
                    ev.append(NoteEvent("bass", beat, 0.9, target, 74 + rng.randint(-5, 5)))
        elif style == "octave-bounce":
            for i in range(8):
                beat = bar_start + i * 0.5
                note = root if i % 2 == 0 else root + 12
                vel = 78 if i % 2 == 0 else 58
                ev.append(NoteEvent("bass", _swing_offbeat(beat, p.swing), 0.4,
                                    note, vel + rng.randint(-4, 4)))
        elif style == "syncopated":
            pattern = [1, 0, 0, 1, 0, 1, 0, 1]  # 8ths; hits with rests
            for i, hit in enumerate(pattern):
                if not hit:
                    continue
                beat = bar_start + i * 0.5
                note = root
                if i == 7:
                    note = root + 12
                vel = 74 if i % 2 == 0 else 64
                ev.append(NoteEvent("bass", _swing_offbeat(beat, p.swing), 0.42,
                                    note, vel + rng.randint(-4, 4)))
        elif style == "pedal":
            tonic = roots[0]
            ev.append(NoteEvent("bass", bar_start, 3.8, tonic, 66))
            if bar % 2 == 1:
                ev.append(NoteEvent("bass", bar_start + 3.0, 0.9, tonic + 7, 58))
    return ev


def _make_drums(p: TrackParams, rng: random.Random) -> List[DrumEvent]:
    ev: List[DrumEvent] = []
    style = p.drums
    if style == "none":
        return ev
    swing = p.swing
    for bar in range(p.bars):
        b0 = bar * 4.0
        if style == "boom-bap":
            for i in range(16):
                beat = b0 + i * 0.25
                if i in (0, 7, 10):
                    ev.append(DrumEvent(beat, "kick"))
                if i in (4, 12):
                    ev.append(DrumEvent(beat, "snare"))
                if i % 2 == 0:
                    ev.append(DrumEvent(_swing_offbeat(beat, swing), "hatc"))
                if i == 14 and rng.random() < 0.4:
                    ev.append(DrumEvent(beat, "hato"))
                if i == 6 and rng.random() < 0.5:
                    ev.append(DrumEvent(beat, "rim"))
        elif style == "brushed":
            for i in range(16):
                beat = b0 + i * 0.25
                if i in (0, 8):
                    ev.append(DrumEvent(beat, "kick"))
                if i in (4, 12):
                    ev.append(DrumEvent(beat, "snare"))
                if i % 4 == 0:
                    ev.append(DrumEvent(_swing_offbeat(beat, swing), "hatc"))
                if i % 8 == 6:
                    ev.append(DrumEvent(beat, "rim"))
                if i % 4 == 2 and rng.random() < 0.5:
                    ev.append(DrumEvent(_swing_offbeat(beat, swing), "hatc"))
        elif style == "four-floor":
            for i in range(16):
                beat = b0 + i * 0.25
                if i % 4 == 0:
                    ev.append(DrumEvent(beat, "kick"))
                if i in (4, 12):
                    ev.append(DrumEvent(beat, "snare"))
                if i % 2 == 0:
                    ev.append(DrumEvent(_swing_offbeat(beat, swing), "hatc"))
    return ev


def _make_melody(p: TrackParams, rng: random.Random, scale: List[int],
                 chord_data: List[Tuple[int, int, str]]) -> List[NoteEvent]:
    ev: List[NoteEvent] = []
    if p.melody == "none":
        return ev
    pentatonic = [scale[0], scale[1], scale[2], scale[4], scale[5]]  # 1 2 3 5 6
    register = 72  # C5
    current = register + rng.choice([0, 2, 4, 7, 9])
    for bar, (start, degree, _q) in enumerate(chord_data):
        b0 = start
        if p.melody == "sparse":
            # 1-2 short motifs per bar, mostly rests
            for i in range(2):
                if rng.random() < 0.6:
                    on = b0 + rng.choice([0.0, 1.0, 2.0, 3.0])
                    dur = rng.choice([0.5, 1.0, 1.5])
                    current = _melody_step(rng, current, pentatonic, register)
                    ev.append(NoteEvent("melody", on, dur, current,
                                        62 + rng.randint(-6, 10)))
        else:  # flowing: continuous 8th-note line with contour
            for i in range(8):
                if rng.random() < 0.82:
                    on = b0 + i * 0.5
                    dur = rng.choice([0.4, 0.5, 0.9])
                    if rng.random() < 0.35:
                        current = _melody_step(rng, current, pentatonic, register)
                    ev.append(NoteEvent("melody", _swing_offbeat(on, p.swing * 0.6),
                                        dur, current, 58 + rng.randint(-5, 12)))
    return ev


def _melody_step(rng: random.Random, current: int, pentatonic: List[int],
                 register: int) -> int:
    """Random walk on the pentatonic set, staying in C5..C6."""
    base = current // 12
    pc = current % 12
    options = [p for p in pentatonic if abs(p - pc) in (0, 2, 3, 4, 5, 7)]
    if not options:
        options = pentatonic
    new_pc = rng.choice(options)
    # prefer staying near, step at most one pentatonic step
    cand = base * 12 + new_pc
    while cand < register:
        cand += 12
    while cand >= register + 12:
        cand -= 12
    if rng.random() < 0.5:
        cand += 12
    cand = max(register - 12, min(register + 19, cand))
    return cand


# ---------------------------------------------------------------------------
# MIDI export (music21)
# ---------------------------------------------------------------------------

def export_midi(c: Composition, path: str) -> None:
    from music21 import chord, instrument, key as k21, meter, note, stream, tempo

    score = stream.Score()
    score.append(k21.Key(c.key, c.mode))
    score.append(meter.TimeSignature("4/4"))
    score.append(tempo.MetronomeMark(number=c.bpm))

    # EP part
    ep = stream.Part()
    ep.append(instrument.ElectricPiano())
    for e in c.notes:
        if e.part != "ep":
            continue
        tones = getattr(e, "tones", [e.midi])
        ch = chord.Chord(tones)
        ch.quarterLength = e.dur
        ch.offset = e.start
        ch.volume.velocity = e.vel
        ep.append(ch)
    score.append(ep)

    # Bass part
    bass = stream.Part()
    bass.append(instrument.ElectricBass())
    for e in c.notes:
        if e.part != "bass":
            continue
        n = note.Note(e.midi)
        n.quarterLength = e.dur
        n.offset = e.start
        n.volume.velocity = e.vel
        bass.append(n)
    score.append(bass)

    # Melody part
    mel = stream.Part()
    mel.append(instrument.ElectricPiano())
    for e in c.melody:
        n = note.Note(e.midi)
        n.quarterLength = e.dur
        n.offset = e.start
        n.volume.velocity = e.vel
        mel.append(n)
    score.append(mel)

    # Drums (GM channel 10 via Percussion instrument)
    GM = {"kick": 36, "snare": 38, "hatc": 42, "hato": 46, "rim": 37}
    drum = stream.Part()
    drum.append(instrument.Percussion())
    for d in c.drums:
        n = note.Note(GM[d.kind])
        n.quarterLength = 0.24
        n.offset = d.start
        n.volume.velocity = 84
        drum.append(n)
    score.append(drum)

    score.write("midi", fp=path)
