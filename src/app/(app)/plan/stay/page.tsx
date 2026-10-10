import { redirect } from "next/navigation";

/** David, 2026-10-10: the Airbnb sleeping arrangements are not being done, so Stay has no page. */
export default function PlanStayPage() {
  redirect("/plan");
}
