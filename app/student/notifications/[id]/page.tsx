"use client";

import { useParams } from "next/navigation";
import StudentNotificationsInbox from "@/components/student/StudentNotificationsInbox";

export default function StudentNotificationDetailPage() {
  const params = useParams<{ id: string }>();
  return <StudentNotificationsInbox selectedId={params.id} />;
}
