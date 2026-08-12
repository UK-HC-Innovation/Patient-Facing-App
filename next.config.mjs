import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "microphone=(self)" },
          {
            key: "Content-Security-Policy",
            // Narrow baseline: /demo intentionally embeds /screening. The
            // pilot gate documents the nonce-based script/connect policy that
            // must replace this before real-family deployment.
            value: "base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'self'"
          },
          { key: "X-Content-Type-Options", value: "nosniff" }
        ]
      },
      {
        source: "/api/family/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }]
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/family",
        destination: "/ladder",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
