/** Light / dark appearance. Stored in a cookie so the server renders the right one (no flash). */
export type Theme = "light" | "dark";

export const THEME_COOKIE = "tareeq_theme";

export function parseTheme(v: unknown): Theme {
  return v === "dark" ? "dark" : "light";
}

/** Browser bar colour on phones, per theme (matches --color-night). */
export const THEME_BAR: Record<Theme, string> = { light: "#f1f1ef", dark: "#0e0e0d" };
