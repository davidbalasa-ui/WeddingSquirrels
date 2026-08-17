import { AppHeader } from "@/components/AppHeader";
import { requirePageSession } from "@/lib/session";

export default async function NoAccessPage() {
  const session = await requirePageSession();

  return (
    <>
      <AppHeader session={session} title="No access" subtitle="Ask the couple to enable a tab for this PIN." />
      <div className="card p-6 text-center text-sm text-muted">
        This account does not have permission to open any planner tabs yet.
      </div>
    </>
  );
}
