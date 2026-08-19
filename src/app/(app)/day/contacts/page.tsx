import { AppHeader } from "@/components/AppHeader";
import { ContactsPanel } from "@/components/ContactsPanel";
import { DayTabs } from "@/components/DayTabs";
import { timelineEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function DayContactsPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const canEdit = timelineEditable(session);

  const contacts = await prisma.contact.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <AppHeader
        session={session}
        title="Day-of"
        subtitle="Contacts · people to call on the big day"
      />
      <DayTabs />
      <ContactsPanel
        canEdit={canEdit}
        contacts={contacts.map((contact) => ({
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
