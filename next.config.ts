import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // pdfjs-dist loads its worker script and standard fonts dynamically at
  // runtime, not via a static import, so Vercel's automatic file tracing
  // misses them — force-include them so the deployed function bundle
  // actually has the files on disk.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
