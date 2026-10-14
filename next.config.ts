import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
        allowedDevOrigins: ['192.168.0.102'],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
