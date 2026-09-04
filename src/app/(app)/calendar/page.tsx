import { redirect } from "next/navigation";

/** Legacy calendar URL — PLAN destination is /plan/calendar. */
export default function CalendarPage() {
  redirect("/plan/calendar");
}
