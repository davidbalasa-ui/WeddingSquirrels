"use client";

type PersonOption = { id: string; name: string };

export function AssigneeFields({
  people,
  selectedIds,
  allowNew = true,
}: {
  people: PersonOption[];
  selectedIds?: string[];
  allowNew?: boolean;
}) {
  const selected = new Set(selectedIds ?? []);

  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Owners
        </legend>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <label
              key={person.id}
              className="owner-pill flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="assignees"
                value={person.id}
                defaultChecked={selected.size ? selected.has(person.id) : false}
                className="h-5 w-5 accent-[var(--accent)]"
              />
              {person.name}
            </label>
          ))}
        </div>
      </fieldset>

      {allowNew ? (
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Add someone new</span>
          <input
            name="newPerson"
            placeholder="e.g. Avalon, Mom, Barry"
            className="field-input"
          />
        </label>
      ) : null}
    </div>
  );
}
