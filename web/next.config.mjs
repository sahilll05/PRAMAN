/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@pramana/chain", "@pramana/indexer"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
