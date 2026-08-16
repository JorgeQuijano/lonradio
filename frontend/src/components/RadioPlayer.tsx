/* Radio 24/7 — live stream player with now-playing ticker. */

import { useEffect, useRef, useState } from "react";
import { Chip } from "./controls";

interface TrackMeta {
  name: string;
  seed: number;
  key: string;
  bpm: number;
  bars: number;
  chords: string[];
  duration_s: number;
}

interface RadioNow {
  current: TrackMeta | null;
  history: TrackMeta[];
  listeners: number;
  uptime_s: number;
  tracks_played: number;
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState<RadioNow | null>(null);
  const [liveError, setLiveError] = useState(false);

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
        /* backend unreachable — keep last state */
      }
    };
    void tick();
    const id = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().catch(() => setLiveError(true));
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const onAir = now?.current != null;
  const cur = now?.current;

  return (
    <div className="card p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
            Lonradio 24/7
          </p>
          <span className="chip chip-accent !py-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${playing ? "bg-good animate-pulse" : "bg-accent-ink"}`} />
            {playing ? "LIVE" : "STREAM"}
          </span>
        </div>
        <Chip>{now ? `${now.listeners} listener${now.listeners === 1 ? "" : "s"}` : "—"}</Chip>
        <a
          href="/radio"
          className="chip hover:text-ink hover:border-line-strong transition-colors"
        >
          full page ↗
        </a>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="w-11 h-11 rounded-full grid place-items-center bg-accent text-black shadow-btn hover:brightness-110 transition-all active:scale-95"
          onClick={toggle}
          aria-label={playing ? "Pause stream" : "Play stream"}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
              <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2.5 1.5v9l7.5-4.5-7.5-4.5z" />
            </svg>
          )}
        </button>
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
            {onAir ? "On air" : "Broadcasting…"}
          </p>
          <p className="text-[14px] font-semibold truncate">
            {cur ? cur.name : "First track rendering…"}
          </p>
        </div>
      </div>

      {cur && (
        <div className="fade-up">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="chip">{cur.key}</span>
            <span className="chip">{cur.bpm} bpm</span>
            <span className="chip">seed {cur.seed}</span>
            {now && (
              <span className="chip">
                {fmtUptime(now.uptime_s)} on air · {now.tracks_played} tracks
              </span>
            )}
          </div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
            Chords
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cur.chords.map((c, i) => (
              <span key={i} className="chip !py-0.5 !text-[11px]">{c}</span>
            ))}
          </div>
          {now && now.history.length > 1 && (
            <div className="mt-3 pt-3 border-t border-line">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">
                Recently played
              </p>
              <ul className="flex flex-col gap-1">
                {now.history.slice(1, 5).map((h, i) => (
                  <li key={i} className="flex justify-between gap-2 text-[12px] text-ink-2">
                    <span className="truncate">{h.name}</span>
                    <span className="font-mono text-ink-3 shrink-0">{h.key} · {h.bpm}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {liveError && (
        <p className="text-[12px] text-bad">
          Stream failed to start — is the backend radio running?
        </p>
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src="/api/radio" preload="none" className="hidden" />
    </div>
  );
}
