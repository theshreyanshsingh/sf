import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d1i7vml66l0zs0.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "us.posthog.com",
        pathname: "/**",
      },
    ],
  },
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/projects/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
  webpack(config) {
    // Allow importing .html files as raw strings
    config.module.rules.push({
      test: /\.html$/i,
      type: "asset/source",
    });

    return config;
  },
};

export default nextConfig;
