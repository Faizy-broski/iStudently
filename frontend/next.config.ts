import type { NextConfig } from "next"
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Static export for cPanel deployment
  output: 'standalone',
  
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

  // Turbopack resolveAlias for next-intl (Next.js 16 uses top-level 'turbopack' key)
  turbopack: {
    resolveAlias: {
      'next-intl/config': './src/i18n/request.ts',
    },
  },
}

export default withNextIntl(nextConfig)
