/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude playwright from client-side bundle
      config.externals = config.externals || []
      config.externals.push({
        'playwright': 'commonjs playwright',
      })
    }
    return config
  },
}

module.exports = nextConfig

