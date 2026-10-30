"use client";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n/client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const { t } = useI18n();
  const db = /Database unavailable|querySrv|ENOTFOUND|ECONNREFUSED|MongoServerSelectionError|Server selection timed out/i.test(error.message);
  return (
    <div className="mx-auto mt-16 max-w-lg text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-critical/15 text-critical"><Icon name="alert" size={28} /></span>
      <h1 className="mt-5 text-xl font-semibold">{db ? t("err.db") : t("err.generic")}</h1>
      <p className="mt-2 text-sm text-ink-2">
        {db ? t("err.dbBody") : t("err.genericBody")}
      </p>
      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-elevated p-3 text-start text-xs text-ink-3">{error.message}</pre>
      )}
      <button onClick={reset} className="mt-6 rounded-xl bg-fill px-5 py-2.5 text-sm font-semibold text-on-fill hover:bg-fill-hover">{t("err.tryAgain")}</button>
    </div>
  );
}
