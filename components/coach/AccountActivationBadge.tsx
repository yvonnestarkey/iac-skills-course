import { accountActivationLabel, type AccountActivationStatus } from "@/lib/account-activation";

export default function AccountActivationBadge({ status }: { status?: AccountActivationStatus | null }) {
  const value = status === "activated" ? "activated" : "needs_activation";
  return (
    <span className={`badge account-activation-badge ${value === "activated" ? "ok" : "warn"}`}>
      {accountActivationLabel(value)}
    </span>
  );
}
