"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LiveMap from "@/components/LiveMap";
import { Icon } from "@/components/Icon";
import { SeverityChip } from "@/components/Chips";
import { useToast } from "@/components/Toast";
import { api, fileToResizedDataUrl } from "@/components/imageUtil";
import {
  ISSUE_CATEGORIES,
  OTHER_CATEGORY,
  isVolunteerEligible,
  normalizeSeverity,
  priorityFromSeverity,
} from "@/lib/categories";
import type { AnalysisResult, DuplicateMatch, Report } from "@/lib/types";
import { DuplicatePanel } from "./DuplicatePanel";
import { useI18n } from "@/lib/i18n/client";

type Loc = { lat: number; lng: number; accuracy?: number; source: "gps" | "map" };

export default function ReportPage() {
  const router = useRouter();
  const toast = useToast();
  const i18n = useI18n();
  const { t, cat } = i18n;
  const fileRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");

  const [loc, setLoc] = useState<Loc | null>(null);
  const [locState, setLocState] = useState<"idle" | "locating" | "denied" | "ok">("idle");
  const [address, setAddress] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [me, setMe] = useState<string>("");

  useEffect(() => {
    api<{ user: { username: string } }>("/api/me").then((r) => setMe(r.user.username)).catch(() => {});
  }, []);

  // ── location ────────────────────────────────────────────────────────
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setLocState("denied"); return; }
    setLocState("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, source: "gps" }); setLocState("ok"); },
      () => setLocState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);
  useEffect(() => { locate(); }, [locate]);

  useEffect(() => {
    if (!loc) return;
    let alive = true;
    setAddress("");
    api<{ address: string }>(`/api/geocode?lat=${loc.lat}&lng=${loc.lng}`)
      .then((r) => alive && setAddress(r.address))
      .catch(() => alive && setAddress(t("common.rakUae")));
    return () => { alive = false; };
  }, [loc?.lat, loc?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickOnMap = (lat: number, lng: number) => { setLoc({ lat, lng, source: "map" }); setLocState("ok"); };

  // ── photo + AI ──────────────────────────────────────────────────────
  async function analyze(dataUrl: string) {
    setAnalyzing(true);
    setAiError(null);
    setAnalysis(null);
    try {
      const { analysis } = await api<{ analysis: AnalysisResult }>("/api/analyze", { json: { imageBase64: dataUrl } });
      setAnalysis(analysis);
      setCategory(analysis.category);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setPhoto(dataUrl);
      analyze(dataUrl);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  // ── submit ──────────────────────────────────────────────────────────
  const aiSeverity = analysis?.severity ?? 1;
  const finalSeverity = category ? normalizeSeverity(category, aiSeverity) : aiSeverity;
  const overridden = !!analysis && category !== "" && finalSeverity !== aiSeverity;
  const canSubmit = !!photo && !!analysis && !!category && !!loc && !submitting;

  // Duplicate detection: look for open reports of the same kind nearby
  // whenever the category or location settles.
  useEffect(() => {
    if (!analysis || !category || !loc) { setMatches([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      api<{ matches: DuplicateMatch[] }>(`/api/reports/nearby?lat=${loc.lat}&lng=${loc.lng}&category=${encodeURIComponent(category)}`)
        .then((r) => alive && setMatches(r.matches))
        .catch(() => alive && setMatches([]));
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [analysis, category, loc?.lat, loc?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!canSubmit || !loc) return;
    setSubmitting(true);
    try {
      const { report, exp } = await api<{ report: Report; exp: number }>("/api/reports", {
        json: {
          imageBase64: photo,
          category,
          severity: finalSeverity,
          description: analysis!.description,
          descriptionAr: analysis!.descriptionAr ?? null,
          latitude: loc.lat,
          longitude: loc.lng,
          address: address || "Ras Al Khaimah, UAE",
          // The user has seen the "already reported" panel and chose to file anyway.
          forceNew: matches.length > 0,
        },
      });
      toast(t("report.sent", { exp }));
      router.push(`/issues/${report.id}`);
      router.refresh();
    } catch (e) {
      const err = e as Error & { status?: number; data?: { duplicates?: DuplicateMatch[] } };
      if (err.status === 409 && err.data?.duplicates?.length) {
        // Someone reported it moments ago — show them instead.
        setMatches(err.data.duplicates);
        toast(t("report.justReported"), "warn");
      } else {
        toast(err.message, "error");
      }
      setSubmitting(false);
    }
  }

  function reset() {
    setPhoto(null); setAnalysis(null); setAiError(null); setCategory("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── UI ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("report.title")}</h1>
        <p className="mt-1 text-sm text-ink-2">{t("report.subtitle")}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* Photo + AI */}
        <section className="space-y-4">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" id="photo" onChange={(e) => onFile(e.target.files?.[0])} />
          {!photo ? (
            <label htmlFor="photo" className="card flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 border-dashed border-olive/40 text-center hover:border-olive/70 hover:bg-lime/10">
              <span className="grid size-16 place-items-center rounded-2xl bg-lime/45 text-olive"><Icon name="camera" size={30} /></span>
              <span className="text-base font-semibold">{t("report.addPhoto")}</span>
              <span className="max-w-xs text-sm text-ink-3">{t("report.addPhotoHint")}</span>
            </label>
          ) : (
            <div className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={t("report.photoAlt")} className="max-h-[420px] w-full object-cover" />
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-ink-3">{t("report.photoReady")}</span>
                <button type="button" onClick={reset} disabled={submitting} className="text-xs font-medium text-olive hover:underline">{t("report.retake")}</button>
              </div>
            </div>
          )}

          {photo && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <span className="label flex items-center gap-1.5"><Icon name="sparkle" size={13} className="text-olive" /> {t("report.aiClass")}</span>
                {analysis && category && <SeverityChip severity={finalSeverity} />}
              </div>

              {analyzing && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <span className="spin size-7 rounded-full border-2 border-olive/25 border-t-olive" />
                  <span className="font-medium">{t("report.analyzing")}</span>
                  <span className="text-xs text-ink-3">{t("report.analyzingHint")}</span>
                </div>
              )}

              {aiError && !analyzing && (
                <div className="mt-3 space-y-3">
                  <p className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">{aiError}</p>
                  <button type="button" onClick={() => photo && analyze(photo)} className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-ink/[0.05]">{t("common.retry")}</button>
                </div>
              )}

              {analysis && !analyzing && (
                <div className="mt-3 space-y-4">
                  <div>
                    <div className="text-xl font-semibold">{category ? cat(category) : t("report.chooseCat")}</div>
                    <p className="mt-1 text-sm text-ink-2">{i18n.desc(analysis)}</p>
                    {analysis.provider && <p className="mt-1.5 text-[11px] text-ink-4">{t("report.analyzedBy", { who: analysis.provider })}</p>}
                  </div>
                  <div>
                    <label htmlFor="cat" className="label">{analysis.category === OTHER_CATEGORY ? t("report.pickCat") : t("report.changeCat")}</label>
                    <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm outline-none focus:border-ink/40">
                      {analysis.category === OTHER_CATEGORY && <option value={OTHER_CATEGORY}>{t("report.other")}</option>}
                      {ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{cat(c)}</option>)}
                      {analysis.category !== OTHER_CATEGORY && <option value={OTHER_CATEGORY}>{t("report.other")}</option>}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-line bg-elevated px-3 py-2.5">
                      <div className="label">{t("common.severity")}</div>
                      <div className="mt-0.5 font-semibold tabular-nums" dir="ltr">{finalSeverity} / 10</div>
                    </div>
                    <div className="rounded-xl border border-line bg-elevated px-3 py-2.5">
                      <div className="label">{t("common.priority")}</div>
                      <div className="mt-0.5 font-semibold capitalize">{i18n.priority(priorityFromSeverity(finalSeverity))}</div>
                    </div>
                  </div>
                  {analysis.demo && (
                    <p className="rounded-lg border border-moderate/30 bg-moderate/10 px-3 py-2 text-xs text-moderate">
                      {t("report.demoAi")}
                    </p>
                  )}
                  {overridden && !analysis.demo && (
                    <p className="text-xs text-ink-3">
                      {t("report.override", { ai: aiSeverity, cat: cat(category), final: finalSeverity })}
                    </p>
                  )}
                  <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${isVolunteerEligible(finalSeverity) ? "bg-minor/10 text-minor" : "bg-critical/10 text-critical"}`}>
                    <Icon name={isVolunteerEligible(finalSeverity) ? "hands" : "shield"} size={15} className="mt-px shrink-0" />
                    {isVolunteerEligible(finalSeverity)
                      ? t("report.lowRisk")
                      : t("report.highRisk")}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Location + submit */}
        <section className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="label">{t("common.location")}</span>
              <button type="button" onClick={locate} className="-my-2 -me-2 flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-olive hover:underline">
                <Icon name="target" size={14} /> {t("report.useMyLocation")}
              </button>
            </div>
            <div className="mt-3 h-64">
              <LiveMap pin={loc ? [loc.lat, loc.lng] : null} center={loc ? [loc.lat, loc.lng] : undefined} zoom={loc ? 16 : 11} onPick={pickOnMap} />
            </div>
            <div className="space-y-2 px-4 py-3.5 text-sm">
              {locState === "locating" && <p className="text-ink-3">{t("report.finding")}</p>}
              {locState === "denied" && !loc && (
                <p className="text-moderate">{t("report.locOff")}</p>
              )}
              {loc && (
                <>
                  <p className="flex items-start gap-2"><Icon name="pin" size={16} className="mt-0.5 shrink-0 text-olive" />{address || t("report.lookingUp")}</p>
                  <p className="flex items-center gap-2 text-xs text-ink-3 tabular-nums">
                    <Icon name="target" size={14} className="shrink-0" />
                    {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                    {loc.source === "gps" && loc.accuracy ? ` · ±${Math.round(loc.accuracy)} m` : loc.source === "map" ? ` · ${t("report.setOnMap")}` : ""}
                  </p>
                  <p className="text-xs text-ink-4">{t("report.adjust")}</p>
                </>
              )}
            </div>
          </div>

          {matches.length > 0 && <DuplicatePanel matches={matches} me={me} disabled={submitting} />}

          <button type="button" onClick={submit} disabled={!canSubmit}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
              matches.length > 0 ? "border border-line text-ink-2 hover:bg-ink/[0.05]" : "bg-fill text-on-fill hover:bg-fill-hover"
            }`}>
            {submitting ? <span className="spin size-4 rounded-full border-2 border-current/30 border-t-current" /> : <Icon name="check" size={18} />}
            {submitting ? t("report.submitting") : matches.length > 0 ? t("report.submitAnyway") : t("report.submit")}
          </button>
          {!canSubmit && !submitting && (
            <p className="text-center text-xs text-ink-3">
              {!photo ? t("report.needPhoto") : analyzing ? t("report.waitAi") : !loc ? t("report.needLoc") : !category ? t("report.needCat") : ""}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
