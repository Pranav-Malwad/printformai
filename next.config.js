/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static optimization where possible
  output: 'standalone',
  
  // Configure environment variables
  env: {
    // Fallback values for environment variables (will be overridden by actual env vars)
    NEXT_PUBLIC_BASE_API_URL: process.env.NEXT_PUBLIC_BASE_API_URL || 'https://api.heygen.com',
  },
  
  // Configure webpack to handle Node.js modules
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Don't resolve Node.js modules on the client to prevent errors
      config.resolve.fallback = {
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }
    
    // Add a rule to handle hot update files in development
    if (dev) {
      config.module.rules.push({
        test: /\.hot-update\.json$/,
        type: 'javascript/auto',
        use: [],
      });
    }
    
    return config;
  },
  
  // Configure headers to allow cross-origin requests for webpack hot updates
  async headers() {
    return [
      {
        source: '/_next/static/webpack/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  
  // Disable React StrictMode in production to avoid double rendering
  reactStrictMode: process.env.NODE_ENV !== 'production',
}

module.exports = nextConfig
