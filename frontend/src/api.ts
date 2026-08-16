import type { GenerateResult, Presets, TrackParams } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body?.detail?.errors?.join("; ") || JSON.stringify(body?.detail) || detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function generateTrack(params: TrackParams): Promise<GenerateResult> {
  return req<GenerateResult>("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function fetchPresets(): Promise<Presets> {
  return req<Presets>("/api/presets");
}

export function fetchOptions(): Promise<Record<string, string[]>> {
  return req<Record<string, string[]>>("/api/options");
}
