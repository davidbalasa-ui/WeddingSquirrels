import { redirect } from "next/navigation";

/** Ask lives on Home; the conversation view is Messages. */
export default function RequestsPage() {
  redirect("/messages");
}
