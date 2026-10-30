"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LiveMap from "@/components/LiveMap";
import { Icon } from "@/components/Icon";
import { SeverityChip, StatusChip } from "@/components/Chips";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { api, fileToResizedDataUrl } from "@/components/imageUtil";
import { useI18n } from "@/lib/i18n/client";
import { isVolunteerEligible, priorityFromSeverity } from "@/lib/categories";
import { resolvedDeleteDate, RESOLVED_KEEP_DAYS, type Report, type SessionUser } from "@/lib/types";

export function IssueDetail({ initial, user }: { initial: Report; user: SessionUser }) {
  const router = useRouter();
  const toast = useToast();
  const i18n = useI18n();
  const { t, cat, timeAgo } = i18n;
  const [r, setR] = useState(initial);
  const [dialog, setDialog] = useState<null | "volunteer" | "verify" | "resolve" | "reject">(null);
  const [busy, setBusy] = useState(false);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofVersion, setProofVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = user.role === "cityAdmin";
  const mine = r.assignedVolunteerId === user.username;
  const locked = !isVolunteerEligible(r.severity);
  const confirmCount = r.confirmedBy.length;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); router.refresh(); }
    catch (e) { toast((e as Error).message, "warn"); }
    finally { setBusy(false); setDialog(null); }
  }

  const admin = (action: "dispatch" | "resolve" | "reject", done: string) => run(async () => {
    const { report } = await api<{ report: Report }>(`/api/reports/${r.id}/admin`, { json: { action } });
    setR(report);
    toast(done);
  });

  const volunteer = () => run(async () => {
    const { report } = await api<{ report: Report }>(`/api/reports/${r.id}/volunteer`, { method: "POST" });
    setR(report);
    toast(t("issue.toastVolunteer"));
  });

  const verify = () => run(async () => {
    const { report, volunteer } = await api<{ report: Report; volunteer: string | null }>(`/api/reports/${r.id}/verify`, { method: "POST" });
    setR(report);
    toast(volunteer ? t("issue.toastResolvedExp", { name: volunteer }) : t("issue.toastResolved"));
  });

  async function uploadProof(file: File | undefined) {
    if (!file) return;
    let dataUrl: string;
    try { dataUrl = await fileToResizedDataUrl(file); }
    catch (e) { toast((e as Error).message, "error"); return; }
    setProofPreview(dataUrl);
    await run(async () => {
      const { report } = await api<{ report: Report }>(`/api/reports/${r.id}/proof`, { json: { imageBase64: dataUrl } });
      setR(report);
      setProofVersion((v) => v + 1);
      toast(t("issue.toastProof"));
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  const photo = r.hasImage ? `/api/reports/${r.id}/image` : null;
  const sized = (url: string | null, w: number) => (url && url.startsWith("/api/") ? `${url}${url.includes("?") ? "&" : "?"}w=${w}` : url);
  const proof = r.hasProof ? `/api/reports/${r.id}/image?kind=proof&v=${proofVersion}` : proofPreview;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/issues" className="-my-2 mb-2 inline-flex items-center gap-1.5 py-2 pe-2 text-sm text-ink-2 hover:text-ink">
        <Icon name="back" size={16} className="rtl:-scale-x-100" /> {t("issue.back")}
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-4">
          <div className="card overflow-hidden">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sized(photo, 1200)!} alt={t("issue.photoAlt", { cat: cat(r.category) })} className="max-h-[440px] w-full object-cover" decoding="async" />
            ) : (
              <div className="grid aspect-[16/9] place-items-center bg-surface-high text-ink-3"><Icon name="image" size={40} /></div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="label flex items-center gap-1.5"><Icon name="sparkle" size={13} className="text-olive" /> {t("report.aiClass")}</span>
              <SeverityChip severity={r.severity} />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{cat(r.category)}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{i18n.desc(r)}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div><div className="label">{t("common.severity")}</div><div className="mt-0.5 font-semibold tabular-nums" dir="ltr">{r.severity} / 10</div></div>
              <div><div className="label">{t("common.priority")}</div><div className="mt-0.5 font-semibold capitalize">{i18n.priority(priorityFromSeverity(r.severity))}</div></div>
              <div><div className="label">{t("common.reported")}</div><div suppressHydrationWarning className="mt-0.5 font-semibold">{timeAgo(r.createdAt)}</div></div>
            </div>
          </div>

          {(r.status === "pending_verification" || r.status === "resolved") && proof && (
            <div className="card p-5">
              <div className="label mb-3">{t("issue.before")}</div>
              <div className="grid grid-cols-2 gap-3">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photo ? <img src={sized(photo, 640)!} alt={t("issue.beforeCap")} className="aspect-[4/3] w-full rounded-xl object-cover" /> : <div className="aspect-[4/3] rounded-xl bg-surface-high" />}
                  <figcaption className="mt-1.5 text-xs text-ink-3">{t("issue.beforeCap")}</figcaption>
                </figure>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sized(proof, 640)!} alt={t("issue.afterAlt")} className="aspect-[4/3] w-full rounded-xl object-cover" />
                  <figcaption className="mt-1.5 text-xs text-ink-3">{t("issue.afterCap")}</figcaption>
                </figure>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="card overflow-hidden">
            <div className="h-56"><LiveMap pin={[r.latitude, r.longitude]} pinSeverity={r.severity} zoom={15} /></div>
            <div className="space-y-2 px-4 py-3.5 text-sm">
              <div className="label">{t("issue.street")}</div>
              <p className="flex items-start gap-2"><Icon name="pin" size={16} className="mt-0.5 shrink-0 text-olive" /><span dir="auto">{r.address}</span></p>
              <p className="flex items-center gap-2 text-xs text-ink-3 tabular-nums"><Icon name="target" size={14} /><span dir="ltr">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</span></p>
            </div>
          </div>

          <div className="card divide-y divide-line px-4">
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-ink-2">{t("common.status")}</span>
              <StatusChip status={r.status} />
            </div>
            {r.reportedBy && (
              <div className="flex items-center justify-between py-3.5 text-sm">
                <span className="text-ink-2">{t("home.reportedBy")}</span>
                <span className="font-semibold">{r.reportedBy === user.username ? t("common.you") : r.reportedBy}</span>
              </div>
            )}
            {confirmCount > 0 && (
              <div className="flex items-center justify-between py-3.5 text-sm">
                <span className="text-ink-2">{t("issue.alsoSeen")}</span>
                <span className="font-semibold">{t("home.residentsN", { n: confirmCount })}</span>
              </div>
            )}
            {r.status !== "open" && r.status !== "resolved" && (
              <div className="flex items-center justify-between py-3.5 text-sm">
                <span className="flex items-center gap-2 text-ink-2"><Icon name="hands" size={16} /> {t("issue.assigned")}</span>
                {r.assignedVolunteerId ? (
                  <span className="rounded-lg bg-lime px-2.5 py-1 font-semibold text-on-lime">
                    {mine ? t("common.you") : r.assignedVolunteerId}
                  </span>
                ) : (
                  <span className="rounded-lg bg-fill px-2.5 py-1 font-semibold text-fill-accent">{t("common.cityCrew")}</span>
                )}
              </div>
            )}
          </div>

          {/* ── resident actions ── */}
          {r.status === "open" && locked && !isAdmin && (
            <div role="note" className="flex items-start gap-2.5 rounded-xl border border-critical/30 bg-critical/10 px-4 py-3.5 text-sm text-critical">
              <Icon name="alert" size={18} className="mt-px shrink-0" />
              {t("issue.critical")}
            </div>
          )}
          {r.status === "open" && !locked && !isAdmin && (
            <button type="button" onClick={() => setDialog("volunteer")} disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-fill py-3.5 font-semibold text-on-fill hover:bg-fill-hover disabled:opacity-50">
              <Icon name="hands" size={18} /> {t("issue.volunteer")}
            </button>
          )}

          {r.status === "in_progress" && mine && (
            <>
              <input ref={fileRef} id="proof" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => uploadProof(e.target.files?.[0])} />
              <label htmlFor="proof" aria-disabled={busy}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-moderate py-3.5 font-semibold text-on-fill hover:brightness-110 ${busy ? "pointer-events-none opacity-60" : ""}`}>
                {busy ? <span className="spin size-4 rounded-full border-2 border-white/30 border-t-white" /> : <Icon name="upload" size={18} />}
                {busy ? t("issue.uploading") : t("issue.submitProof")}
              </label>
              <p className="text-center text-xs text-ink-3">{t("issue.proofHint")}</p>
            </>
          )}

          {r.status === "pending_verification" && !isAdmin && (
            <div className="flex items-center gap-2.5 rounded-xl border border-pending/30 bg-pending/10 px-4 py-3.5 text-sm text-pending">
              <Icon name="clock" size={18} /> {t("issue.awaiting")}
            </div>
          )}

          {/* ── City Admin controls ── */}
          {isAdmin && r.status !== "resolved" && (
            <div className="card space-y-2.5 p-4">
              <div className="label">{t("issue.adminBox")}</div>
              {r.status === "pending_verification" && (
                <>
                  <button type="button" onClick={() => setDialog("verify")} disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-minor py-3 font-semibold text-on-fill hover:brightness-110 disabled:opacity-50">
                    <Icon name="check" size={18} /> {t("issue.approve")}
                  </button>
                  <button type="button" onClick={() => setDialog("reject")} disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-medium hover:border-ink disabled:opacity-50">
                    <Icon name="x" size={16} /> {t("issue.reject")}
                  </button>
                </>
              )}
              {r.status === "open" && (
                <button type="button" onClick={() => admin("dispatch", t("issue.toastDispatched"))} disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-fill py-3 font-semibold text-on-fill hover:bg-fill-hover disabled:opacity-50">
                  <Icon name="bolt" size={18} /> {t("issue.dispatch")}
                </button>
              )}
              {(r.status === "open" || r.status === "in_progress") && (
                <button type="button" onClick={() => setDialog("resolve")} disabled={busy}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-50 ${
                    r.status === "in_progress" ? "bg-minor text-on-fill hover:brightness-110" : "border border-line text-ink hover:border-ink"
                  }`}>
                  <Icon name="check" size={18} /> {t("issue.markResolved")}
                </button>
              )}
            </div>
          )}

          {r.status === "resolved" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-minor/40 bg-minor/10 px-4 py-3.5 text-sm text-minor">
              <Icon name="check" size={18} className="mt-px shrink-0" />
              <span>
                <span className="font-semibold">{t("issue.resolved")}</span> {t("issue.closedBy")}
                {r.fixedAt ? <span suppressHydrationWarning> · {timeAgo(r.fixedAt)}</span> : null}.
                {(() => {
                  const at = resolvedDeleteDate(r);
                  return at ? (
                    <span className="mt-1 block text-[12.5px] text-ink-3" suppressHydrationWarning>
                      {t("issue.autoDelete", { n: RESOLVED_KEEP_DAYS, date: i18n.day(at.toISOString()) })}
                    </span>
                  ) : null;
                })()}
              </span>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={dialog === "volunteer"} busy={busy} confirmLabel={t("issue.dlgVolOk")}
        title={t("issue.dlgVolTitle")}
        body={t("issue.dlgVolBody", { cat: cat(r.category) })}
        onConfirm={volunteer} onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "verify"} busy={busy} confirmLabel={t("issue.dlgApproveOk")}
        title={t("issue.dlgApproveTitle")}
        body={t("issue.dlgApproveBody", { name: r.assignedVolunteerId ?? t("issue.theVolunteer") })}
        onConfirm={verify} onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "resolve"} busy={busy} confirmLabel={t("issue.markResolved")}
        title={t("issue.dlgResolveTitle")}
        body={t("issue.dlgResolveBody", { cat: cat(r.category) })}
        onConfirm={() => admin("resolve", t("issue.toastMarked"))} onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reject"} busy={busy} confirmLabel={t("issue.dlgRejectOk")} tone="danger"
        title={t("issue.dlgRejectTitle")}
        body={t("issue.dlgRejectBody", { name: r.assignedVolunteerId ?? t("issue.theVolunteer") })}
        onConfirm={() => admin("reject", t("issue.toastRejected"))} onCancel={() => setDialog(null)}
      />
    </div>
  );
}
