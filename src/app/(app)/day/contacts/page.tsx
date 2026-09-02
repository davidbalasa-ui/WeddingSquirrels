import { redirect } from "next/navigation";

export default function DayContactsRedirectPage() {
  redirect("/people?tab=day-of");
}
