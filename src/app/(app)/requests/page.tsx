import { redirect } from "next/navigation";

/** @deprecated Stage B — Ask lives on Home. */
export default function RequestsPage() {
  redirect("/today?filter=asks");
}
