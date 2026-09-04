import Link from "next/link";
import type { PlanTaskView } from "@/lib/plan";

const VIEWS: { key: PlanTaskView; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "soon", label: "Soon" },
  { key: "mine", label: "Mine" },
  { key: "done", label: "Finished" },
];

export function PlanTaskFilters({ active }: { active: PlanTaskView }) {
  return (
    <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto pb-1">
      {VIEWS.map((view) => {
        const href = view.key === "open" ? "/plan/tasks" : `/plan/tasks?view=${view.key}`;
        const isActive = active === view.key;
        return (
          <Link
            key={view.key}
            href={href}
            className="min-h-11 shrink-0 px-3 py-2 text-sm font-semibold"
            style={{
              color: isActive ? "var(--accent)" : "var(--muted)",
              boxShadow: isActive ? "inset 0 -2px 0 var(--accent)" : "none",
            }}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
