/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["openai", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/evaluate-script": ["./node_modules/pdfjs-dist/**/*"],
    "/api/exam-attempts/*/prepare-evidence": ["./node_modules/pdfjs-dist/**/*"],
    "/api/exam-attempts/*/pages": ["./node_modules/pdfjs-dist/**/*"],
    "app/api/evaluate-script/route": ["./node_modules/pdfjs-dist/**/*"],
    "app/api/exam-attempts/[id]/prepare-evidence/route": ["./node_modules/pdfjs-dist/**/*"],
  },
};

export default nextConfig;
