import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@shree/domain'],
  serverExternalPackages: ['pdfkit'],
  experimental: { cpus: 2, memoryBasedWorkersCount: true },
  poweredByHeader: false,
};
export default config;
