/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    // /settings briefly replaced /account while accounts were removed.
    return [{ source: '/settings', destination: '/account', permanent: false }]
  },
};

export default nextConfig;
