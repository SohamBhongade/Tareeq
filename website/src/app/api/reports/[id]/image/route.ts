import { getSession } from "@/lib/auth";
import { getStore, decodeImage } from "@/lib/store";

/*
 * Report photos.
 *   ?w=160   → a small WebP copy (list thumbnails), ~5 KB instead of ~60 KB
 *   ?w=1200  → a large WebP copy (issue page)
 *   no ?w    → the original photo
 * Resized copies are kept in memory, so each one is only made once.
 * If `sharp` (installed with Next.js) isn't available, the original is sent.
 */
const WIDTHS = [96, 160, 320, 640, 1200];
const CACHE_MAX = 300;
const cache = new Map<string, { bytes: Uint8Array; mime: string }>();

type Sharp = (input: Buffer) => {
  rotate: () => ReturnType<Sharp>;
  resize: (o: { width: number; withoutEnlargement: boolean }) => ReturnType<Sharp>;
  webp: (o: { quality: number }) => ReturnType<Sharp>;
  toBuffer: () => Promise<Buffer>;
};
let sharpLoad: Promise<Sharp | null> | null = null;
function loadSharp() {
  sharpLoad ??= import("sharp").then((m) => (m.default ?? m) as unknown as Sharp).catch(() => null);
  return sharpLoad;
}

function remember(key: string, value: { bytes: Uint8Array; mime: string }) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const kind = params.get("kind") === "proof" ? "proof" : "photo";
  const asked = Number(params.get("w")) || 0;
  const width = asked ? WIDTHS.find((w) => w >= asked) ?? WIDTHS[WIDTHS.length - 1] : 0;

  // A report's own photo never changes, so browsers may keep it for a week.
  // Proof photos can be replaced (rejected → resubmitted), so keep those briefly.
  const cacheControl = kind === "photo" ? "private, max-age=604800, immutable" : "private, max-age=300";
  const key = `${id}|${kind}|${width}`;

  const hit = cache.get(key);
  if (hit && kind === "photo") {
    return new Response(hit.bytes as BodyInit, { headers: { "Content-Type": hit.mime, "Cache-Control": cacheControl } });
  }

  const img = decodeImage(await getStore().getImage(id, kind));
  if (!img) return new Response("Not found", { status: 404 });

  let out: { bytes: Uint8Array; mime: string } = { bytes: new Uint8Array(img.bytes), mime: img.mime };
  if (width) {
    const sharp = await loadSharp();
    if (sharp) {
      try {
        const buf = await sharp(img.bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
        if (buf.length < img.bytes.length) out = { bytes: new Uint8Array(buf), mime: "image/webp" };
      } catch {
        /* unreadable image: send the original */
      }
    }
  }
  if (kind === "photo" && width) remember(key, out); // originals aren't kept in memory
  return new Response(out.bytes as BodyInit, { headers: { "Content-Type": out.mime, "Cache-Control": cacheControl } });
}
