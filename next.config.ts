import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["linkedom"],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs references Node built-ins (only used when running under Node); stub them in the browser.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, http: false, path: false, os: false, stream: false, zlib: false };
    }
    return config;
  },
};

export default nextConfig;
