/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a self-contained server bundle → tiny Docker image for Cloud Run.
  output: "standalone",
  reactStrictMode: true,
  images: {
    // Citizen-uploaded photos live in Cloud Storage.
    remotePatterns: [{ protocol: "https", hostname: "storage.googleapis.com" }],
  },
  experimental: {
    // Keep client JS lean — only ship what a page actually imports.
    optimizePackageImports: ["firebase"],
  },
  // Baseline security headers on every response (defence in depth).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // The citizen intake needs mic (voice), camera (photo) and
          // geolocation ("use my location") — allow self only.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
