import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { firstAllowedRoute } from "@/lib/routes";
import { PinPad } from "@/components/PinPad";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect(firstAllowedRoute(session) ?? "/no-access");

  return (
    <main className="app-shell">
      <PinPad />
    </main>
  );
}
