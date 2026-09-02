import { redirect } from "next/navigation";

export default function PeopleContactsRedirectPage() {
  redirect("/people?tab=day-of");
}
