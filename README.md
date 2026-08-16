# lonradio — code lo-fi music

Algorithmic lo-fi generator. Every track is **composed and synthesized from
math** — no samples, no soundfonts, no AI black box. A React studio (styled
after beautifului.dev) lets you tweak harmony, bass, drums, melody and vinyl
FX; the Python engine renders a deterministic WAV + MIDI in ~2–4s.

```
┌────────────────────┐   POST /api/generate   ┌────────────────────────────┐
│  React + Tailwind  │ ─────────────────────▶ │  FastAPI (uvicorn)         │
│  studio UI         │ ◀───────────────────── │  ┌────────────────────────┐│
│  (5 themes)        │   audio.wav / track.mid│  │ engine:                 ││
└────────────────────┘                        │  │  theory.py   (music21)  ││
                                              │  │  synths.py   (numpy)    ││
                                              │  │  fx.py       (pedalboard││
                                              │  └────────────────────────┘│
                                              └────────────────────────────┘
```

## The engine (research summary)

| Layer | Library | Why |
|---|---|---|
| Composition | **music21** 10.5 (2026) | Keys, chord quality, voicings, MIDI export — the standard for algorithmic composition |
| Synthesis | **numpy** | Rhodes-style EP (additive partials + tine ping), bass, drums, vinyl crackle, tape wobble — full programmatic control, seeded |
| FX / master | **pedalboard** 0.9 (Spotify) | Tape saturation, lowpass blanket, room reverb, compressor, limiter |
| API | **FastAPI** | Param validation, async render, WAV/MIDI serving |

Rejected: `mingus`/`midiutil`/`muspy` (unmaintained), `pyo` (real-time DSP,
needs soundcard, stale), `foxdot` (SuperCollider live-coding, not headless
batch), AI text-to-audio (Riffusion/MusicGen — no programmatic control of
bass style etc.). Details in [`docs/RESEARCH.md`](docs/RESEARCH.md).

## Run it

```bash
# backend (engine + API + serves built frontend)
cd backend
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app:app --port 8000 --reload

# frontend (dev server, proxies /api to :8000)
cd frontend
npm install
npm run dev          # http://localhost:5173

# production build (served by FastAPI at :8000)
npm run build
```

Open http://localhost:8000 after `npm run build`, or :5173 during dev.

## API

| Endpoint | Description |
|---|---|
| `POST /api/generate` | Body: TrackParams JSON → `{id, name, wav, midi, chords, duration_s, took_ms}` |
| `GET /api/tracks/{id}/audio.wav` | Rendered track (44.1kHz stereo 16-bit) |
| `GET /api/tracks/{id}/track.mid` | music21 MIDI export (5 tracks: score/EP/bass/melody/drums) |
| `GET /api/tracks/{id}/info` | Track JSON sidecar |
| `GET /api/radio` | **Endless MP3 stream** — the 24/7 auto-DJ broadcast |
| `GET /api/radio/now` | Now playing + history + listener count |
| `GET /api/radio/status` | Radio enabled / listeners / uptime |
| `GET /api/presets` / `GET /api/options` | UI vocabularies |

## 24/7 radio

`backend/radio.py` runs an auto-DJ thread: it renders tracks endlessly,
random-walking between moods (harmony changes in "mood blocks", tempo ±6bpm
per track, bass/drums/melody drift, FX wander slowly), encodes each track to
MP3 via ffmpeg, and broadcasts to every connected listener. Listeners join at
the start of the current track; ~6 min of history is buffered.

- Starts with the server; disable with `LONRADIO_RADIO=0`.
- Requires `ffmpeg` on PATH (MP3 encoding).
- Browsers play it with a plain `<audio src="/api/radio">`; the studio's
  "Lonradio 24/7" card shows live now-playing metadata.

## Determinism

Same `seed` + params → byte-identical WAV. `seed` drives every random choice
(swing humanization, melody contour, crackle impulses).

## Design system

UI tokens are extracted verbatim from beautifului.dev (Next.js + Tailwind v4
on Vercel): CSS-variable palettes (`--page`, `--surface`, `--accent`…),
hairline borders, 10px card / 8px control radii, Inter + JetBrains Mono.
Five themes: Dark & Light (beautifului's own palettes), Midnight, Cassette,
Synthwave — switchable from the top bar, persisted in localStorage.

## Repo layout

```
backend/
  engine/          # params, theory (music21), synths (numpy), fx (pedalboard), render
  app.py           # FastAPI
  smoke.py         # render + spectral sanity checks (python smoke.py)
frontend/
  src/             # React + Tailwind v4 studio
    components/    # TopBar, Hero, Sidebar, Section, Studio, Player, controls
    themes.ts      # 5 theme definitions
docs/RESEARCH.md   # library comparison + beautifului teardown
```

Old site (London ON emergency/ATC radio player) is preserved in the
`pre-redo` git tag.
