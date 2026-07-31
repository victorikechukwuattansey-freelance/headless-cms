/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'platform-lookaside.fbsbx.com',
      'pbs.twimg.com',
      'media.licdn.com',
      'images.unsplash.com',
    ],
  },
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
