import { accountActivationLabel, type AccountActivationStatus } from "@/lib/account-activation";

export default function AccountActivationBadge({ status }: { status?: AccountActivationStatus | null }) {
  const value = status === "activated" || status === "needs_activation" ? status : "unavailable";
  const tone = value === "activated" ? "ok" : value === "needs_activation" ? "warn" : "";
  return (
    <span className={`badge account-activation-badge${tone ? ` ${tone}` : ""}`}>
      {accountActivationLabel(value)}
    </span>
  );
}
