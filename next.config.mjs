/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  env: {
    TEST_MODE: String(process.env.TEST_MODE ?? '').trim().toLowerCase() === 'true' ? 'true' : 'false'
  },
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["lucide-react"]
  }
};

export default nextConfig;
