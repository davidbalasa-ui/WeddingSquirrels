import { AppHeader } from "@/components/AppHeader";
import { createPinAccount, deletePinAccount, updatePinAccount } from "@/app/actions";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

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
        subtitle="PINs, names, and what each person can see"
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
              className="w-full rounded-xl border border-line bg-transparent px-3 py-2"
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
              className="w-full rounded-xl border border-line bg-transparent px-3 py-2"
            />
          </label>

          <fieldset className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="canSeeTasks" defaultChecked /> Tasks
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="canSeeBudget" /> Money
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="canSeeGuests" /> Guests
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="canSeeTimeline" /> Day-of
            </label>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm text-muted">Only show tasks for</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <label key={person.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm">
                  <input type="checkbox" name="assigneeFilter" value={person.id} />
                  {person.name}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Leave all unchecked to show every task (still limited by modules).</p>
          </fieldset>

          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
          >
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
                  <p className="text-xs text-muted">
                    {account.isMaster
                      ? "Master · full access"
                      : [
                          account.canSeeTasks && "Tasks",
                          account.canSeeBudget && "Money",
                          account.canSeeGuests && "Guests",
                          account.canSeeTimeline && "Day-of",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No modules"}
                  </p>
                  {!account.isMaster && filter.length > 0 ? (
                    <p className="mt-1 text-xs text-muted">Filter: {filter.join(", ")}</p>
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
                    <input
                      name="name"
                      defaultValue={account.name}
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted">New PIN (optional)</span>
                    <input
                      name="pin"
                      inputMode="numeric"
                      pattern="\d{4,8}"
                      placeholder="Leave blank to keep"
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2"
                    />
                  </label>
                  {!account.isMaster ? (
                    <>
                      <fieldset className="grid grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="canSeeTasks" defaultChecked={account.canSeeTasks} /> Tasks
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="canSeeBudget" defaultChecked={account.canSeeBudget} /> Money
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="canSeeGuests" defaultChecked={account.canSeeGuests} /> Guests
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="canSeeTimeline" defaultChecked={account.canSeeTimeline} /> Day-of
                        </label>
                      </fieldset>
                      <fieldset>
                        <legend className="mb-2 text-sm text-muted">Task filter</legend>
                        <div className="flex flex-wrap gap-2">
                          {people.map((person) => (
                            <label
                              key={person.id}
                              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm"
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
                    <p className="text-xs text-muted">Master accounts always have full access.</p>
                  )}
                  <button
                    type="submit"
                    className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
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
