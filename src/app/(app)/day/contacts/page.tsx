import { AppHeader } from "@/components/AppHeader";
import { ContactsPanel } from "@/components/ContactsPanel";
import { DayTabs } from "@/components/DayTabs";
import { isDayOfContactName } from "@/lib/people-directory";
import { timelineEditable } from "@/lib/access";
import { loadDayOfContext } from "@/lib/day-of-page";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function DayContactsPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const canEdit = timelineEditable(session);
  const context = await loadDayOfContext();

  const contacts = await prisma.contact.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const dayOfContacts = contacts.filter(
    (contact) => contact.directoryList === "day-of" || (!contact.directoryList && isDayOfContactName(contact.name)),
  );

  return (
    <>
      <AppHeader
        session={session}
        title="Day-of"
        subtitle="Contacts · people to call on the big day"
      />
      <DayTabs showNowTab={context.showNowTab} />
      <ContactsPanel
        canEdit={canEdit}
        contacts={dayOfContacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          photoData: contact.photoData,
        }))}
      />
    </>
  );
}
