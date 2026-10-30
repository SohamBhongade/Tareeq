"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LiveMap from "@/components/LiveMap";
import { useReports } from "@/components/useReports";
import { Icon } from "@/components/Icon";
import { Thumb } from "@/components/ReportRow";
import { ConfirmChip, STATUS_PROGRESS, StatusChip, severityColor } from "@/components/Chips";
import { SEVERITY_COLORS, RAK_CENTER } from "@/components/mapTypes";
import { isVolunteerEligible, severityBand } from "@/lib/categories";
import { useI18n } from "@/lib/i18n/client";
import type { Report } from "@/lib/types";

type Tab = "active" | "fixed";

/** Right edge of the floating report list (rail 76px + gap + 460px list), in px. */
const PANEL_RIGHT = 560;

/** True on desktop-width screens, where panels float over the map. */
function useDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setD(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return d;
}

const shortId = (r: Report) => r.id.slice(-6).toUpperCase();
/** "#AB12CD" kept in one piece, even inside Arabic text (Unicode direction isolate). */
const idTag = (r: Report) => `\u2068#${shortId(r)}\u2069`;
/** "21 55A St - Al Kharan, Ras Al Khaimah" → "Al Kharan" (the neighbourhood), else the first part. */
const shortPlace = (address: string) => {
  const parts = address.split(/,| - /).map((x) => x.trim()).filter(Boolean);
  const area = parts.find((x) => /^Al |^Ras |^Khuzam|^Dahan|^Julfar|^Mamourah/i.test(x) && !/Ras Al Khaimah$/i.test(x));
  return area ?? parts[0] ?? address;
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-ink-3">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium leading-snug text-ink">{children}</div>
    </div>
  );
}

function CircleButton({ label, icon, href, onClick, flip }: { label: string; icon: string; href?: string; onClick?: () => void; flip?: boolean }) {
  const cls = "grid size-10 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink";
  const ic = <Icon name={icon} size={17} className={flip ? "rtl:-scale-x-100" : ""} />;
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls}>{ic}</Link>
  ) : (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cls}>{ic}</button>
  );
}

/** One report in the list. Collapsed = grey tile, selected = expanded white card. */
function ReportCard({ r, selected, onSelect, onFocusMap }: { r: Report; selected: boolean; onSelect: () => void; onFocusMap: () => void }) {
  const [more, setMore] = useState(false);
  const { t, cat, band: bandName, timeAgo, day, time, desc, ar } = useI18n();
  if (!selected) {
    return (
      <button type="button" onClick={onSelect} className="block w-full rounded-[16px] bg-surface-high px-4 py-3.5 text-start transition-colors hover:bg-surface-overlay">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium">{cat(r.category)}</div>
            <div className="mt-0.5 truncate text-[12.5px] text-ink-3">
              {t("home.reportNo", { id: idTag(r) })} · <bdi>{shortPlace(r.address)}</bdi>
            </div>
          </div>
          <StatusChip status={r.status} className="mt-0.5 shrink-0" />
        </div>
      </button>
    );
  }

  const band = severityBand(r.severity);
  return (
    <article className="rounded-[18px] border-[1.5px] border-ink bg-surface p-4" aria-label={t("home.selected", { name: cat(r.category) })}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium">{cat(r.category)}</h3>
          <div className="mt-0.5 text-[12.5px] text-ink-3"><bdi>#{shortId(r)}</bdi> · <bdi>{shortPlace(r.address)}</bdi> · {timeAgo(r.createdAt)}</div>
        </div>
        <ConfirmChip count={r.confirmedBy.length} className="mt-0.5" />
      </div>

      <div className="mt-4 flex flex-col items-center gap-2.5">
        <StatusChip status={r.status} />
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay" role="progressbar" aria-valuenow={STATUS_PROGRESS[r.status]} aria-valuemin={0} aria-valuemax={100} aria-label={t("home.progress")}>
          <div className="h-full rounded-full bg-lime" style={{ width: `${STATUS_PROGRESS[r.status]}%` }} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Detail label={t("common.severity")}>
          <span style={{ color: severityColor(r.severity) }} className="font-semibold">{r.severity}/10</span>{" "}
          <span className="font-normal text-ink-3">{bandName(band)}</span>
        </Detail>
        <Detail label={t("common.reported")}>{day(r.createdAt)}{ar ? "، " : ", "}{time(r.createdAt)}</Detail>
        <Detail label={t("home.fixBy")}>{isVolunteerEligible(r.severity) ? t("common.volunteer") : t("common.cityCrew")}</Detail>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Thumb report={r} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-3">{t("home.reportedBy")}</div>
          <div className="truncate text-[13.5px] font-medium">{r.reportedBy ?? t("common.aResident")}</div>
        </div>
        <CircleButton label={t("home.showOnMap")} icon="locate" onClick={onFocusMap} />
        <CircleButton label={t("home.openFull")} icon="external" href={`/issues/${r.id}`} flip />
      </div>

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
        className="mt-4 flex w-full items-center justify-between border-t border-line pt-3.5 text-[13px] text-ink-2">
        {t("home.aiDesc")}
        <span className={`grid size-6 place-items-center rounded-full border border-line transition-transform ${more ? "rotate-180" : ""}`}>
          <Icon name="chevron" size={14} />
        </span>
      </button>
      {more && (
        <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
          <p>{desc(r)}</p>
          <p className="flex gap-1.5 text-ink-3"><Icon name="pin" size={14} className="mt-0.5 shrink-0" /><span dir="auto">{r.address}</span></p>
        </div>
      )}
    </article>
  );
}

export function HomeView({ initial }: { initial: Report[] }) {
  const { reports, online } = useReports(initial);
  const i18n = useI18n();
  const { t, cat } = i18n;
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null); // nothing selected until the user picks one
  const [view, setView] = useState<{ center?: [number, number]; zoom: number }>({ zoom: 13 });
  const desktop = useDesktop();
  const [me, setMe] = useState<[number, number] | null>(null);

  const active = reports.filter((r) => r.status !== "resolved");
  const fixed = reports.filter((r) => r.status === "resolved");
  const critical = active.filter((r) => severityBand(r.severity) === "critical").length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (tab === "active" ? active : fixed).filter(
      (r) =>
        !needle ||
        r.category.toLowerCase().includes(needle) ||
        cat(r.category).includes(needle) ||
        r.address.toLowerCase().includes(needle) ||
        shortId(r).toLowerCase().includes(needle),
    );
  }, [tab, q, active, fixed, cat]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const smooth = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const focus = (r: Report) => {
    setView({ center: [r.latitude, r.longitude], zoom: 15 });
    // Phones: the sheet may be covering the map — slide back up to it.
    if (!desktop) window.scrollTo({ top: 0, behavior: smooth() });
  };
  const select = (id: string) => {
    setSelectedId(id);
    const r = reports.find((x) => x.id === id);
    if (r) setTab(r.status === "resolved" ? "fixed" : "active");
    // Phones: tapping a pin brings its card into view in the sheet.
    if (!desktop) {
      requestAnimationFrame(() =>
        document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: smooth(), block: "start" }),
      );
    }
  };
  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const here: [number, number] = [p.coords.latitude, p.coords.longitude];
        setMe(here);
        setView({ center: here, zoom: 15 });
      },
      () => setView({ center: RAK_CENTER, zoom: 13 }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="flex flex-col max-lg:-mx-4 max-lg:-mt-5 max-lg:-mb-[calc(5.75rem+env(safe-area-inset-bottom))] md:max-lg:-mx-6">
      {/* Map: on phones it's full-width and stays put while the reports sheet
          slides up over it (like Apple Maps). Full-screen behind panels on desktop. */}
      <section className="sticky top-[var(--hdr)] z-0 h-[46svh] min-h-[280px] overflow-hidden lg:fixed lg:inset-0 lg:h-auto">
        <LiveMap
          reports={reports}
          zoom={view.zoom}
          center={view.center}
          pin={me}
          onSelect={(id) => { select(id); }}
          selectedId={selectedId}
          controlsOffset={{ top: 54, right: 2 }}
          // In Arabic the list sits on the right, so the open area is on the left.
          viewOffset={desktop ? [(i18n.ar ? -1 : 1) * (PANEL_RIGHT / 2), selected ? -64 : 0] : undefined}
        />
        <div className="absolute end-3 top-3 z-[500] flex gap-2">
          <button type="button" onClick={locate} aria-label={t("home.locate")} title={t("home.locate")}
            className="panel grid size-10 place-items-center !rounded-[13px] text-ink hover:bg-surface-high">
            <Icon name="locate" size={18} />
          </button>
          <button type="button" onClick={() => setView({ center: [RAK_CENTER[0] + Math.random() * 1e-6, RAK_CENTER[1]], zoom: 12 })}
            aria-label={t("home.showAll")} title={t("home.showAll")}
            className="panel grid size-10 place-items-center !rounded-[13px] text-ink hover:bg-surface-high">
            <Icon name="layers" size={18} />
          </button>
        </div>
        <div className="panel pointer-events-none absolute end-[108px] top-3 z-[500] hidden h-10 items-center gap-3.5 !rounded-[13px] px-3.5 text-[11.5px] text-ink-2 xl:flex">
          {([["critical", SEVERITY_COLORS.critical], ["moderate", SEVERITY_COLORS.moderate], ["minor", SEVERITY_COLORS.minor], ["fixed", SEVERITY_COLORS.resolved]] as const).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c }} />{i18n.band(k)}</span>
          ))}
        </div>
      </section>

      {/* Report list panel */}
      <section className="panel relative z-10 flex flex-col max-lg:-mt-6 max-lg:min-h-[calc(100svh-var(--hdr)-4rem)] max-lg:!rounded-b-none max-lg:!rounded-t-[26px] max-lg:px-4 max-lg:pb-[calc(6.5rem+env(safe-area-inset-bottom))] max-lg:pt-2.5 max-lg:shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.25)] sm:max-lg:px-6 lg:fixed lg:bottom-3 lg:start-[88px] lg:top-3 lg:z-[1000] lg:w-[460px] lg:px-7 lg:py-7">
        <div aria-hidden className="mx-auto mb-3.5 h-1 w-10 shrink-0 rounded-full bg-ink/15 lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight lg:text-[21px]">{t("home.title")}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <span className={`size-2 rounded-full ${online ? "bg-minor" : "bg-critical"}`} />
              {online ? t("home.live") : t("home.reconnecting")} · {t("home.summary", { open: active.length, critical })}
            </p>
          </div>
          <Link href="/report" title={t("home.newTitle")}
            className="flex h-10 items-center gap-1.5 rounded-[13px] border border-line px-3.5 text-[13px] font-medium hover:border-ink">
            <Icon name="plus" size={16} /> {t("home.new")}
          </Link>
        </div>

        <div role="tablist" aria-label={t("common.status")} className="mt-5 grid grid-cols-2 gap-1 rounded-[15px] bg-surface-high p-1 lg:mt-6 lg:rounded-none lg:bg-transparent lg:p-0">
          {([["active", t("home.active"), active.length], ["fixed", t("home.fixed"), fixed.length]] as const).map(([k, label, n]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`h-9 rounded-[12px] text-[14px] font-medium transition-colors lg:h-10 lg:rounded-[13px] ${tab === k ? "bg-fill text-on-fill" : "text-ink hover:bg-surface-high"}`}>
              {label} <span className={`ms-1 text-[12px] tabular-nums ${tab === k ? "text-fill-accent" : "text-ink-3"}`}>{n}</span>
            </button>
          ))}
        </div>

        <label className="relative mt-3 block">
          <Icon name="search" size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.search")} aria-label={t("home.search")}
            className="h-10 w-full rounded-[13px] bg-surface-high ps-10 pe-3 text-[13px] outline-none placeholder:text-ink-4 focus:bg-surface focus:ring-1 focus:ring-ink/30" />
        </label>

        <div className="thin-scroll -mx-1 mt-4 flex flex-col gap-2.5 px-1 lg:mt-5 lg:min-h-0 lg:flex-1 lg:gap-3 lg:overflow-y-auto lg:pb-1">
          {shown.map((r) => (
            <div key={r.id} id={`report-${r.id}`} className="scroll-mt-[calc(var(--hdr)+1rem)]">
              <ReportCard r={r} selected={r.id === selectedId} onSelect={() => setSelectedId(r.id)} onFocusMap={() => focus(r)} />
            </div>
          ))}
          {shown.length === 0 && (
            <div className="rounded-[18px] bg-surface-high px-4 py-10 text-center text-sm text-ink-3">
              {q ? t("home.noMatch") : tab === "active" ? t("home.noOpen") : t("home.noFixed")}
            </div>
          )}
        </div>
      </section>

      {/* Detail bar along the bottom of the map (desktop) */}
      {selected && (
        <section aria-label={t("home.selectedReport")} className="panel fixed bottom-3 start-[560px] end-3 z-[1000] hidden px-6 py-4 lg:block">
          <div className="flex items-center gap-4">
            <h2 className="text-[16px] font-medium">{t("home.reportNo", { id: idTag(selected) })}</h2>
            <StatusChip status={selected.status} dark />
            <div className="ms-auto flex gap-2">
              <button type="button" onClick={() => focus(selected)} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:border-ink">
                {t("home.showOnMap")}
              </button>
              <Link href={`/issues/${selected.id}`} className="rounded-full border border-ink px-3.5 py-1.5 text-[13px] font-medium hover:border-fill hover:bg-fill hover:text-on-fill">
                {t("home.openReport")}
              </Link>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-4 border-t border-line pt-3">
            <Detail label={t("home.issue")}>{cat(selected.category)}<div className="text-[12px] font-normal text-ink-3">{i18n.band(severityBand(selected.severity))}</div></Detail>
            <Detail label={t("common.location")}><bdi className="line-clamp-1 block">{shortPlace(selected.address)}</bdi><div className="text-[12px] font-normal text-ink-3">{t("common.rak")}</div></Detail>
            <Detail label={t("common.severity")}><span dir="ltr" style={{ color: severityColor(selected.severity) }}>{selected.severity} / 10</span></Detail>
            <Detail label={t("home.confirmedBy")}>{t("home.residentsN", { n: selected.confirmedBy.length })}</Detail>
            <Detail label={t("home.lastUpdate")}>{i18n.timeAgo(selected.fixedAt ?? selected.createdAt)}</Detail>
          </div>
        </section>
      )}
    </div>
  );
}
