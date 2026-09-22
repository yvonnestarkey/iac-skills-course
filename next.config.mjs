/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["openai", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
