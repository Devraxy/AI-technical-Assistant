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
    ],
  },
  
  // Reduce bundle size
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Tree shake unused code
      config.optimization = {
        ...config.optimization,
        usedExports: true,
      };
    }
    return config;
  },
  
  // Turbopack configuration (required when webpack config is present)
  turbopack: {},
};

export default nextConfig;
