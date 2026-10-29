import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.DOCKER ? 'standalone' : undefined,
  reactStrictMode: false,
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // vinext treats every multipart POST without Next-Action as a progressive
  // server action first. Default bodySizeLimit is 1MB and returns plain-text
  // "Payload Too Large" — which breaks enterprise asset uploads (FormData) to
  // /api/pitchpro/assets before the route handler runs. Keep in sync with
  // MAX_ENTERPRISE_ASSET_BYTES in the assets route.
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
