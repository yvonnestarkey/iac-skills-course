import type { AccessResult } from "@/lib/accessControl";
import type { EntitlementStatus } from "@/lib/commerce";

export type LessonAccessLayer = "open" | "preview" | "purchase" | "progression";

export type ComposedLessonAccess = {
  layer: LessonAccessLayer;
  canReadBody: boolean;
  access: AccessResult;
};

/**
 * can_view = preview_override OR (full commercial access AND progression unlocked).
 * Preview is a viewing exception only and does not change pedagogical state.
 */
export function composeLessonAvailability(input: {
  commercialCanRead: boolean;
  isPreviewLesson?: boolean;
  pedagogical: AccessResult;
}): ComposedLessonAccess {
  if (input.isPreviewLesson && input.commercialCanRead) {
    return {
      layer: "preview",
      canReadBody: true,
      access: { isLocked: false },
    };
  }
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
