import { AppHeader } from "@/components/AppHeader";
import { DayTabs } from "@/components/DayTabs";
import { NeedSomeone } from "@/components/DayOfContacts";
import { loadDayOfExperience } from "@/lib/day-of-page";
import { requirePageSession } from "@/lib/session";

export default async function DayContactsPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const { view } = await loadDayOfExperience(session);

  return (
    <>
      <AppHeader
        session={session}
        title="Day-of"
        subtitle="Contacts · who to call on the day"
      />
      <DayTabs />
      {view.contacts.length > 0 ? (
        <NeedSomeone contacts={view.contacts} className="mt-2" />
      ) : (
        <p className="text-base text-muted">No day-of contacts have been added yet.</p>
      )}
    </>
  );
}
