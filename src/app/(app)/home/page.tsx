import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DownloadOfflineButton } from "@/components/DownloadOfflineButton";
import { InboxBoard } from "@/components/InboxBoard";
import { loadInboxPageData } from "@/lib/inbox";
import { requireHomeSession } from "@/lib/session";

function milestoneSubtitle(milestone: { title: string; startDate: Date } | null) {
  if (!milestone) return "Tasks, asks, and shopping in one list";
  return `Next: ${milestone.title} · ${milestone.startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export default async function HomeInboxPage() {
  const session = await requireHomeSession();
  const data = await loadInboxPageData(session);

  return (
    <>
      <AppHeader
        session={session}
        title="Home"
        subtitle={
          session.canSeeCalendar && data.milestone
            ? milestoneSubtitle(data.milestone)
            : session.assigneeFilter?.length
              ? "Your assigned items"
              : "Tasks, asks, and shopping in one list"
        }
      />
      <Suspense>
        <InboxBoard
          session={session}
          sections={data.sections}
          accounts={data.accounts}
          people={data.people}
          tasks={data.tasks}
          whoChips={data.whoChips}
        />
      </Suspense>
      <div className="pt-2">
        <DownloadOfflineButton />
      </div>
    </>
  );
}
