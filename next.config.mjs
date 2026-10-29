const CLASS_HOSTS = ["class.accountingstudyadvice.com", "class.localhost", "class.local"];

/** Short public slugs on class. Internal app routes live under /courses/[slug]. */
const CLASS_COURSES = [
  { slug: "iac-skills", internal: "iac-skills", iacClassroom: true },
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
      if (course.iacClassroom) {
        rules.push({ source: `/${course.slug}/learn`, has, destination: "/student" });
        rules.push({ source: `/${course.slug}/learn/:path*`, has, destination: "/student/:path*" });
        rules.push({ source: `/${course.slug}`, has, destination: `/courses/${course.internal}` });
        continue;
      }
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
