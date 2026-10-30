// Small inline icon set (stroke icons, 24px grid) — no icon font needed.
const PATHS: Record<string, string> = {
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5 4.5L9 14.7m6.5 4.8-.5-4.8M8.5 19.5 12 18l3.5 1.5L15 21l-3-1-3 1-.5-1.5Z",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  pin: "M12 21s-7-6.3-7-12a7 7 0 1 1 14 0c0 5.7-7 12-7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  target: "M12 3v3m0 12v3M3 12h3m12 0h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  shield: "M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z",
  alert: "M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  check: "M5 12.5 10 17 19 7",
  hands: "M7 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5.5a1.5 1.5 0 0 1 3 0V10m0 0V6.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.5-2L2.5 15a1.6 1.6 0 0 1 2.3-2.2L7 15",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6 6-6-6 6-6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  image: "M4 5h16v14H4V5Zm0 11 4-4 4 4 3-3 5 5M15 9.5h.01",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  x: "M6 6l12 12M18 6 6 18",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4 4v3m-4 3h8m-6-3h4",
  home: "M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z",
  grid: "M4 4h6.5v6.5H4V4Zm9.5 0H20v6.5h-6.5V4ZM4 13.5h6.5V20H4v-6.5Zm9.5 0H20V20h-6.5v-6.5Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4",
  locate: "M12 2v3m0 14v3M2 12h3m14 0h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-3.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  plus: "M12 5v14M5 12h14",
  chevron: "m6 9 6 6 6-6",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  eye: "M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.8M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19c1.8 0 3.4-.6 4.7-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2",
  external: "M14 4h6v6m0-6-9 9M18 14v6H4V6h6",
  layers: "m12 4 9 5-9 5-9-5 9-5Zm-9 9.5 9 5 9-5",
  bolt: "M13 3 4 14h7l-1 7 9-11h-7l1-7Z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4a6 6 0 0 1 3 5.6",
};

export function Icon({ name, size = 20, className = "" }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={PATHS[name] ?? PATHS.x} />
    </svg>
  );
}
