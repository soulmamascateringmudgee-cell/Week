/** @type {import('next').NextConfig} */
const nextConfig = {
  // The quantity tables are the product. Keeping them in server-only modules
  // means they are never shipped to the browser.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
