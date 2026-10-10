import { redirect } from "next/navigation";

/** Legacy stay URL; Stay has no page since 2026-10-10. */
export default function StayPage() {
  redirect("/plan");
}
