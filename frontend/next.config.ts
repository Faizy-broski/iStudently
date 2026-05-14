import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  output: 'standalone',
  trailingSlash: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
  },

  reactStrictMode: true,

  serverActions: {
    allowedOrigins: [
      '102.213.183.100:8080',
      '102.213.183.100:3005',
      '102.213.183.100',
    ],
  },
}

export default nextConfig
