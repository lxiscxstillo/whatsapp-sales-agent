/** @type {import('next').NextConfig} */
const nextConfig = {
  // output:'standalone' generates a self-contained Node.js server needed for
  // Docker deployments (Railway). In Vercel, the platform manages output
  // directly, so we activate standalone only when BUILD_TARGET=docker.
  ...(process.env.BUILD_TARGET === 'docker' && { output: 'standalone' }),
};

module.exports = nextConfig;
