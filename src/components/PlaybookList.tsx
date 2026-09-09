import { groupPlaybookSections, type PlaybookItemView } from "@/lib/playbook";

export function PlaybookList({
  items,
  empty,
  showCompleted = false,
}: {
  items: PlaybookItemView[];
  empty: string;
  showCompleted?: boolean;
}) {
  const groups = groupPlaybookSections(items);
  if (groups.length === 0) {
    return <p className="text-base text-muted">{empty}</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.section} aria-labelledby={`playbook-${group.section}`}>
          <h2
            id={`playbook-${group.section}`}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
          >
            {group.section}
          </h2>
          <ol className="mt-2 divide-y divide-[var(--line)]">
            {group.items.map((item) => (
              <li key={item.sourceKey} className="py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {item.startAt ? (
                      <p className="text-sm font-semibold text-[var(--accent)]">{item.startAt}</p>
                    ) : null}
                    <p className="font-[family-name:var(--font-display)] text-[1.35rem] leading-[1.15] tracking-tight">
                      {item.title}
                    </p>
                    {item.detail ? <p className="mt-1 text-sm text-muted">{item.detail}</p> : null}
                    {item.location ? (
                      <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{item.location}</p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-1 text-sm leading-relaxed text-muted">{item.notes}</p>
                    ) : null}
                  </div>
                  {showCompleted ? (
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                      {item.completed ? "Done" : "Open"}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
