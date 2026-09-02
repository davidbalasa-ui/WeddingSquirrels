import { redirect } from "next/navigation";

export default function GuestsRedirectPage() {
  redirect("/people?tab=guests");
}
