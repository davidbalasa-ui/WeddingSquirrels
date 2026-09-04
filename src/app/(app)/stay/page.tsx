import { redirect } from "next/navigation";

/** Legacy stay URL — PLAN destination is /plan/stay. */
export default function StayPage() {
  redirect("/plan/stay");
}
