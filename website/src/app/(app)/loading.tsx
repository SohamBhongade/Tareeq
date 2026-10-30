"use client";
import { useI18n } from "@/lib/i18n/client";

/** Shown instantly while a page's data loads, so clicks never feel stuck. */
export default function Loading() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label={t("loading")}>
      <span className="spin size-7 rounded-full border-[3px] border-ink/10 border-t-ink" />
    </div>
  );
}
