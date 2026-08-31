import type { SessionAccount } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

export function V2PageHeader({
  session,
  title,
  subtitle,
}: {
  session: SessionAccount;
  title: string;
  subtitle?: string;
}) {
  return <AppHeader session={session} title={title} subtitle={subtitle} />;
}
