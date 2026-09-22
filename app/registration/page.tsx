import type { Metadata } from "next";
import RegistrationLanding from "@/components/sales/RegistrationLanding";
import { REGISTRATION_HEADLINE } from "@/lib/sales-copy";

const title = "Register for a free preview — IAC Skills Board Course";
const description = REGISTRATION_HEADLINE;
const shareImage = {
  url: "/iac-jan-2027-skills-board-course.png",
  width: 760,
  height: 420,
  alt: "IAC January 2027 Skills Board Course",
};

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/registration",
    siteName: "Accounting Study Advice",
    type: "website",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [shareImage.url],
  },
};

export default function RegistrationPage() {
  return <RegistrationLanding />;
}
