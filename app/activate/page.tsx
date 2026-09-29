import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ActivateAccountForm from "@/components/student/ActivateAccountForm";
import { activatePageHeading } from "@/lib/account-recovery";

export const metadata: Metadata = {
  title: `${activatePageHeading()} · IAC Skills Course`,
};

export default function ActivatePage() {
  return (
    <>
      <header className="topbar">
        <BrandMark href="/" />
        <Link className="ghost" href="/login">
          Student Login
        </Link>
      </header>
      <ActivateAccountForm />
    </>
  );
}
