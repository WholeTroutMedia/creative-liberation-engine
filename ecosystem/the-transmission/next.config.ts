import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_GENKIT_URL: process.env['GENKIT_URL'] ?? 'http://localhost:4100',
  },
};

export default nextConfig;
