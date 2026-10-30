import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { cookies } from "next/headers";
import { preconnect } from "react-dom";
import { THEME_BAR, THEME_COOKIE, parseTheme } from "@/lib/theme";

async function getTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const { t, ar } = await getI18n();
  return {
    title: `${ar ? "طريق" : "Tareeq"} — ${t("app.tagline")}`,
    description: ar
      ? "صوّر مشكلة في الشارع، ودع الذكاء الاصطناعي يصنّفها، وتابع إصلاحها على خريطة رأس الخيمة المباشرة."
      : "Snap a street issue, let AI triage it, and track the fix on a live map of Ras Al Khaimah.",
  };
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: THEME_BAR[await getTheme()], width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ lang, dir }, theme] = await Promise.all([getI18n(), getTheme()]);
  // Start talking to the map servers early so the map appears sooner.
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  return (
    <html lang={lang} dir={dir} data-theme={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <I18nProvider lang={lang}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
