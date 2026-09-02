import type { SessionAccount } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

export function V2PageHeader({
  session,
  title,
  subtitle,
  children,
}: {
  session: SessionAccount;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <AppHeader session={session} title={title} subtitle={subtitle}>
      {children}
    </AppHeader>
  );
}
