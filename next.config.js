/** @type {import('next').NextConfig} */
const nextConfig = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  outputFileTracingRoot: require("path").join(__dirname),
};

module.exports = nextConfig;
