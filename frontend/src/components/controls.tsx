/* Shared form controls, styled on beautifului's tokens: hairline borders,
   8px control radius, inset fields, mono labels. */

import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-3">{label}</span>
      {children}
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select className="control w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-3">{label}</span>
        <span className="font-mono text-[11px] text-accent-ink tabular-nums">
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        className="slider"
        style={{ "--fill": `${pct}%` } as React.CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function SegmentedField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-3">{label}</span>
      <div className="segmented">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={o === value ? "active" : ""}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chip({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <span className={`chip ${accent ? "chip-accent" : ""}`}>{children}</span>;
}
