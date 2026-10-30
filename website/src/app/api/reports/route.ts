import { withUser, json, fail, cleanImage } from "@/lib/http";
import { createReport, listReports } from "@/lib/reports";

export const GET = withUser(async () => json({ reports: await listReports() }));

export const POST = withUser(async (user, req: Request) => {
  const body = await req.json().catch(() => ({}));
  const img = cleanImage(body.imageBase64);
  if (!img) return fail("Please attach a photo under 6 MB.");
  const { report, exp } = await createReport(user, {
    category: String(body.category ?? ""),
    severity: Number(body.severity),
    description: String(body.description ?? ""),
    descriptionAr: typeof body.descriptionAr === "string" ? body.descriptionAr : null,
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    address: String(body.address ?? ""),
    imageBase64: img.base64,
    forceNew: body.forceNew === true,
  });
  return json({ report, exp }, 201);
});
