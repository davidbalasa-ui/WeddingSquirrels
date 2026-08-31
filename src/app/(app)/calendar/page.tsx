import { redirect } from "next/navigation";

/** @deprecated V2 calendar lives under Plan. */
export default function CalendarPage() {
  redirect("/plan/calendar");
}
