import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PinPad } from "@/components/PinPad";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/today");

  return (
    <main className="app-shell">
      <PinPad />
    </main>
  );
}
