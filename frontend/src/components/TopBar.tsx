/* Top bar: wordmark + theme selector (beautifului's light/dark toggle,
   extended to five themes). */

import { useEffect, useRef, useState } from "react";
import { applyTheme, currentTheme, THEMES } from "../themes";

export function TopBar() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(currentTheme());
  const ref = useRef<HTMLDivElement>(null);
  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/80 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 group">
          <span className="w-6 h-6 rounded-md bg-canvas border border-line grid place-items-center group-hover:border-line-strong transition-colors">
            <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          </span>
          <span className="font-semibold tracking-tight text-[15px]">
            lonradio<span className="text-ink-3 font-normal">/studio</span>
          </span>
        </a>

        <div className="flex items-center gap-2" ref={ref}>
          <a
            href="https://github.com/JorgeQuijano/lonradio"
            target="_blank"
            rel="noreferrer"
            className="chip hidden sm:inline-flex hover:text-ink transition-colors"
          >
            github ↗
          </a>
          <div className="relative">
            <button
              type="button"
              className="btn btn-ghost !py-1.5 !px-2.5 !text-[12px]"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="listbox"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-line-strong"
                style={{ background: active.swatch[1] }}
              />
              <span className="capitalize">{active.label}</span>
              <svg width="9" height="6" viewBox="0 0 10 6" className={open ? "rotate-180" : ""}>
                <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            {open && (
              <div
                role="listbox"
                className="absolute right-0 mt-2 w-44 p-1.5 rounded-lg bg-surface border border-line shadow-overlay fade-up"
              >
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={t.id === theme}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-left transition-colors ${
                      t.id === theme ? "bg-accent-tint text-accent-ink" : "text-ink-2 hover:text-ink hover:bg-hover"
                    }`}
                    onClick={() => {
                      applyTheme(t.id);
                      setTheme(t.id);
                      setOpen(false);
                    }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-line-strong" style={{ background: t.swatch[1] }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
