import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensurePersonByName, resolveAssigneeIds, setTaskAssignees } from "../src/lib/people";

const prisma = new PrismaClient();

async function main() {
  console.log("Validating task ownership…");

  // 1) Create a person not on the original roster
  const newbie = await ensurePersonByName("Avalon Planner");
  if (!newbie) throw new Error("Failed to create new person");
  console.log("✓ Created/found person:", newbie.id, newbie.name);

  // 2) Create a new task owned by that person
  const created = await prisma.task.create({
    data: {
      title: "Ownership validation task",
      summary: "Temporary validation row",
      planNotes: "Assigned to Avalon Planner",
      status: "todo",
      amountSpent: 0,
      sortOrder: 9999,
    },
  });
  await setTaskAssignees(created.id, [newbie.id]);

  const createdLoaded = await prisma.task.findUnique({
    where: { id: created.id },
    include: { assignees: { include: { person: true } } },
  });
  const createdOwners = createdLoaded?.assignees.map((a) => a.person.name) || [];
  if (!createdOwners.includes("Avalon Planner")) {
    throw new Error(`New task owners wrong: ${createdOwners.join(", ")}`);
  }
  console.log("✓ New task assigned to:", createdOwners.join(", "));

  // 3) Reassign an existing package to David + Avalon
  const existing = await prisma.task.findFirst({
    where: { parentId: null, NOT: { id: created.id } },
    include: { assignees: true },
  });
  if (!existing) throw new Error("No existing package to reassign");

  const before = existing.assignees.map((a) => a.personId);
  const nextOwners = await resolveAssigneeIds(["david"], "Avalon Planner", {
    fallback: before,
  });
  await setTaskAssignees(existing.id, nextOwners);

  const after = await prisma.task.findUnique({
    where: { id: existing.id },
    include: { assignees: { include: { person: true } } },
  });
  const afterNames = after?.assignees.map((a) => a.person.name).sort() || [];
  if (!afterNames.includes("David") || !afterNames.includes("Avalon Planner")) {
    throw new Error(`Reassign failed: ${afterNames.join(", ")}`);
  }
  console.log(`✓ Reassigned "${existing.title}" to:`, afterNames.join(", "));

  // Restore previous owners on the existing task
  await setTaskAssignees(existing.id, before.length ? before : ["david", "haley"]);
  console.log("✓ Restored original owners on existing task");

  // Cleanup validation task + keep Avalon person (useful roster addition)
  await prisma.taskAssignee.deleteMany({ where: { taskId: created.id } });
  await prisma.task.delete({ where: { id: created.id } });
  console.log("✓ Cleaned up validation task");

  console.log("OWNERSHIP VALIDATION PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
