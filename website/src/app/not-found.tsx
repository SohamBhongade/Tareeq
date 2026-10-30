import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="text-5xl font-bold text-olive">404</div>
        <p className="mt-2 text-ink-2">{t("err.notFound")}</p>
        <Link href="/" className="mt-5 inline-block rounded-xl bg-fill px-4 py-2.5 text-sm font-semibold text-on-fill">{t("err.backToMap")}</Link>
      </div>
    </main>
  );
}
