import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Disable development indicators (removes the circle button in dev mode)
  devIndicators: {
    position: 'bottom-right',
  },
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
  },
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      '@assistant-ui/react',
      '@assistant-ui/react-ai-sdk',
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-tooltip',
      'react-markdown',
    ],
    // Enable faster refresh
    optimizeCss: true,
  },
  
  // Reduce bundle size and improve performance
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Aggressive tree shaking and optimization
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for better caching
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
  
  // Turbopack configuration (required when webpack config is present)
  turbopack: {},
  
  // Headers for better caching and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
