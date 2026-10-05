import { notFound } from "next/navigation";
import { MessageThread } from "@/components/MessageThread";
import { loadMessageThread } from "@/lib/messages";
import { requirePageSession } from "@/lib/session";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeRequests" });
  const { id } = await params;
  const thread = await loadMessageThread(session, id);
  if (!thread) notFound();

  return <MessageThread thread={thread} />;
}
