/*
 * The street map behind the sign-in panel: faint, still roads with soft
 * light-green streaks racing along them, like traffic at night.
 * Pure SVG + CSS — no JavaScript.
 */

const W = 400;
const H = 520;

const HORIZONTAL = [
  { y: 90, a: 30 },
  { y: 205, a: 34 },
  { y: 330, a: 38 },
  { y: 450, a: 30 },
];
const VERTICAL = [
  { x: 60, a: 40 },
  { x: 210, a: 36 },
  { x: 340, a: 30 },
];

const hPath = (y: number, a: number) =>
  `M-30 ${y} C 80 ${y - a}, 140 ${y + a * 1.6}, 230 ${y + a * 0.6} S 380 ${y - a * 1.4}, 440 ${y - a * 0.3}`;
const vPath = (x: number, a: number) =>
  `M${x} -30 C ${x + a} 120, ${x - a * 1.2} 260, ${x + a * 1.3} 380 S ${x + a * 0.8} 500, ${x - a * 0.5} 560`;

const ROADS = [...HORIZONTAL.map((r) => hPath(r.y, r.a)), ...VERTICAL.map((r) => vPath(r.x, r.a))];

export function LiveRoads() {
  return (
    <svg className="live-roads absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <filter id="lr-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="lr-spot" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#c3f832" stopOpacity="0.14" />
          <stop offset="1" stopColor="#c3f832" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft lime glow that drifts around */}
      <circle className="lr-spot" cx="120" cy="140" r="190" fill="url(#lr-spot)" />

      {/* Still roads */}
      <g fill="none" stroke="#c3f832" strokeWidth="1.1" opacity="0.14">
        {ROADS.map((d, i) => <path key={i} d={d} />)}
      </g>

      {/* Light streaks racing along them */}
      <g fill="none" stroke="#d8fb7a" strokeWidth="1.7" strokeLinecap="round" filter="url(#lr-glow)">
        {ROADS.map((d, i) => (
          <path key={i} d={d} pathLength={1000} className="lr-pulse"
            style={{ animationDuration: `${6 + (i % 4) * 2.2}s`, animationDelay: `${-i * 1.7}s`, animationDirection: i % 2 ? "reverse" : "normal" }} />
        ))}
      </g>
    </svg>
  );
}
