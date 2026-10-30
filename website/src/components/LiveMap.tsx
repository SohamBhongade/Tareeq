"use client";
import dynamic from "next/dynamic";
import { useMapsConfig } from "./MapsConfig";
import { useI18n } from "@/lib/i18n/client";
import type { MapViewProps } from "./mapTypes";

function MapLoading() {
  const { t } = useI18n();
  return <div className="grid h-full w-full place-items-center bg-surface text-sm text-ink-3">{t("common.loadingMap")}</div>;
}
const loading = () => <MapLoading />;

const GoogleMapView = dynamic(() => import("./GoogleMapView"), { ssr: false, loading });
const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading });

/**
 * Google Maps when a key is configured; otherwise the free OpenFreeMap /
 * OpenStreetMap map, so the site always works (demo mode, no key yet).
 */
export default function LiveMap(props: MapViewProps) {
  const { apiKey, mapId } = useMapsConfig();
  return apiKey ? <GoogleMapView {...props} apiKey={apiKey} mapId={mapId} /> : <LeafletMap {...props} />;
}
