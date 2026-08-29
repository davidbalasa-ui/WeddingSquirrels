import { redirect } from "next/navigation";

/** @deprecated Calendar month grid removed — milestones live on Home. */
export default function CalendarPage() {
  redirect("/home");
}
