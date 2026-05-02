import type { NextConfig } from "next"
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any) => {
    config.resolve.alias['next-intl/config'] = path.resolve('./src/i18n/request.ts')
    return config
  },
}

export default withNextIntl(nextConfig)
