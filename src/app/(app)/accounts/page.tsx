import { AppHeader } from "@/components/AppHeader";
import { createPinAccount, deletePinAccount, updatePinAccount } from "@/app/actions";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

const MODULE_FLAGS = [
  { name: "canSeeTasks", label: "Tasks" },
  { name: "canSeeBudget", label: "Money" },
  { name: "canSeeGuests", label: "Guests" },
  { name: "canSeeTimeline", label: "Day-of" },
  { name: "canSeeShop", label: "Shop" },
  { name: "canSeeCalendar", label: "Calendar" },
  { name: "canSeePeople", label: "People" },
  { name: "canSeeRequests", label: "Ask" },
  { name: "canEditBudget", label: "Edit money" },
  { name: "canEditTimeline", label: "Edit day-of" },
  { name: "canManageAccounts", label: "Manage accounts" },
] as const;

function accountSummary(account: {
  isMaster: boolean;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canSeeShop: boolean;
  canSeeCalendar: boolean;
  canSeePeople: boolean;
  canSeeRequests: boolean;
  canEditBudget: boolean;
  canEditTimeline: boolean;
  canManageAccounts: boolean;
}) {
  if (account.isMaster) return "Master · full access";
  return (
    [
      account.canSeeTasks && "Tasks",
      account.canSeeBudget && "Money",
      account.canSeeGuests && "Guests",
      account.canSeeTimeline && "Day-of",
      account.canSeeShop && "Shop",
      account.canSeeCalendar && "Cal",
      account.canSeePeople && "People",
      account.canSeeRequests && "Ask",
      account.canEditBudget && "Edit money",
      account.canEditTimeline && "Edit day-of",
      account.canManageAccounts && "Accounts",
    ]
      .filter(Boolean)
      .join(" · ") || "No modules"
  );
}

function FlagCheckboxes({
  defaults,
}: {
  defaults?: Partial<Record<(typeof MODULE_FLAGS)[number]["name"], boolean>>;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-2 text-sm">
      {MODULE_FLAGS.map((flag) => (
        <label key={flag.name} className="flex items-center gap-2">
          <input
            type="checkbox"
            name={flag.name}
            defaultChecked={defaults?.[flag.name] ?? false}
          />
          {flag.label}
        </label>
      ))}
    </fieldset>
  );
}

export default async function AccountsPage() {
  const session = await requirePageSession({ need: "canManageAccounts" });
  const [accounts, people] = await Promise.all([
    prisma.pinAccount.findMany({ orderBy: [{ isMaster: "desc" }, { name: "asc" }] }),
    prisma.person.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <AppHeader
        session={session}
        title="Accounts"
        subtitle="PINs, linked person, and module access"
      />

      <section className="card mb-4 p-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Add account</h2>
        <form action={createPinAccount} className="mt-3 flex flex-col gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Name</span>
            <input
              name="name"
              required
              placeholder="Mother in law"
              className="field-input"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">PIN</span>
            <input
              name="pin"
              required
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="0999"
              className="field-input"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-muted">Linked person (money owner filter)</span>
            <select name="linkedPersonId" defaultValue="" className="field-input">
              <option value="">None</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>

          <FlagCheckboxes
            defaults={{
              canSeeTasks: true,
              canSeeShop: true,
              canSeeCalendar: true,
              canSeePeople: true,
              canSeeRequests: true,
            }}
          />

          <fieldset>
            <legend className="mb-2 text-sm text-muted">Only show tasks for</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <label
                  key={person.id}
                  className="filter-pill flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm"
                >
                  <input type="checkbox" name="assigneeFilter" value={person.id} />
                  {person.name}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Leave all unchecked to show every task (still limited by modules).
            </p>
          </fieldset>

          <button type="submit" className="btn-primary">
            Add PIN account
          </button>
        </form>
      </section>

      <div className="flex flex-col gap-3">
        {accounts.map((account) => {
          const filter: string[] = account.assigneeFilterJson
            ? (JSON.parse(account.assigneeFilterJson) as string[])
            : [];

          return (
            <article key={account.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{account.name}</h3>
                  <p className="text-xs text-muted">{accountSummary(account)}</p>
                  {!account.isMaster && account.linkedPersonId ? (
                    <p className="mt-1 text-xs text-muted">
                      Linked:{" "}
                      {people.find((p) => p.id === account.linkedPersonId)?.name ||
                        account.linkedPersonId}
                    </p>
                  ) : null}
                  {!account.isMaster && filter.length > 0 ? (
                    <p className="mt-1 text-xs text-muted">
                      Filter:{" "}
                      {filter
                        .map((id) => people.find((p) => p.id === id)?.name || id)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">
                  Edit
                </summary>
                <form action={updatePinAccount} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={account.id} />
                  <label className="text-sm">
                    <span className="mb-1 block text-muted">Name</span>
                    <input name="name" defaultValue={account.name} className="field-input" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted">New PIN (optional)</span>
                    <input
                      name="pin"
                      inputMode="numeric"
                      pattern="\d{4,8}"
                      placeholder="Leave blank to keep"
                      className="field-input"
                    />
                  </label>
                  {!account.isMaster ? (
                    <>
                      <label className="text-sm">
                        <span className="mb-1 block text-muted">Linked person</span>
                        <select
                          name="linkedPersonId"
                          defaultValue={account.linkedPersonId ?? ""}
                          className="field-input"
                        >
                          <option value="">None</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <FlagCheckboxes
                        defaults={{
                          canSeeTasks: account.canSeeTasks,
                          canSeeBudget: account.canSeeBudget,
                          canSeeGuests: account.canSeeGuests,
                          canSeeTimeline: account.canSeeTimeline,
                          canSeeShop: account.canSeeShop,
                          canSeeCalendar: account.canSeeCalendar,
                          canSeePeople: account.canSeePeople,
                          canSeeRequests: account.canSeeRequests,
                          canEditBudget: account.canEditBudget,
                          canEditTimeline: account.canEditTimeline,
                          canManageAccounts: account.canManageAccounts,
                        }}
                      />
                      <fieldset>
                        <legend className="mb-2 text-sm text-muted">Task filter</legend>
                        <div className="flex flex-wrap gap-2">
                          {people.map((person) => (
                            <label
                              key={person.id}
                              className="filter-pill flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm"
                            >
                              <input
                                type="checkbox"
                                name="assigneeFilter"
                                value={person.id}
                                defaultChecked={filter.includes(person.id)}
                              />
                              {person.name}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  ) : (
                    <p className="text-xs text-muted">
                      Master accounts always have full access. Only name and PIN can change.
                    </p>
                  )}
                  <button type="submit" className="btn-primary">
                    Save changes
                  </button>
                </form>
                {!account.isMaster ? (
                  <form
                    action={async () => {
                      "use server";
                      await deletePinAccount(account.id);
                    }}
                    className="mt-2"
                  >
                    <button type="submit" className="text-sm font-semibold text-[var(--danger)]">
                      Delete account
                    </button>
                  </form>
                ) : null}
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}
