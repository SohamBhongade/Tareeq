import { avatarUrl, getAvatar, RARITY_STYLE } from "@/lib/avatars";

/** A user's avatar, with a coloured ring for rare / epic / legendary ones. */
export function AvatarImg({ id, size = 40, ring = true, className = "" }: { id: string | null | undefined; size?: number; ring?: boolean; className?: string }) {
  const a = getAvatar(id);
  const ringClass = ring && a.rarity !== "free" ? `ring-2 ${RARITY_STYLE[a.rarity].ring}` : "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl(a.id)}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-[28%] bg-surface-high object-cover ${ringClass} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
