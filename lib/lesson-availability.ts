import type { AccessResult } from "@/lib/accessControl";
import type { EntitlementStatus } from "@/lib/commerce";

export type LessonAccessLayer = "open" | "purchase" | "progression";

export type ComposedLessonAccess = {
  layer: LessonAccessLayer;
  canReadBody: boolean;
  access: AccessResult;
};

/**
 * Commercial entitlement and pedagogical progression are independent.
 * Full purchase only clears the purchase layer.
 */
export function composeLessonAvailability(input: {
  commercialCanRead: boolean;
  pedagogical: AccessResult;
}): ComposedLessonAccess {
  if (!input.commercialCanRead) {
    return {
      layer: "purchase",
      canReadBody: false,
      access: { isLocked: true, reason: "purchase" },
    };
  }
  if (input.pedagogical.isLocked) {
    return {
      layer: "progression",
      canReadBody: false,
      access: input.pedagogical,
    };
  }
  return {
    layer: "open",
    canReadBody: true,
    access: { isLocked: false },
  };
}

export function shouldShowBuyCourseCta(
  entitlement: EntitlementStatus | "staff" | null | undefined,
  bypass = false
): boolean {
  return !bypass && entitlement === "free_preview";
}

export function shouldShowEnrolledAccess(
  entitlement: EntitlementStatus | "staff" | null | undefined,
  bypass = false
): boolean {
  return !bypass && entitlement === "full";
}
