/* Radio page — lean-back listening: big now-playing card, live progress,
   upcoming preview, history, and a WebAudio visualizer. */

import { useEffect, useRef, useState } from "react";
import { useRadioAudio } from "../useRadioAudio";
import { Chip } from "./controls";

interface TrackMeta {
  name: string;
  seed: number;
  key: string;
  bpm: number;
  bars: number;
  chords: string[];
  duration_s: number;
  started_at: number;
  rendered_ms?: number;
  sections?: { name: string; start_s: number; dur_s: number; drums: string; bass: string; melody: string }[];
}

interface UpcomingMeta {
  name: string;
  seed: number;
  key: string;
  bpm: number;
  bars: number;
}

interface RadioNow {
  current: TrackMeta | null;
  history: TrackMeta[];
  upcoming: UpcomingMeta[];
  listeners: number;
  uptime_s: number;
  tracks_played: number;
}

function fmtClock(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function RadioPage() {
  const { audioRef, playing, toggle, error } = useRadioAudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [volume, setVolume] = useState(0.9);
  const [now, setNow] = useState<RadioNow | null>(null);
  const [clock, setClock] = useState(Date.now());

  // now-playing poll
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/radio/now");
        if (res.ok) {
          const d = (await res.json()) as RadioNow;
          if (alive) setNow(d);
        }
      } catch {
        /* keep last state */
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // local clock tick for progress/countdown
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ensureAnalyser = () => {
    const a = audioRef.current;
    if (!a || analyserRef.current) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(a);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.82;
    src.connect(an);
    an.connect(ctx.destination);
    analyserRef.current = an;
    void ctx.resume();
  };

  // visualizer loop
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const an = analyserRef.current;
      const cv = canvasRef.current;
      if (an && cv) {
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth;
        const h = cv.clientHeight;
        if (w > 0 && (cv.width !== w * dpr || cv.height !== h * dpr)) {
          cv.width = w * dpr;
          cv.height = h * dpr;
        }
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, cv.width, cv.height);
          const data = new Uint8Array(an.frequencyBinCount);
          an.getByteFrequencyData(data);
          const bars = 64;
          const step = Math.floor(data.length / bars);
          const barW = cv.width / bars;
          const accent =
            getComputedStyle(document.documentElement)
              .getPropertyValue("--accent")
              .trim() || "#3d9aff";
          ctx.fillStyle = accent;
          for (let i = 0; i < bars; i++) {
            let v = 0;
            for (let j = i * step; j < (i + 1) * step; j++) v = Math.max(v, data[j]);
            const hh = (v / 255) * cv.height * 0.92;
            const x = i * barW + barW * 0.18;
            const bw = barW * 0.64;
            ctx.globalAlpha = 0.28;
            ctx.fillRect(x, cv.height - hh, bw, hh);
            ctx.globalAlpha = 1;
            ctx.fillRect(x, cv.height - hh, bw, Math.max(2, hh * 0.2));
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = () => {
    ensureAnalyser();
    toggle();
  };

  const cur = now?.current;
  const elapsedFrac = cur
    ? Math.max(0, Math.min(1, (clock / 1000 - cur.started_at) / cur.duration_s))
    : 0;
  const remaining = cur ? Math.max(0, cur.started_at + cur.duration_s - clock / 1000) : 0;

  return (
    <main className="max-w-3xl mx-auto px-5 pb-20">
      {/* header */}
      <header className="pt-12 pb-8 text-center">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-ink-3 mb-3">
          Broadcasting from London, ON
        </p>
        <h1 className="text-[36px] sm:text-[44px] leading-tight font-semibold tracking-[-0.03em]">
          Lonradio <span className="bg-gradient-to-r from-accent via-accent-ink to-accent bg-clip-text text-transparent">24/7</span>
        </h1>
        <p className="mt-3 text-[14px] text-ink-2">
          Endless algorithmic lo-fi — every track composed and synthesized from math,
          live on air.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          <span className="chip chip-accent">
            <span className={`w-1.5 h-1.5 rounded-full ${playing ? "bg-good animate-pulse" : "bg-accent-ink"}`} />
            {playing ? "LIVE" : "ON AIR"}
          </span>
          {now && (
            <>
              <span className="chip">{now.listeners} listener{now.listeners === 1 ? "" : "s"}</span>
              <span className="chip">{fmtUptime(now.uptime_s)} uptime</span>
              <span className="chip">{now.tracks_played} tracks played</span>
            </>
          )}
        </div>
      </header>

      {/* now playing */}
      <div className="card p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1">
              On air now
            </p>
            <h2
              key={cur?.seed}
              className="text-[22px] sm:text-[26px] font-semibold tracking-tight truncate fade-up"
            >
              {cur ? cur.name : "First track rendering…"}
            </h2>
            {cur && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Chip>{cur.key}</Chip>
                <Chip>{cur.bpm} bpm</Chip>
                <Chip>{cur.bars} bars</Chip>
                <Chip>seed {cur.seed}</Chip>
                <Chip accent>~{Math.round(cur.duration_s)}s</Chip>
              </div>
            )}
          </div>
          <button
            type="button"
            className="w-14 h-14 shrink-0 rounded-full grid place-items-center bg-accent text-black shadow-btn hover:brightness-110 transition-all active:scale-95"
            onClick={togglePlay}
            aria-label={playing ? "Pause stream" : "Play stream"}
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
                <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2.5 1.5v9l7.5-4.5-7.5-4.5z" />
              </svg>
            )}
          </button>
        </div>

        {/* progress + countdown */}
        {cur && (
          <div className="mt-5">
            <div className="h-1.5 rounded-full bg-line-strong overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${Math.max(2, elapsedFrac * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 font-mono text-[11.5px] text-ink-3 tabular-nums">
              <span>{fmtClock(elapsedFrac * cur.duration_s)}</span>
              <span>next track in {fmtClock(remaining)}</span>
            </div>
          </div>
        )}

        {/* structure strip — the section currently on air */}
        {cur && cur.sections && cur.sections.length > 1 && (
          <div className="mt-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
              Structure
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cur.sections.map((s, i) => {
                const elapsed = clock / 1000 - cur.started_at;
                const active = elapsed >= s.start_s && elapsed < s.start_s + s.dur_s;
                return (
                  <span key={i} className={`chip !py-0.5 !text-[11px] ${active ? "chip-accent" : ""}`}>
                    {s.name}
                    {active ? ` · ${s.drums}` : ""}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* chords */}
        {cur && (
          <div className="mt-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
              Chords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cur.chords.slice(0, 16).map((c, i) => (
                <span key={i} className="chip !py-0.5 !text-[11px]">{c}</span>
              ))}
              {cur.chords.length > 16 && (
                <span className="chip !py-0.5 !text-[11px] text-ink-3">
                  +{cur.chords.length - 16} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* visualizer */}
        <canvas ref={canvasRef} className="w-full h-24 mt-5 rounded-lg bg-page border border-line" />

        {/* volume */}
        <div className="flex items-center gap-3 mt-4">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-ink-3">
            <path d="M1.5 5v4h2.5L7.5 12V2L4 5H1.5z" strokeLinejoin="round" fill="currentColor" stroke="none" />
            <path d="M9.5 5a3 3 0 010 4M11 3.5a5 5 0 010 7" strokeLinecap="round" />
          </svg>
          <input
            type="range"
            className="slider flex-1"
            style={{ "--fill": `${volume * 100}%` } as React.CSSProperties}
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
          />
        </div>
      </div>

      {error && (
        <div className="card border border-bad-tint p-4 mt-5 text-[13px] text-bad">{error}</div>
      )}

      {/* up next + recently played */}
      <div className="grid sm:grid-cols-2 gap-5 mt-5">
        <div className="card p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-3">
            Up next
          </p>
          {now && now.upcoming.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {now.upcoming.map((u, i) => (
                <li key={u.seed} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ink-3 w-4">{i + 1}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />
                  <span className="text-[13px] truncate">{u.name}</span>
                  <span className="font-mono text-[11px] text-ink-3 ml-auto shrink-0">
                    {u.key} · {u.bpm}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-ink-3">Computing the schedule…</p>
          )}
        </div>
        <div className="card p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-3">
            Recently played
          </p>
          {now && now.history.length > 1 ? (
            <ul className="flex flex-col gap-2.5">
              {now.history.slice(1, 6).map((h, i) => (
                <li key={`${h.seed}-${i}`} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ink-3 w-4">{i + 1}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-line-strong shrink-0" />
                  <span className="text-[13px] truncate text-ink-2">{h.name}</span>
                  <span className="font-mono text-[11px] text-ink-3 ml-auto shrink-0">
                    {h.key} · {h.bpm}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-ink-3">The DJ is warming up…</p>
          )}
        </div>
      </div>

      <p className="text-center text-[12px] text-ink-3 mt-8 font-mono">
        same seed → same track · music21 + numpy + pedalboard
      </p>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src="/api/radio" preload="none" className="hidden" />
    </main>
  );
}
