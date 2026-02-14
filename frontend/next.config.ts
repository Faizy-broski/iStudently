import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Static export for cPanel deployment
  // output: 'export',
  
  trailingSlash: true,

  // TypeScript build configuration
  typescript: {
    ignoreBuildErrors: true, // Ignore TypeScript errors during build
  },
  
  images: {
    unoptimized: true, // Required for static export
  },
  
  // Production optimizations
  reactStrictMode: true,
}

export default nextConfig 