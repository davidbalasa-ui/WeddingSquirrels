import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { TaskWorkspaceForm } from "@/components/TaskWorkspaceForm";
import { getTaskWorkspace } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageSession({ need: "canSeeTasks" });
  const { id } = await params;
  const task = await getTaskWorkspace(session, id);
  if (!task) notFound();

  return (
    <>
      <AppHeader session={session} title={task.title} subtitle="Decision workspace" />
      <Link href="/today" className="mb-3 inline-block text-sm font-semibold text-[var(--accent)]">
        ← Back to Today
      </Link>
      <TaskWorkspaceForm task={task} />
    </>
  );
}
