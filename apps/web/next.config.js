/** @type {import('next').NextConfig} */

const isDocker = process.env.DEPLOY_TARGET === 'railway';

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // standalone ONLY for Railway/Docker — Vercel manages its own output
  ...(isDocker && { output: 'standalone' }),

  reactStrictMode: true,

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'kafkajs':       false,
        'ioredis':       false,
        '@prisma/client':false,
        'bcryptjs':      false,
      };
    }
    return config;
  },

  experimental: {
    optimizePackageImports: ['recharts'],
  },
};

module.exports = nextConfig;
