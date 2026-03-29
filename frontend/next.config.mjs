/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker — produces a minimal self-contained build
  output: "standalone",

  // Proxy /api/* to the FastAPI backend — avoids CORS and works in any environment
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
