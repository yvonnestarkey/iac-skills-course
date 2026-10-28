import type { Metadata } from "next";
import ProfileEditor from "@/components/account/ProfileEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Your profile · Coach",
};

export default function CoachAccountPage() {
  return (
    <div className="coach-page">
      <article className="card login">
        <p className="kicker">Account</p>
        <h1 className="brand">Your profile</h1>
        <p className="muted">Update the name, email, and phone we use for your coach account.</p>
        <ProfileEditor showAccountability={false} />
      </article>
    </div>
  );
}
