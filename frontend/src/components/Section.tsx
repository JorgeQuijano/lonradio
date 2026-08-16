/* Section card — the signature beautifului layout: numbered header,
   subtitle, live demo area, and a Copy code / View code-style footer toggle. */

import { useState, type ReactNode } from "react";

export function Section({
  num,
  title,
  subtitle,
  code,
  children,
}: {
  num: string;
  title: string;
  subtitle: string;
  code?: string;
  children: ReactNode;
}) {
  const [showCode, setShowCode] = useState(false);
  return (
    <section id={`sec-${num}`} className="card scroll-mt-24">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
        <div className="flex items-start gap-4">
          <span className="font-mono text-[13px] text-ink-3 pt-1">{num}</span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
            <p className="text-[13px] text-ink-2 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {code && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost !py-1.5 !px-3 !text-[12px]"
              onClick={() => navigator.clipboard?.writeText(code).catch(() => {})}
            >
              Copy params
            </button>
            <button
              type="button"
              className={`btn btn-ghost !py-1.5 !px-3 !text-[12px] ${showCode ? "!text-accent-ink" : ""}`}
              onClick={() => setShowCode((v) => !v)}
            >
              {showCode ? "Hide code" : "View code"}
            </button>
          </div>
        )}
      </header>
      <div className="p-5">{children}</div>
      {code && showCode && (
        <pre className="mx-5 mb-5 p-4 rounded-lg bg-page border border-line overflow-x-auto text-[12px] leading-relaxed font-mono text-ink-2">
          {code}
        </pre>
      )}
    </section>
  );
}
