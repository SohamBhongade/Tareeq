// Avatar catalog. Images live in /public/avatars and were generated with
// DiceBear (https://dicebear.com) using CC0 / free-for-commercial-use styles:
// Lorelei, Notionists, Thumbs, Open Peeps, Pixel Art (CC0) and Bottts
// (Pablo Stanley, free for personal and commercial use).

export type Rarity = "free" | "rare" | "epic" | "legendary";

export interface Avatar {
  id: string;
  name: string;
  rarity: Rarity;
  /** EXP needed to unlock. 0 = available to everyone. */
  unlockExp: number;
}

export const AVATARS: Avatar[] = [
  // 16 free avatars
  { id: "lorelei-1", name: "Mariam", rarity: "free", unlockExp: 0 },
  { id: "lorelei-2", name: "Omar", rarity: "free", unlockExp: 0 },
  { id: "lorelei-3", name: "Layla", rarity: "free", unlockExp: 0 },
  { id: "lorelei-4", name: "Yousef", rarity: "free", unlockExp: 0 },
  { id: "lorelei-5", name: "Noor", rarity: "free", unlockExp: 0 },
  { id: "notion-1", name: "Hamdan", rarity: "free", unlockExp: 0 },
  { id: "notion-2", name: "Aisha", rarity: "free", unlockExp: 0 },
  { id: "notion-3", name: "Khalid", rarity: "free", unlockExp: 0 },
  { id: "notion-4", name: "Sara", rarity: "free", unlockExp: 0 },
  { id: "thumbs-1", name: "Dune", rarity: "free", unlockExp: 0 },
  { id: "thumbs-2", name: "Wave", rarity: "free", unlockExp: 0 },
  { id: "thumbs-3", name: "Palm", rarity: "free", unlockExp: 0 },
  { id: "thumbs-4", name: "Coral", rarity: "free", unlockExp: 0 },
  { id: "peeps-1", name: "Saeed", rarity: "free", unlockExp: 0 },
  { id: "peeps-2", name: "Fatima", rarity: "free", unlockExp: 0 },
  { id: "peeps-3", name: "Zayed", rarity: "free", unlockExp: 0 },
  // 8 unlockable with EXP
  { id: "pixel-1", name: "Pixel Scout", rarity: "rare", unlockExp: 150 },
  { id: "pixel-2", name: "Pixel Ranger", rarity: "rare", unlockExp: 300 },
  { id: "bot-1", name: "Fix-Bot", rarity: "rare", unlockExp: 500 },
  { id: "bot-2", name: "Sweep-Bot", rarity: "epic", unlockExp: 750 },
  { id: "pixel-3", name: "Pixel Guardian", rarity: "epic", unlockExp: 1000 },
  { id: "bot-3", name: "Mayor-Bot", rarity: "epic", unlockExp: 1500 },
  { id: "lorelei-gold", name: "Golden Falcon", rarity: "legendary", unlockExp: 2500 },
  { id: "bot-gold", name: "RAK Legend", rarity: "legendary", unlockExp: 5000 },
];

export const DEFAULT_AVATAR = "lorelei-1";

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

export function getAvatar(id: string | null | undefined): Avatar {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_AVATAR)!;
}

export function avatarUrl(id: string | null | undefined): string {
  return `/avatars/${getAvatar(id).id}.svg`;
}

export function isUnlocked(avatar: Avatar, exp: number): boolean {
  return exp >= avatar.unlockExp;
}

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; text: string }> = {
  free: { label: "Free", ring: "ring-line", text: "text-ink-3" },
  rare: { label: "Rare", ring: "ring-sky-400/70", text: "text-sky-300" },
  epic: { label: "Epic", ring: "ring-fuchsia-400/70", text: "text-fuchsia-300" },
  legendary: { label: "Legendary", ring: "ring-amber-400", text: "text-amber-300" },
};
