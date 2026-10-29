const CLASS_HOSTS = ["class.accountingstudyadvice.com", "class.localhost", "class.local"];

/** Other courses on class. map to /courses/<slug>. IAC is never kept on class. Keep in sync with classHostCoursePaths(). */
const CLASS_COURSES = [
  { slug: "mindset-masterclass", internal: "mindset-masterclass" },
  { slug: "teaching-mindset-skills", internal: "teaching-mindset-skills" },
  { slug: "growthmindseteducators", internal: "teaching-mindset-skills" },
  { slug: "what-firms-want", internal: "what-firms-want" },
  { slug: "trainee-course", internal: "what-firms-want" },
  { slug: "isa-520-analytical-review", internal: "isa-520-analytical-review" },
  { slug: "navigating-reference-books", internal: "navigating-reference-books" },
  { slug: "audit-risk-and-planning", internal: "audit-risk-and-planning" },
  { slug: "auditrisk", internal: "audit-risk-and-planning" },
  { slug: "finalisation-of-the-audit", internal: "finalisation-of-the-audit" },
  { slug: "auditing-controls", internal: "auditing-controls" },
  { slug: "controls", internal: "auditing-controls" },
  { slug: "auditing-substantive-procedures", internal: "auditing-substantive-procedures" },
  { slug: "substantive", internal: "auditing-substantive-procedures" },
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
