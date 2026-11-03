"use client";
/*
 * Getting the phone's location, the same way on Android and iPhone.
 *
 * - Never asks on page load unless permission was already given: a surprise
 *   prompt annoys people, and Chrome on Android refuses to show it at all while
 *   another app floats over the screen (e.g. a video-call bubble) — that's the
 *   "This site can't ask for your permission" box.
 * - If precise GPS is slow (indoors, iPhone), retries once in a faster,
 *   less precise mode before giving up.
 * - Tells the caller *why* it failed, so the page can show the right help.
 */

export type GeoFail = "denied" | "timeout" | "insecure" | "unsupported";
export type GeoPermission = "granted" | "denied" | "prompt" | "unknown";

export function phoneKind(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but has touch.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** Has this site already been allowed / blocked? "unknown" on browsers that can't say (older iPhones). */
export async function geoPermission(): Promise<GeoPermission> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const s = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return s.state as GeoPermission;
  } catch {
    return "unknown";
  }
}

function once(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

/** Current position, or throws a GeoFail reason. */
export async function getPosition(): Promise<GeolocationPosition> {
  if (typeof window !== "undefined" && !window.isSecureContext) throw "insecure" as GeoFail;
  if (!("geolocation" in navigator)) throw "unsupported" as GeoFail;
  try {
    return await once({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  } catch (e) {
    const err = e as GeolocationPositionError;
    if (err?.code === 1) throw "denied" as GeoFail; // PERMISSION_DENIED (also when Chrome blocks the prompt)
    // TIMEOUT / POSITION_UNAVAILABLE: try a quicker, Wi-Fi/cell based fix.
    try {
      return await once({ enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 });
    } catch (e2) {
      throw ((e2 as GeolocationPositionError)?.code === 1 ? "denied" : "timeout") as GeoFail;
    }
  }
}

/** Message key explaining a failure, tailored to the phone. */
export function geoFailKey(reason: GeoFail): "geo.deniedIos" | "geo.deniedAndroid" | "geo.denied" | "geo.timeout" | "geo.insecure" | "geo.unsupported" {
  if (reason === "denied") {
    const k = phoneKind();
    return k === "ios" ? "geo.deniedIos" : k === "android" ? "geo.deniedAndroid" : "geo.denied";
  }
  return reason === "timeout" ? "geo.timeout" : reason === "insecure" ? "geo.insecure" : "geo.unsupported";
}
