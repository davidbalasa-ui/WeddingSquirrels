"use client";

import { useSearchParams } from "next/navigation";
import { InboxAddBar } from "@/components/InboxAddBar";
import type { AccountOption, PersonOption, TaskOption } from "@/lib/inbox";
import type { SessionAccount } from "@/lib/types";

export function TodayInboxAddBar({
  session,
  accounts,
  people,
  tasks,
}: {
  session: SessionAccount;
  accounts: AccountOption[];
  people: PersonOption[];
  tasks: TaskOption[];
}) {
  const params = useSearchParams();
  const who = params.get("who") || "all";

  const preferredAssigneeIds =
    who !== "all" && who !== "both"
      ? [who]
      : who === "both"
        ? ["david", "haley"]
        : undefined;

  return (
    <InboxAddBar
      session={session}
      accounts={accounts}
      people={people}
      tasks={tasks}
      preferredAssigneeIds={preferredAssigneeIds}
      pinToTop
    />
  );
}
