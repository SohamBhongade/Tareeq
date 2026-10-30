import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";

export const APP_NAME = "Tareeq";
export const APP_NAME_AR = "طريق";

/**
 * Your logo file. Save it as public/brand/tareeq-logo.png (or .svg / .webp),
 * square, ideally 1024×1024. It then appears in the sidebar, the phone top bar
 * and the sign-in page automatically — no code changes needed.
 */
function logoFile(): string | null {
  for (const ext of ["svg", "png", "webp"]) {
    if (existsSync(path.join(process.cwd(), "public", "brand", `tareeq-logo.${ext}`))) return `/brand/tareeq-logo.${ext}`;
  }
  return null;
}

/** App icon: your logo if it's there, otherwise a simple lime "t" on black. */
export function LogoMark({ size = 48 }: { size?: number }) {
  const file = logoFile();
  if (file) {
    return <Image src={file} alt={`${APP_NAME} logo`} width={size} height={size} priority className="shrink-0 rounded-[24%] object-contain" />;
  }
  return (
    <span
      role="img"
      aria-label={`${APP_NAME} logo`}
      className="grid shrink-0 place-items-center rounded-[24%] bg-[#292928] font-semibold leading-none text-lime"
      style={{ width: size, height: size, fontSize: size * 0.56 }}
    >
      <span style={{ marginTop: -size * 0.06 }}>t</span>
    </span>
  );
}
