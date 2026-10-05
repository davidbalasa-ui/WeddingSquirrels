import { MessageThreadList } from "@/components/MessageThreadList";
import { V2PageHeader } from "@/components/V2PageHeader";
import { listMessageThreads, listThreadRecipients } from "@/lib/messages";
import { requirePageSession } from "@/lib/session";

export default async function MessagesPage() {
  const session = await requirePageSession({ need: "canSeeRequests" });
  const [threads, recipients] = await Promise.all([
    listMessageThreads(session),
    listThreadRecipients(session),
  ]);

  return (
    <>
      <V2PageHeader session={session} title="Messages" subtitle="Asks and conversations" />
      <MessageThreadList threads={threads} recipients={recipients} />
    </>
  );
}
