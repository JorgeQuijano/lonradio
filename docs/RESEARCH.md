# Research — how to "code" lo-fi music in Python (Aug 2026)

## 1. Can you "code" music in Python? Yes.

Two styles:
- **Symbolic composition** — you write notes/chords/rhythms as data, export
  MIDI. This is where all the mature libraries live.
- **Sample-level synthesis** — you generate the actual audio waveform from
  math. This is what gives the *sound* of lo-fi (warm EP, vinyl crackle,
  tape wobble, sidechain pump) and it's just numpy.

The lo-fi sound is 50% harmony (m7/9 chords, slow swing) and 50% texture
(crackle, saturation, lowpass blanket). A good engine needs both layers.

## 2. Library comparison (PyPI status, Aug 2026)

| Library | Version | Last release | Verdict |
|---|---|---|---|
| **music21** | 10.5.0 | Jun 2026 | ✅ **Pick** — key/chord/voicing theory, MIDI export, huge community. The standard for algorithmic composition |
| **pedalboard** (Spotify) | 0.9.24 | Jul 2026 | ✅ **Pick** — pro audio FX (saturation, reverb, compressors, filters) that run headless. Perfect tape/master chain |
| **numpy** | 2.4.6 | 2026 | ✅ **Pick** — sample synthesis: EP, bass, drums, crackle, wobble. Zero deps beyond itself |
| pretty_midi | 0.2.11 | Jul 2026 | Good MIDI IO, no theory — redundant next to music21 |
| pyo | 1.0.5 | Mar 2023 | Real-time DSP, needs audio device; stale; awkward for headless batch render |
| mingus | 0.6.1 | Dec 2020 | Stale |
| midiutil | 1.2.1 | Mar 2018 | Stale, barebones |
| abjad | 3.31 | Oct 2025 | LilyPond engraving — classical notation, overkill |
| foxdot | 0.9.0 | Jun 2025 | Live-coding via SuperCollider — real-time performance, not batch files |
| muspy | 0.5.0 | Apr 2022 | ML dataset toolkit, stale |
| AI text-to-audio (Riffusion, MusicGen, Stable Audio) | — | — | Rejected: no programmatic control of bass style / chord quality / drums |

**Picks: music21 (compose) + numpy (synthesize) + pedalboard (master).**
No single library does all three; this is the standard split in real
algorithmic-music repos (e.g. github.com/kauanycomin-dev/lofi-composer uses
pure-Python theory + music21 for export, same pattern as this repo).

## 3. How the lo-fi sound is made here

- **Rhodes-style EP** — additive synthesis: inharmonic partials (1.0–5.3×),
  fast-decaying high "tine ping", felt thump on attack, ±2.8¢ detuned stereo
  pair, slow tremolo. This is the classic lo-fi chord instrument.
- **Bass** — plucked saw-ish partial stack + sub sine, gentle tanh clip.
  Five styles: root-eighths, walk, octave-bounce, syncopated, pedal.
- **Drums** — fully synthesized: kick (165→46 Hz pitch sweep), snare
  (bandpassed noise + 185 Hz tone), hats (highpassed noise), rim. Boom-bap /
  brushed / four-floor patterns with swing on offbeats.
- **Vinyl** — Poisson-distributed crackle pops (exponentially distributed
  amplitudes, highpassed) + slow-LFO hiss bed.
- **Tape** — pitch wobble via resampled slow sine modulation.
- **Master** — tanh saturation → lowpass blanket (3–12 kHz, the lo-fi
  "muffled radio" cut) → room reverb → compressor → limiter → normalize.
- **Sidechain pump** — everything except drums ducks after each kick.

## 4. beautifului.dev teardown (how they do it)

- Stack: **Next.js (App Router) + Tailwind CSS v4**, deployed on Vercel
  (`/_next/static/…?dpl=…` fingerprints), self-hosted fonts, Inter.
- Theming: CSS custom properties, two token sets:
  - `:root` light — `--page:#fafafb --surface:#fff --ink:#1f2124 --line:#ecedef --accent:#0285ff`
  - `.dark` dark — `--page:#17181a --surface:#232427 --ink:#f2f3f4 --line:#2e3033 --accent:#3d9aff`
  - plus tints (`--accent-tint`), semantic green/orange/red, shadow system
    (hairline/btn/card/raised/overlay/inset-field) and radii
    (chip 6px / control 8px / card 10px).
- Layout language: numbered sections (01…16) with live interactive demo +
  "Copy code" / "View code" toggle, light/dark segmented toggle in the top
  bar, mono eyebrows, hairline borders, cards on a slightly-lighter canvas.
- Replicated 1:1 in `frontend/src/styles.css` + `themes.ts`, extended with
  three extra themes (Midnight, Cassette, Synthwave) and a dropdown selector.
