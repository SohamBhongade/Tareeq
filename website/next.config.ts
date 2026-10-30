import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output = a small self-contained server for Cloud Run. Only
  // used in the Docker build (it sets STANDALONE=1); locally, `npm start`
  // works normally.
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  // MongoDB's driver has optional native deps; keep it out of the bundle.
  serverExternalPackages: ["mongodb"],
  // Pin the project root. Without this, Next.js can pick a parent folder
  // (e.g. C:\Users\you) if it finds another package-lock.json / node_modules
  // there, and then watches thousands of unrelated files — very slow.
  turbopack: {
    root: typeof __dirname !== "undefined" ? __dirname : process.cwd(),
  },
  // Lets phones / other PCs on your Wi-Fi open the dev server.
  // Add your own LAN address here if it changes.
  allowedDevOrigins: ["192.168.1.192"],
  // Let browsers keep avatars, logos and demo photos for a week instead of
  // re-downloading them on every page.
  async headers() {
    const week = "public, max-age=604800, stale-while-revalidate=86400";
    return ["/avatars/:path*", "/brand/:path*", "/seed/:path*"].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: week }],
    }));
  },
};

export default nextConfig;
