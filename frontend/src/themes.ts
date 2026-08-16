/* Theme definitions — swatches + which themes force the .dark class. */

export interface Theme {
  id: string;
  label: string;
  swatch: [string, string]; // page bg + accent, for the menu
  dark: boolean;
}

export const THEMES: Theme[] = [
  { id: "dark", label: "Dark", swatch: ["#17181a", "#3d9aff"], dark: true },
  { id: "light", label: "Light", swatch: ["#fafafb", "#0285ff"], dark: false },
  { id: "midnight", label: "Midnight", swatch: ["#0a0d12", "#58a6ff"], dark: true },
  { id: "cassette", label: "Cassette", swatch: ["#161210", "#f59e0b"], dark: true },
  { id: "synthwave", label: "Synthwave", swatch: ["#0e0817", "#d946ef"], dark: true },
];

const KEY = "lonradio.theme";

export function currentTheme(): string {
  return localStorage.getItem(KEY) || "dark";
}

export function applyTheme(id: string) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  const root = document.documentElement;
  root.setAttribute("data-theme", t.id);
  root.classList.toggle("dark", t.dark);
  localStorage.setItem(KEY, t.id);
}
