import { redirect } from "next/navigation";

/** @deprecated Stage B — Today is Home. */
export default function TodayPage() {
  redirect("/home");
}
