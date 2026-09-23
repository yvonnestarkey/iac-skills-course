import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { studentUserFromAuth, type StudentUser } from "@/lib/student-lesson";
import { isCoachAccount } from "@/lib/roles";

export async function getRequestUser(): Promise<StudentUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const store = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Components may be read-only. */
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? studentUserFromAuth(user) : null;
}

export async function requireRequestUser(): Promise<StudentUser> {
  const user = await getRequestUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export function isStaffUser(user: StudentUser | null): boolean {
  return isCoachAccount(user);
}
