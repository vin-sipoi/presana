/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: 'bottom-right',
  },
  serverExternalPackages: ['sharp', 'protobufjs'],
  outputFileTracingRoot: '/home/kaotik/Projects/SUI-Lens/client',
  
  // Fixed API rewrites - only rewrite in development
  async rewrites() {
    return process.env.NODE_ENV === 'production' 
      ? [] // No rewrites in production - let nginx handle it
      : [
          {
            source: '/api/:path*',
            destination: 'http://localhost:3009/api/:path*',
          },
        ];
  },
};

export default nextConfig;