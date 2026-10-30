import type { Report } from "@/lib/types";

export const RAK_CENTER: [number, number] = [25.7911, 55.9432];

/** Keep the camera on the UAE, like the Android app. */
export const UAE_BOUNDS = { south: 22.5, west: 51.5, north: 26.5, east: 56.5 };

/** Marker / legend colours — vivid enough to read on the grey basemap. */
export const SEVERITY_COLORS = { critical: "#e5484d", moderate: "#f5a524", minor: "#7cc420", resolved: "#a3a39e" } as const;

export interface MapViewProps {
  reports?: Report[];
  center?: [number, number];
  zoom?: number;
  /** Single highlighted location (issue detail, report form). */
  pin?: [number, number] | null;
  pinSeverity?: number;
  /** Lets the user click the map to choose a location. */
  onPick?: (lat: number, lng: number) => void;
  /** When set, clicking a marker selects it (no popup). */
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  /** Leaves room for floating panels so the zoom buttons aren't covered. */
  controlsOffset?: { top?: number; right?: number };
  /**
   * Where the "visible middle" of the map is, in pixels from the true middle
   * (x → right, y → down). Use it when panels cover part of the map, so the
   * chosen spot lands in the open area instead of under a panel.
   */
  viewOffset?: [number, number];
  interactive?: boolean;
  className?: string;
}
