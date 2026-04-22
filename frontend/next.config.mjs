/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

// ── Security headers ──────────────────────────────────────────────────────────
//
// Applied to every response.  Tighten the CSP further once Azure Blob Storage
// signed-URL patterns are known (add *.blob.core.windows.net to connect-src
// and img-src if evidence files are served directly from Blob rather than
// proxied through the backend).
//
const CSP = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline' for hydration scripts.
  // Dev mode (Turbopack) also needs 'unsafe-eval' for HMR/source maps.
  // Production builds do not use eval — it is stripped from prod CSP.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  // Tailwind generates class-based styles; some components use inline style props.
  "style-src 'self' 'unsafe-inline'",
  // All API traffic goes through the /api/* proxy → same origin.
  // Dev mode adds ws://* for Turbopack hot-reload WebSocket.
  // Add *.blob.core.windows.net here once Azure Blob signed URLs are in use.
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  // Allow data: URIs for base64 images, blob: for browser-generated object URLs.
  "img-src 'self' data: blob:",
  // No external fonts — all assets are self-hosted.
  "font-src 'self'",
  // Disallow all embedded frames.
  "frame-src 'none'",
  // Prevent this page from being embedded in any frame.
  "frame-ancestors 'none'",
  // Block Flash, PDFs loaded as plugins, etc.
  "object-src 'none'",
  // Prevent <base> tag hijacking.
  "base-uri 'self'",
  // Form submissions must stay on the same origin.
  "form-action 'self'",
  // Upgrade any accidental http:// sub-resource requests to https:// in prod.
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  // Prevent MIME-type sniffing attacks.
  { key: "X-Content-Type-Options",  value: "nosniff" },
  // Disallow this page from being embedded in iframes (legacy browsers).
  { key: "X-Frame-Options",         value: "DENY" },
  // Only send the origin as referrer on cross-origin requests.
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  // Restrict access to sensitive browser APIs this app doesn't use.
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // Force HTTPS for one year in production (do NOT set in local/dev).
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }] : []),
  // CSP is a production-only control.
  // In dev, the frontend calls the backend cross-origin (localhost:3002 → 127.0.0.1:8000)
  // and Turbopack needs eval + WebSocket — applying CSP in dev breaks both.
  ...(isProd ? [{ key: "Content-Security-Policy", value: CSP }] : []),
];

// ── Warn loudly if required production env vars are missing ──────────────────
if (isProd) {
  if (!process.env.BACKEND_URL) {
    console.warn(
      "[next.config] WARNING: BACKEND_URL is not set. " +
      "The /api/* proxy will fall back to http://localhost:8000, " +
      "which will not work in a deployed environment."
    );
  }
}

// ── Next.js config ────────────────────────────────────────────────────────────
const nextConfig = {
  // Standalone output for Docker — produces a minimal self-contained build.
  output: "standalone",

  // Attach security headers to every route.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // Proxy /api/* to the FastAPI backend — avoids CORS and works in any environment.
  async rewrites() {
    const apiBase = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
