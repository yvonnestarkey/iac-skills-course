import StudentLoginForm from "@/components/student/StudentLoginForm";
import { StudentSessionProvider } from "@/lib/student-session";

export default function RegisterPage() {
  return (
    <StudentSessionProvider>
      <StudentLoginForm initialMode="signup" />
    </StudentSessionProvider>
  );
}
