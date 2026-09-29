import type { NextConfig } from "next"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Direct streaming socket rewrite for FastMCP SSE connection
      {
        source: "/sse",
        destination: `${BACKEND_URL}/sse`,
      },
      {
        source: "/messages/:path*",
        destination: `${BACKEND_URL}/messages/:path*`,
      },
      {
        source: "/mcp/:path*",
        destination: `${BACKEND_URL}/mcp/:path*`,
      },
    ]
  },
}

export default nextConfig
