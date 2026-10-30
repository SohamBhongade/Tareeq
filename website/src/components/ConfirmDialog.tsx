"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";

export function ConfirmDialog({
  open, title, body, confirmLabel, tone = "olive", busy, onConfirm, onCancel,
}: {
  open: boolean; title: string; body: React.ReactNode; confirmLabel: string;
  tone?: "olive" | "danger"; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      className="m-auto w-[min(92vw,440px)] rounded-[24px] border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-2">{body}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-ink/[0.05] disabled:opacity-50">
            {t("common.cancel")}
          </button>
          <button
            type="button" onClick={onConfirm} disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${tone === "danger" ? "bg-critical text-on-fill" : "bg-fill text-on-fill hover:bg-fill-hover"}`}
          >
            {busy ? t("common.working") : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
