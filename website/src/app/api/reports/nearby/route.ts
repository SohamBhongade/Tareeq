import { withUser, json, fail } from "@/lib/http";
import { findDuplicates } from "@/lib/reports";

/** GET /api/reports/nearby?lat=..&lng=..&category=.. → possible duplicates. */
export const GET = withUser(async (_user, req: Request) => {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const category = url.searchParams.get("category") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !category) return fail("Missing lat, lng or category.");
  return json({ matches: await findDuplicates(lat, lng, category) });
});
