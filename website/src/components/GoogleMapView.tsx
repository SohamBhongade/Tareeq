"use client";
import { useEffect, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  ColorScheme,
  ControlPosition,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { severityBand } from "@/lib/categories";
import type { Report } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { useTheme } from "./ThemeToggle";
import { RAK_CENTER, SEVERITY_COLORS, UAE_BOUNDS, type MapViewProps } from "./mapTypes";


function SeverityDot({ report, selected = false }: { report: Pick<Report, "severity" | "status">; selected?: boolean }) {
  const resolved = report.status === "resolved";
  const band = severityBand(report.severity);
  const color = resolved ? SEVERITY_COLORS.resolved : SEVERITY_COLORS[band];
  return (
    <div className={`fms-marker ${resolved ? "" : band} ${selected ? "selected" : ""}`}>
      <span className="halo" style={{ background: color }} />
      <span className="dot" style={{ background: color }} />
    </div>
  );
}

function PickPin() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 22s-7-6.3-7-12a7 7 0 1 1 14 0c0 5.7-7 12-7 12Z" fill="#292928" stroke="#fff" strokeWidth="1.4" />
      <circle cx="12" cy="10" r="2.8" fill="#c3f832" />
    </svg>
  );
}

/** Smoothly moves the camera when `center` changes (e.g. GPS fix arrives). */
function FollowCenter({ center, zoom }: { center?: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    map.panTo({ lat: center[0], lng: center[1] });
    if (map.getZoom() !== zoom) map.setZoom(zoom);
  }, [map, center?.[0], center?.[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function GoogleMapView({
  reports = [], center, zoom = 12, pin, pinSeverity, onPick, onSelect, selectedId, interactive = true, className = "", apiKey, mapId,
}: MapViewProps & { apiKey: string; mapId?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const i18n = useI18n();
  const theme = useTheme();
  const open = reports.find((r) => r.id === openId) ?? null;
  const start = center ?? pin ?? RAK_CENTER;

  return (
    <APIProvider apiKey={apiKey} language="en" region="AE">
      <Map
        className={`h-full w-full ${className}`}
        // Advanced markers need a Map ID. DEMO_MAP_ID works out of the box;
        // create your own in Google Cloud → Map Management for production.
        mapId={mapId || "DEMO_MAP_ID"}
        key={theme}
        colorScheme={theme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT}
        defaultCenter={{ lat: start[0], lng: start[1] }}
        defaultZoom={zoom}
        minZoom={7}
        restriction={{ latLngBounds: UAE_BOUNDS, strictBounds: false }}
        gestureHandling={interactive ? "greedy" : "none"}
        disableDefaultUI
        zoomControl={interactive}
        zoomControlOptions={{ position: ControlPosition.RIGHT_TOP }}
        mapTypeControl={interactive}
        mapTypeControlOptions={{ position: ControlPosition.TOP_RIGHT }}
        clickableIcons={false}
        onClick={(e) => {
          setOpenId(null);
          const ll = e.detail.latLng;
          if (onPick && ll) onPick(ll.lat, ll.lng);
        }}
      >
        {reports.map((r) => (
          <AdvancedMarker
            key={r.id}
            position={{ lat: r.latitude, lng: r.longitude }}
            anchorLeft="-50%"
            anchorTop="-50%"
            title={`${r.category} · ${r.severity}/10`}
            onClick={() => (onSelect ? onSelect(r.id) : setOpenId(r.id))}
            zIndex={r.id === selectedId ? 1000 : undefined}
          >
            <SeverityDot report={r} selected={r.id === selectedId} />
          </AdvancedMarker>
        ))}

        {open && (
          <InfoWindow
            position={{ lat: open.latitude, lng: open.longitude }}
            pixelOffset={[0, -12]}
            onCloseClick={() => setOpenId(null)}
            headerContent={<strong style={{ color: "#292928", fontSize: 14 }}>{i18n.cat(open.category)}</strong>}
          >
            <div style={{ color: "#5c5c59", fontSize: 12, lineHeight: 1.5, minWidth: 190 }}>
              <div>
                {i18n.band(severityBand(open.severity))} · {open.severity}/10 · {i18n.status(open.status)}
                {open.confirmedBy.length > 0 && i18n.t("map.confirmedBy", { n: open.confirmedBy.length })}
              </div>
              <div style={{ color: "#8b8b87" }}>{open.address}</div>
              <a href={`/issues/${open.id}`} style={{ color: "#292928", fontWeight: 600, display: "inline-block", marginTop: 4 }}>
                {i18n.t("map.viewDetails")}
              </a>
            </div>
          </InfoWindow>
        )}

        {pin && (
          <AdvancedMarker
            position={{ lat: pin[0], lng: pin[1] }}
            draggable={!!onPick}
            onDragEnd={(e) => {
              if (onPick && e.latLng) onPick(e.latLng.lat(), e.latLng.lng());
            }}
            {...(pinSeverity !== undefined ? { anchorLeft: "-50%", anchorTop: "-50%" } : {})}
          >
            {pinSeverity !== undefined ? <SeverityDot report={{ severity: pinSeverity, status: "open" }} /> : <PickPin />}
          </AdvancedMarker>
        )}

        <FollowCenter center={center} zoom={zoom} />
      </Map>
    </APIProvider>
  );
}
