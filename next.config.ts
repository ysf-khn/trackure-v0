import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Performance optimizations */
  serverExternalPackages: ["pdfkit"],

  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      "@radix-ui/react-icons",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "lucide-react",
      "date-fns",
    ],
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 31536000, // 1 year cache for images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compiler optimizations
  compiler: {
    // Remove console.logs in production
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  // Bundle analyzer (enable with ANALYZE=true)
  ...(process.env.ANALYZE === "true" && {
    webpack: (config: any) => {
      config.plugins.push(
        new (require("@next/bundle-analyzer")({
          enabled: true,
        }))()
      );
      return config;
    },
  }),

  // Headers for better caching
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      {
        // Cache static assets
        source: "/(.*)\\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
