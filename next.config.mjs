/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg', '@prisma/adapter-pg', '@prisma/client'],
};

export default nextConfig;
