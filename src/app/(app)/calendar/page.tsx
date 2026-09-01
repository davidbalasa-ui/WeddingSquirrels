import { redirect } from "next/navigation";

/** @deprecated Calendar month grid removed — milestones live on Today. */
export default function CalendarPage() {
  redirect("/today");
}
