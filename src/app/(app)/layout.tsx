import { BottomNav } from "@/components/BottomNav";
import { requirePageSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();

  return (
    <div className="app-shell">
      {children}
      <BottomNav session={session} />
    </div>
  );
}
