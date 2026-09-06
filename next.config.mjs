import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const appSurface = process.env.APP_SURFACE ?? "full";
const supportedAppSurfaces = new Set(["full", "foodlens"]);
if (!supportedAppSurfaces.has(appSurface)) {
  throw new Error(`APP_SURFACE must be one of: ${[...supportedAppSurfaces].join(", ")}`);
}
/**
 * Stamped onto every usage line so a report can say which build produced an answer -- the
 * first question when a junction starts answering the same input two different ways. Any
 * value that would not survive the usage schema's token rule is dropped rather than
 * emitted, because one bad envelope field rejects every batch that carries it.
 */
const buildId = (process.env.BUILD_ID ?? "dev").toLowerCase();
const usageBuildId = /^[a-z0-9][a-z0-9_.:-]{0,39}$/u.test(buildId) ? buildId : "unknown";

/** Usage recording is on unless a deployment turns it off. */
const usageTelemetry = process.env.USAGE_TELEMETRY === "0" ? "0" : "1";

const requestedDistDir = process.env.NEXT_DIST_DIR;
if (requestedDistDir && !/^\.next-package-eval-[a-f0-9]{24}$/u.test(requestedDistDir)) {
  throw new Error("NEXT_DIST_DIR must be an evaluator-owned .next-package-eval-* directory");
}
const requestedEvalBuildId = process.env.PACKAGE_LABEL_EVAL_BUILD_ID;
if (requestedDistDir && (!requestedEvalBuildId || !/^eval-[a-f0-9]{32}$/u.test(requestedEvalBuildId))) {
  throw new Error("An evaluator build needs its precommitted PACKAGE_LABEL_EVAL_BUILD_ID");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  env: {
    NEXT_PUBLIC_APP_SURFACE: appSurface,
    NEXT_PUBLIC_BUILD_ID: usageBuildId,
    NEXT_PUBLIC_USAGE_TELEMETRY: usageTelemetry
  },
  ...(appSurface === "foodlens" ? { output: "standalone" } : {}),
  ...(requestedDistDir
    ? {
        distDir: requestedDistDir,
        generateBuildId: async () => requestedEvalBuildId
      }
    : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
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
      },
      {
        // The public Food Lens door moved under the product it is a door onto. This link is
        // in the wild -- shared outside the project -- so it keeps working forever. Next
        // carries the query string through, which is what preserves ?lang=es.
        source: "/compass",
        destination: "/food/demo",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
