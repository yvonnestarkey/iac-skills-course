import type { EntitlementStatus } from "@/lib/commerce";

export type EntitlementSource = "signup" | "stripe" | "admin";

export function normalizeEntitlementSource(value: unknown): EntitlementSource {
  if (value === "admin" || value === "stripe" || value === "signup") return value;
  return "signup";
}

export function accountAccessCopy(
  entitlement: EntitlementStatus | "staff" | null | undefined,
  source?: EntitlementSource | null
): { title: string; body: string } {
  if (entitlement === "full" && source === "admin") {
    return {
      title: "Full course access — complimentary",
      body: "You have complimentary full access to the IAC Skills Course on this account. This was granted by the course team, not purchased.",
    };
  }
  if (entitlement === "full" || entitlement === "staff") {
    return {
      title: "Full Jan 2027 access",
      body: "Payment received. You have access to the complete IAC Skills Course on this account.",
    };
  }
  if (entitlement === "free_preview") {
    return {
      title: "Free preview",
      body: "You can open the designated preview lessons. Unlock the full course to continue on this same account.",
    };
  }
  return {
    title: "Course access",
    body: "Course access is loading.",
  };
}
