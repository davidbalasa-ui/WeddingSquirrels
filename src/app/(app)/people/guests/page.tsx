import { redirect } from "next/navigation";

export default function PeopleGuestsRedirectPage() {
  redirect("/people?tab=guests");
}
