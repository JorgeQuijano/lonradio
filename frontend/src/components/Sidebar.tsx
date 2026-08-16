/* Sidebar — beautifului's "Components" nav, here with the studio sections
   plus one-click presets. */

import type { Presets, TrackParams } from "../types";

const NAV = [
  { id: "sec-01", label: "Harmony" },
  { id: "sec-02", label: "Bass" },
  { id: "sec-03", label: "Drums" },
  { id: "sec-04", label: "Melody" },
  { id: "sec-05", label: "Tone & Seed" },
  { id: "sec-06", label: "FX & Master" },
];

export function Sidebar({
  presets,
  onPreset,
}: {
  presets: Presets;
  onPreset: (p: Partial<TrackParams>) => void;
}) {
  return (
    <nav className="hidden lg:block w-52 shrink-0">
      <div className="sticky top-20 flex flex-col gap-6">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-2 px-1">
            Studio
          </p>
          <ul className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="block px-2 py-1.5 rounded-md text-[13px] text-ink-2 hover:text-ink hover:bg-hover transition-colors"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3 mb-2 px-1">
            Presets
          </p>
          <ul className="flex flex-col gap-0.5">
            {Object.entries(presets).map(([name, p]) => (
              <li key={name}>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded-md text-[13px] text-ink-2 hover:text-ink hover:bg-hover transition-colors"
                  onClick={() => onPreset(p)}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-1">
          <p className="text-[12px] text-ink-3 leading-relaxed">
            Same seed + params = same track, every time. Tweak a knob, hit
            generate.
          </p>
        </div>
      </div>
    </nav>
  );
}
