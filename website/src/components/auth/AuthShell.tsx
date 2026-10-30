import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { APP_NAME, APP_NAME_AR, LogoMark } from "@/components/LogoMark";
import { LiveRoads } from "@/app/login/LiveRoads";
import { WordSwap } from "@/app/login/WordSwap";
import { getI18n } from "@/lib/i18n/server";
import type { I18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguagePrompt";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The picture on the left of the sign-in card. Drop a photo into
 * public/brand/ named login.jpg (or .png / .webp) and it shows up
 * automatically; until then a branded panel is shown instead.
 */
function loginPhoto(): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    if (existsSync(path.join(process.cwd(), "public", "brand", `login.${ext}`))) return `/brand/login.${ext}`;
  }
  return null;
}

const STEPS = [
  ["auth.steps1", "auth.steps1d"],
  ["auth.steps2", "auth.steps2d"],
  ["auth.steps3", "auth.steps3d"],
] as const;

/** The road from the logo, with its centre dashes flowing towards you. */
function RoadMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 60) / 80} viewBox="10 20 80 60" aria-hidden>
      <g transform="translate(0 4)" fill="#c3f832">
        <path d="M47.6 19.5 C36.5 24.5 18.5 44 13.6 70.6 Q13.2 73 15.6 73 L27.6 73 Q29.6 73 29.9 71 C32.8 50.5 39.6 31.5 47.6 19.5 Z" />
        <path d="M52.4 19.5 C63.5 24.5 81.5 44 86.4 70.6 Q86.8 73 84.4 73 L72.4 73 Q70.4 73 70.1 71 C67.2 50.5 60.4 31.5 52.4 19.5 Z" />
        <path d="M50 28 L50 73" stroke="#c3f832" strokeWidth="2.8" strokeDasharray="5 6" className="lr-mark-dash" />
      </g>
    </svg>
  );
}

function BrandPanel({ i18n }: { i18n: I18n }) {
  const { t } = i18n;
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-brand p-10 text-white short:p-8">
      <LiveRoads />
      <div className="rise relative flex items-center gap-3 text-[24px] font-semibold tracking-tight">
        <RoadMark />
        <WordSwap en={APP_NAME} ar={APP_NAME_AR} />
      </div>
      <div className="relative">
        <h2 className="rise max-w-xs text-[34px] font-semibold leading-[1.1] tracking-tight short:text-[30px]" style={{ animationDelay: "120ms" }}>
          {t("app.slogan1")} <span className="text-lime">{t("app.slogan2")}</span>
        </h2>
        <ul className="mt-7 space-y-3 short:mt-5">
          {STEPS.map(([k, d], i) => (
            <li key={k} className="rise flex items-center gap-3 text-sm text-white/75" style={{ animationDelay: `${260 + i * 110}ms` }}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lime text-xs font-bold text-on-lime">{i + 1}</span>
              <span><b className="font-semibold text-white">{t(k)}</b> — {t(d)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="rise relative text-xs text-white/45" style={{ animationDelay: "600ms" }}>{t("app.tagline")}</p>
    </div>
  );
}

/**
 * The two-part card used by sign-in, sign-up and forgot-password:
 * the animated brand panel on one side, the form on the other.
 */
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  const photo = loginPhoto();
  const i18n = await getI18n();
  const { t } = i18n;
  const name = i18n.ar ? APP_NAME_AR : APP_NAME;
  return (
    <main className="grid min-h-dvh place-items-center bg-surface sm:bg-transparent sm:p-6 lg:h-dvh">
      <div className="panel grid min-h-dvh w-full max-w-[1040px] overflow-hidden max-sm:!rounded-none max-sm:!shadow-none sm:min-h-0 sm:!rounded-[28px] lg:h-full lg:max-h-[740px] lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden lg:block">
          {photo ? (
            <>
              <Image src={photo} alt="" fill priority sizes="540px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-8 pt-24 text-white">
                <div className="text-2xl font-semibold leading-tight">{t("app.slogan1")} <span className="text-lime">{t("app.slogan2")}</span></div>
                <div className="mt-1 text-sm text-white/75">{t("app.tagline")}</div>
              </div>
            </>
          ) : (
            <BrandPanel i18n={i18n} />
          )}
        </section>

        <section className="thin-scroll flex flex-col justify-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-12 sm:py-10 lg:overflow-y-auto lg:px-14 short:py-6">
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <span className="text-[19px] font-semibold tracking-tight">{name}</span>
            <ThemeToggle wide className="ms-auto" />
            <LanguageToggle wide />
          </div>
          <h1 className="mt-10 text-[28px] font-semibold tracking-tight short:mt-6 short:text-[25px]">{title}</h1>
          <p className="mt-1 text-sm text-ink-3">{subtitle}</p>
          {children}
          <p className="mt-8 text-center text-xs text-ink-4 short:mt-5">© {name} · {t("common.rak")}</p>
        </section>
      </div>
    </main>
  );
}
