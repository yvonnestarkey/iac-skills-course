const CLASS_HOSTS = ["class.accountingstudyadvice.com", "class.localhost", "class.local"];
const APEX_HOSTS = ["accountingstudyadvice.com", "www.accountingstudyadvice.com"];

/** Other courses on class. map to /courses/<slug>. IAC is never kept on class. */
const CLASS_COURSES = [
  { slug: "cta-skills", internal: "cta-skills" },
  { slug: "controls", internal: "controls" },
  { slug: "auditrisk", internal: "controls" },
  { slug: "substantive", internal: "substantive" },
  { slug: "strategy-mindset", internal: "strategy-mindset" },
];

function classHostRules() {
  /** @type {{ source: string, has: { type: string, value: string }[], destination: string }}[] */
  const rules = [];
  for (const host of CLASS_HOSTS) {
    const has = [{ type: "host", value: host }];
    rules.push({ source: "/", has, destination: "/courses" });
    for (const course of CLASS_COURSES) {
      rules.push({ source: `/${course.slug}`, has, destination: `/courses/${course.internal}` });
      rules.push({
        source: `/${course.slug}/:path*`,
        has,
        destination: `/courses/${course.internal}/:path*`,
      });
    }
  }
  return rules;
}

function apexHomeRedirects() {
  return APEX_HOSTS.map((host) => ({
    source: "/",
    has: [{ type: "host", value: host }],
    destination: "/courses",
    permanent: false,
  }));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/coach/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
  async redirects() {
    return apexHomeRedirects();
  },
  async rewrites() {
    return classHostRules();
  },
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
