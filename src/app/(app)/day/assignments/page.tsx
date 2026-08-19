import { AppHeader } from "@/components/AppHeader";
import { AssignmentPanel } from "@/components/AssignmentPanel";
import { DayTabs } from "@/components/DayTabs";
import { timelineEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function DayAssignmentsPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const canEdit = timelineEditable(session);

  const [assignments, people] = await Promise.all([
    prisma.dayAssignment.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        assignees: { include: { person: { select: { id: true, name: true } } } },
      },
    }),
    prisma.person.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <>
      <AppHeader
        session={session}
        title="Day-of"
        subtitle="Assignments · who handles what"
      />
      <DayTabs />
      <AssignmentPanel
        canEdit={canEdit}
        people={people.map((person) => ({ id: person.id, name: person.name }))}
        assignments={assignments.map((assignment) => ({
          id: assignment.id,
          title: assignment.title,
          notes: assignment.notes,
          assignees: assignment.assignees.map((row) => ({
            personId: row.personId,
            personName: row.person.name,
          })),
        }))}
      />
    </>
  );
}
