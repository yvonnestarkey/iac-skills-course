"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function RoleSwitcher({ current }: { current: "students" | "coach" }) {
  const router = useRouter();
  const { setSession, setNotice, setPlannerAdjust } = useStore();

  const switchRole = (value: string) => {
    setNotice("");
    setPlannerAdjust(false);
    if (value === "coach") {
      setSession({ role: "coach", id: "coach" });
      router.push("/coach");
      return;
    }
    router.push("/coach/preview");
  };

  return (
    <label className="role-chip">
      View as
      <select id="role" value={current} onChange={(event) => switchRole(event.target.value)}>
        <option value="students">Students</option>
        <option value="coach">Coach</option>
      </select>
    </label>
  );
}
