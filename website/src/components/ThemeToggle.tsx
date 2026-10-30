"use client";
import { useEffect, useState, type MouseEvent } from "react";
import { useI18n } from "@/lib/i18n/client";
import { THEME_BAR, THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return parseTheme(document.documentElement.dataset.theme);
}

/** Current theme; updates live when it's switched (used by the maps). */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(readTheme());
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

function apply(next: Theme) {
  const root = document.documentElement;
  root.dataset.theme = next;
  root.style.colorScheme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_BAR[next]);
}

/**
 * Switches theme with a circular "reveal" that grows from the button
 * (View Transitions API). Browsers without it just switch instantly.
 */
function switchTheme(next: Theme, e?: MouseEvent<HTMLButtonElement>) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce) return apply(next);

  const r = e?.currentTarget.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 2 : innerHeight / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  document.documentElement.classList.add("theme-anim");
  const vt = doc.startViewTransition(() => apply(next));
  vt.ready
    .then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
      ).finished,
    )
    .catch(() => {})
    .finally(() => document.documentElement.classList.remove("theme-anim"));
}

/** Sun / moon button. `wide` = pill with a label (phones, sign-in page). */
export function ThemeToggle({ className = "", wide = false, compact = false }: { className?: string; wide?: boolean; compact?: boolean }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => setTheme(readTheme()), []);
  const dark = theme === "dark";
  const label = dark ? t("theme.toLight") : t("theme.toDark");

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={dark}
      onClick={(e) => {
        const next: Theme = dark ? "light" : "dark";
        setTheme(next);
        switchTheme(next, e);
      }}
      className={`grid place-items-center text-ink-2 transition-colors hover:bg-surface-high hover:text-ink ${
        wide ? "size-9 rounded-full border border-line bg-surface" : compact ? "size-10 rounded-full" : "size-11 rounded-[14px]"
      } ${className}`}
    >
      <span className="relative block size-[19px]">
        {/* sun */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
          className={`absolute inset-0 transition-all duration-500 ${dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
        {/* moon */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
          className={`absolute inset-0 transition-all duration-500 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} aria-hidden>
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      </span>
    </button>
  );
}
