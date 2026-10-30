import { withUser, json, fail } from "@/lib/http";
import { reverseGeocode } from "@/lib/geocode";

export const GET = withUser(async (_user, req: Request) => {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail("Missing coordinates.");
  return json({ address: await reverseGeocode(lat, lng) });
});
