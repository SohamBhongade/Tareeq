"use client";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import L from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { AttributionControl, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import { severityBand } from "@/lib/categories";
import { useI18n } from "@/lib/i18n/client";
import { RAK_CENTER, SEVERITY_COLORS, type MapViewProps } from "./mapTypes";
import { useTheme } from "./ThemeToggle";
import { parseTheme, type Theme } from "@/lib/theme";

// Keep the camera on the UAE, like the Android app.
const UAE_BOUNDS = L.latLngBounds([22.5, 51.5], [26.5, 56.5]);

/*
 * Basemap: OpenFreeMap "Positron" — a clean light-grey vector map.
 * Free, no API key, no account, no card. Data © OpenStreetMap.
 * If it can't load (old browser without WebGL, network blocked), we fall
 * back to standard OpenStreetMap tiles drawn in greyscale.
 */
const VECTOR_STYLE: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const VECTOR_ATTR =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const RASTER_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const RASTER_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type GLMap = ReturnType<ReturnType<typeof maplibreGL>["getMaplibreMap"]>;

/*
 * Dark theme: Apple Maps–style night map, tinted with our green.
 * Charcoal land, chunky grey roads that widen as you zoom, soft white labels,
 * light-grey highways and deep green water/parks
 * (where Apple uses blue). Layers are matched by their data ("source-layer"),
 * so this works on any OpenMapTiles-based style.
 */
const NIGHT = {
  land: "#262724",
  landAlt: "#2a2b28",
  park: "#243024",
  water: "#0c110e", // much darker than land so the coastline is obvious
  building: "#31332f",
  casing: "#262724",
  halo: "rgba(30,31,28,0.92)",
};
const cls = ["get", "class"];
const ROAD_COLOR = [
  "match", cls,
  ["motorway", "trunk"], "#76786f",
  ["primary"], "#64665e",
  ["secondary"], "#575951",
  ["tertiary"], "#4c4e47",
  ["rail", "transit"], "#3d3f39",
  ["path", "track"], "#393b35",
  "#43453f",
];
// Widths by zoom, like Apple's: hairlines when zoomed out, thick when zoomed in.
const width = (motorway: number, primary: number, secondary: number, minor: number, path: number) => [
  "match", cls,
  ["motorway", "trunk"], motorway,
  ["primary"], primary,
  ["secondary", "tertiary"], secondary,
  ["path", "track", "rail", "transit"], path,
  minor,
];
const ROAD_WIDTH = [
  "interpolate", ["exponential", 1.5], ["zoom"],
  8, width(1, 0.6, 0.4, 0.2, 0.2),
  12, width(3, 2, 1.4, 0.8, 0.5),
  15, width(8, 6, 4.5, 3, 1.2),
  18, width(22, 18, 14, 10, 3),
];
const LABEL_COLOR = [
  "match", cls,
  ["city", "town"], "#f4f4f1",
  ["village", "suburb"], "#c8c9c3",
  "#a3a59d",
];

type StyleLayer = { id: string; type: string; "source-layer"?: string; paint?: Record<string, unknown> };

/** The paint changes for one layer of the night map. */
function nightPaint(layer: StyleLayer): [string, unknown][] {
  const src = layer["source-layer"] ?? "";
  const id = layer.id;
  switch (layer.type) {
    case "background":
      return [["background-color", NIGHT.land]];
    case "fill":
      if (src === "water") return [["fill-color", NIGHT.water]];
      if (src === "building") return [["fill-color", NIGHT.building], ["fill-outline-color", "#3a3c37"]];
      if (src === "park" || /park|wood|forest|grass/i.test(id)) return [["fill-color", NIGHT.park]];
      if (src === "landcover" || src === "landuse") return [["fill-color", NIGHT.landAlt]];
      if (src === "aeroway") return [["fill-color", "#2e302b"]];
      return [];
    case "fill-extrusion":
      return src === "building" ? [["fill-extrusion-color", NIGHT.building]] : [];
    case "line":
      if (src === "transportation") {
        if (/casing|outline/i.test(id)) return [["line-color", NIGHT.casing]];
        const out: [string, unknown][] = [["line-color", ROAD_COLOR], ["line-width", ROAD_WIDTH]];
        if (/tunnel/i.test(id)) out.push(["line-opacity", 0.5]);
        return out;
      }
      if (src === "waterway") return [["line-color", NIGHT.water]];
      if (src === "boundary") {
        // Country and emirate borders: light and clearly visible.
        return [
          ["line-color", ["case", ["<=", ["to-number", ["get", "admin_level"], 99], 2], "#b9bcb0", "#8a8d82"]],
          ["line-opacity", 0.9],
        ];
      }
      if (src === "aeroway") return [["line-color", "#3d3f39"]];
      return [];
    case "symbol": {
      const color =
        src === "place" ? LABEL_COLOR
        : src === "transportation_name" ? "#a8aaa2"
        : src === "water_name" ? "#6f8f6c"
        : src === "poi" ? "#8fae4a"
        : "#a3a59d";
      return [["text-color", color], ["text-halo-color", NIGHT.halo], ["text-halo-width", 1.3], ["text-halo-blur", 0.5]];
    }
    default:
      return [];
  }
}

/** Night colours baked into the style before the map draws it (no flash, one paint). */
function nightStyle<T extends { layers?: StyleLayer[]; metadata?: Record<string, unknown> }>(style: T): T {
  const copy = structuredClone(style);
  copy.metadata = { ...(copy.metadata ?? {}), tareeqNight: true };
  for (const layer of copy.layers ?? []) {
    const changes = nightPaint(layer);
    if (changes.length) layer.paint = { ...(layer.paint ?? {}), ...Object.fromEntries(changes) };
  }
  return copy;
}

/** Fallback: recolour a map that's already drawn. */
function appleNight(gl: GLMap) {
  for (const layer of (gl.getStyle()?.layers ?? []) as StyleLayer[]) {
    for (const [prop, value] of nightPaint(layer)) {
      try { gl.setPaintProperty(layer.id, prop, value as never); } catch { /* not valid for this layer */ }
    }
  }
}

/*
 * Style JSON is fetched once and reused (theme switches, page changes).
 * The fetch starts as soon as this file loads, in parallel with everything else.
 */
const styleCache: Partial<Record<Theme, Promise<object | null>>> = {};
function loadStyle(theme: Theme): Promise<object | null> {
  styleCache[theme] ??= fetch(VECTOR_STYLE[theme])
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => (json && theme === "dark" ? nightStyle(json) : json))
    .catch(() => null);
  return styleCache[theme]!;
}
if (typeof document !== "undefined") loadStyle(parseTheme(document.documentElement.dataset.theme));

const isDark = () => document.documentElement.dataset.theme === "dark";

function BaseLayer() {
  const map = useMap();
  const theme = useTheme();
  const [fallback, setFallback] = useState(false);
  const glRef = useRef<GLMap | null>(null);
  const styleRef = useRef<string>("");

  // Theme switched: swap the basemap style in place (keeps position and zoom).
  useEffect(() => {
    const url = VECTOR_STYLE[theme];
    if (!glRef.current || styleRef.current === url) return;
    styleRef.current = url;
    let live = true;
    loadStyle(theme).then((style) => {
      if (!live || !glRef.current) return;
      glRef.current.setStyle((style ?? url) as never);
    });
    return () => { live = false; };
  }, [theme]);

  useEffect(() => {
    if (fallback) return;
    if (!webglAvailable()) {
      setFallback(true);
      return;
    }
    let styleLoaded = false;
    let cancelled = false;
    let layer: ReturnType<typeof maplibreGL> | null = null;
    const startTheme = parseTheme(document.documentElement.dataset.theme);
    styleRef.current = VECTOR_STYLE[startTheme];
    const timer = setTimeout(() => { if (!styleLoaded) setFallback(true); }, 9000);

    loadStyle(startTheme).then((style) => {
      if (cancelled) return;
      // Pre-coloured style object when we have it; otherwise the plain URL.
      layer = maplibreGL({ style: (style ?? styleRef.current) as never, attributionControl: false });
      layer.options.attribution = VECTOR_ATTR;
      layer.addTo(map);
      const gl = layer.getMaplibreMap();
      glRef.current = gl;
      gl.on("style.load", () => {
        styleLoaded = true;
        // Only needed if the style couldn't be pre-coloured (fetch failed).
        const night = (gl.getStyle()?.metadata as { tareeqNight?: boolean } | undefined)?.tareeqNight;
        if (isDark() && !night) appleNight(gl);
      });
      gl.on("error", () => { if (!styleLoaded) setFallback(true); });
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      glRef.current = null;
      if (layer) map.removeLayer(layer);
    };
  }, [map, fallback]);

  return fallback ? <TileLayer url={RASTER_URL} attribution={RASTER_ATTR} maxZoom={19} className="fms-grey-tiles" /> : null;
}

function markerIcon(severity: number, resolved = false, selected = false): L.DivIcon {
  const band = severityBand(severity);
  const color = resolved ? SEVERITY_COLORS.resolved : SEVERITY_COLORS[band];
  const size = selected ? 30 : 22;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -10],
    html: `<div class="fms-marker ${resolved ? "" : band} ${selected ? "selected" : ""}" style="width:${size}px;height:${size}px"><span class="halo" style="background:${color}"></span><span class="dot" style="background:${color}"></span></div>`,
  });
}

// Dark map pin, like the destination pin in the design.
const pickIcon = L.divIcon({
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 32],
  html: `<svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 22s-7-6.3-7-12a7 7 0 1 1 14 0c0 5.7-7 12-7 12Z" fill="#292928" stroke="#fff" stroke-width="1.4"/><circle cx="12" cy="10" r="2.8" fill="#c3f832"/></svg>`,
});

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** The map-centre that puts [target] at the visible middle (see viewOffset). */
function shifted(map: L.Map, target: L.LatLngExpression, zoom: number, offset?: [number, number]) {
  if (!offset || (offset[0] === 0 && offset[1] === 0)) return L.latLng(target);
  return map.unproject(map.project(target, zoom).subtract(L.point(offset[0], offset[1])), zoom);
}

function FlyTo({ center, zoom, offset }: { center: [number, number]; zoom: number; offset?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(shifted(map, center, zoom, offset), zoom, { duration: 0.6 });
  }, [center[0], center[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** On first load, nudges the starting view into the uncovered part of the map. */
function InitialOffset({ start, zoom, offset }: { start: [number, number]; zoom: number; offset?: [number, number] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !offset || (offset[0] === 0 && offset[1] === 0)) return;
    done.current = true;
    map.setView(shifted(map, start, zoom, offset), zoom, { animate: false });
  }, [map, offset?.[0], offset?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Pushes Leaflet's corner controls clear of panels floating over the map. */
function OffsetControls({ top = 0, right = 0, side }: { top?: number; right?: number; side: "left" | "right" }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer().querySelector<HTMLElement>(`.leaflet-top.leaflet-${side}`);
    if (el) {
      el.style.marginTop = `${top}px`;
      el.style[side === "right" ? "marginRight" : "marginLeft"] = `${right}px`;
    }
  }, [map, top, right, side]);
  return null;
}

/** The free map (OpenFreeMap / OpenStreetMap) — used when no Google Maps key is set. */
export default function LeafletMap({
  reports = [], center, zoom = 12, pin, pinSeverity, onPick, onSelect, selectedId, controlsOffset, viewOffset, interactive = true, className = "",
}: MapViewProps) {
  const start = center ?? pin ?? RAK_CENTER;
  const i18n = useI18n();
  // In Arabic the panels sit on the right, so the map's own buttons move to the left.
  const side = i18n.ar ? "left" : "right";
  const icons = useMemo(() => new Map<string, L.DivIcon>(), []);
  const iconFor = (r: Report) => {
    const selected = r.id === selectedId;
    const key = `${severityBand(r.severity)}-${r.status === "resolved"}-${selected}`;
    if (!icons.has(key)) icons.set(key, markerIcon(r.severity, r.status === "resolved", selected));
    return icons.get(key)!;
  };

  return (
    // Leaflet only works left-to-right; the page around it can still be Arabic.
    <div dir="ltr" className="h-full w-full">
    <MapContainer
      center={start}
      zoom={zoom}
      minZoom={7}
      maxBounds={UAE_BOUNDS}
      maxBoundsViscosity={1}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={false}
      doubleClickZoom={interactive}
      attributionControl={false}
      className={`h-full w-full ${className}`}
    >
      <BaseLayer />
      <AttributionControl position={i18n.ar ? "bottomleft" : "bottomright"} />
      {interactive && <ZoomControl position={i18n.ar ? "topleft" : "topright"} />}
      {controlsOffset && <OffsetControls {...controlsOffset} side={side} />}
      {reports.map((r) => (
        <Marker
          key={r.id}
          position={[r.latitude, r.longitude]}
          icon={iconFor(r)}
          zIndexOffset={r.id === selectedId ? 1000 : 0}
          eventHandlers={onSelect ? { click: () => onSelect(r.id) } : undefined}
        >
          {!onSelect && (
            <Popup>
              <div className="min-w-48 space-y-1" dir={i18n.dir}>
                <div className="text-sm font-semibold text-ink">{i18n.cat(r.category)}</div>
                <div className="text-xs text-ink-2">
                  {i18n.band(severityBand(r.severity))} · {r.severity}/10 · {i18n.status(r.status)}
                  {r.confirmedBy.length > 0 && i18n.t("map.confirmedBy", { n: r.confirmedBy.length })}
                </div>
                <div className="text-xs text-ink-3">{r.address}</div>
                <a href={`/issues/${r.id}`} className="inline-block pt-1 text-xs font-semibold">
                  {i18n.t("map.viewDetails")}
                </a>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
      {pin && (
        <Marker
          position={pin}
          icon={pinSeverity !== undefined ? markerIcon(pinSeverity) : pickIcon}
          draggable={!!onPick}
          eventHandlers={onPick ? { dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onPick(ll.lat, ll.lng); } } : undefined}
        />
      )}
      {onPick && <ClickToPick onPick={onPick} />}
      {center && <FlyTo center={center} zoom={zoom} offset={viewOffset} />}
      {!center && <InitialOffset start={start} zoom={zoom} offset={viewOffset} />}
    </MapContainer>
    </div>
  );
}
