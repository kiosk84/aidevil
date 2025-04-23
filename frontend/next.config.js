/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow these origins for dev server cross-origin requests
  allowedDevOrigins: ['http://localhost:3000', 'http://192.168.0.107:3000', 'http://192.168.0.107'],
};

module.exports = nextConfig;
