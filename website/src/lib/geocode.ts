import "server-only";

export const DEFAULT_CITY = "Ras Al Khaimah, UAE";

/**
 * Turns coordinates into a readable street address.
 *
 * 1. Google Geocoding API when GOOGLE_MAPS_SERVER_KEY is set — the most
 *    accurate option for UAE addresses.
 * 2. OpenStreetMap Nominatim otherwise (free, no key).
 * 3. The city name if both fail. The coordinates are always stored anyway.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (key) {
    const viaGoogle = await googleReverse(lat, lng, key);
    if (viaGoogle) return viaGoogle;
  }
  return (await nominatimReverse(lat, lng)) ?? DEFAULT_CITY;
}

async function googleReverse(lat: number, lng: number, key: string): Promise<string | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("language", "en");
    url.searchParams.set("region", "ae");
    url.searchParams.set("key", key);
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: { formatted_address: string; types: string[] }[];
    };
    if (j.status !== "OK" || !j.results?.length) {
      if (j.status !== "ZERO_RESULTS") console.warn("[geocode] Google:", j.status, j.error_message ?? "");
      return null;
    }
    // Prefer a street-level result over plus codes / whole-city results.
    const best =
      j.results.find((r) => r.types.some((t) => ["street_address", "premise", "route", "establishment"].includes(t))) ??
      j.results.find((r) => !r.types.includes("plus_code")) ??
      j.results[0];
    return best.formatted_address.replace(/\s*-\s*United Arab Emirates$/i, "").replace(/,\s*United Arab Emirates$/i, "");
  } catch {
    return null;
  }
}

async function nominatimReverse(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("accept-language", "en");
    const res = await fetch(url, {
      headers: { "User-Agent": "Tareeq/2.0 (civic reporting, Ras Al Khaimah)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { address?: Record<string, string>; display_name?: string };
    const a = j.address ?? {};
    const parts = [
      [a.house_number, a.road].filter(Boolean).join(" "),
      a.neighbourhood || a.suburb || a.quarter,
      a.city || a.town || a.village || a.state,
    ].filter((x): x is string => !!x && x.trim().length > 0);
    const unique = [...new Set(parts)];
    return unique.length ? unique.join(", ") : j.display_name ?? null;
  } catch {
    return null;
  }
}
