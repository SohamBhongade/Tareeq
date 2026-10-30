// Badges earned automatically as a resident's EXP grows.

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  minExp: number;
  blurb: string;
  /** Tailwind classes for the badge medallion. */
  tone: string;
}

export const BADGES: Badge[] = [
  { id: "newcomer", name: "Newcomer", emoji: "🌱", minExp: 0, blurb: "Joined the community", tone: "from-emerald-300/30 to-emerald-700/20 border-emerald-400/40" },
  { id: "spotter", name: "Spotter", emoji: "👀", minExp: 150, blurb: "Started reporting issues", tone: "from-sky-300/30 to-sky-700/20 border-sky-400/40" },
  { id: "helper", name: "Helper", emoji: "🤝", minExp: 300, blurb: "Helping keep streets clean", tone: "from-teal-300/30 to-teal-700/20 border-teal-400/40" },
  { id: "guardian", name: "Street Guardian", emoji: "🛡️", minExp: 500, blurb: "Watches over the neighbourhood", tone: "from-indigo-300/30 to-indigo-700/20 border-indigo-400/40" },
  { id: "hero", name: "Neighbourhood Hero", emoji: "🏅", minExp: 1000, blurb: "A name people recognise", tone: "from-orange-300/30 to-orange-700/20 border-orange-400/40" },
  { id: "champion", name: "District Champion", emoji: "🏆", minExp: 2000, blurb: "Top contributor in the district", tone: "from-amber-300/35 to-amber-700/20 border-amber-400/50" },
  { id: "city-guardian", name: "City Guardian", emoji: "🌟", minExp: 3500, blurb: "Keeps Ras Al Khaimah running", tone: "from-yellow-200/40 to-yellow-600/20 border-yellow-300/60" },
  { id: "legend", name: "RAK Legend", emoji: "👑", minExp: 5000, blurb: "The city's finest", tone: "from-yellow-200/50 to-amber-500/30 border-yellow-300/80" },
];

export function currentBadge(exp: number): Badge {
  let best = BADGES[0];
  for (const b of BADGES) if (exp >= b.minExp) best = b;
  return best;
}

export function nextBadge(exp: number): Badge | null {
  return BADGES.find((b) => b.minExp > exp) ?? null;
}

export function earnedBadges(exp: number): Badge[] {
  return BADGES.filter((b) => exp >= b.minExp);
}
