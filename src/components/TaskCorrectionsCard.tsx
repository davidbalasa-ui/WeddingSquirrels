"use client";

import { useState } from "react";
import { applyTaskCorrectionsAction, pickPrintoutPhoneAction } from "@/app/actions";
import type { PrintoutCorrectionsPlan } from "@/lib/printout-corrections-data";
import { taskCorrectionsPlanIsEmpty } from "@/lib/task-corrections";

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Master-only: adds David's dated jobs, ticks the steps he marked done and saves the
 * phone numbers he sent, in one tap. A different number already saved is shown beside
 * his new one, and only his own tap on it replaces it.
 */
export function TaskCorrectionsCard({ plan: full }: { plan: PrintoutCorrectionsPlan }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState(false);
  const plan = full.tasks;
  const phonesToAdd = full.phones.filter((row) => row.status === "add");
  const phonesDiffer = full.phones.filter((row) => row.status === "differs");
  const phonesNotFound = full.phones.filter((row) => row.status === "not_found");
  const nothingToApply = taskCorrectionsPlanIsEmpty(plan) && phonesToAdd.length === 0 && full.contacts.length === 0 && full.dayJobs.length === 0 && full.dayJobRewords.length === 0;
  if (state === "done" || (nothingToApply && phonesDiffer.length === 0)) return null;

  async function pickPhone(label: string) {
    setPicking(label);
    setPickError(false);
    const result = await pickPrintoutPhoneAction(label).catch(() => ({ ok: false as const }));
    setPicking(null);
    if (!result.ok) {
      setPickError(true);
      return;
    }
    window.location.reload();
  }

  const differs = phonesDiffer.length ? (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Different number already saved</p>
      <p className="mt-0.5 text-xs text-muted">Apply leaves these alone. Pick the new one only if it is right.</p>
      <ul className="mt-1 list-none space-y-1.5 p-0">
        {phonesDiffer.map((row) => (
          <li key={row.label} className="flex flex-wrap items-center gap-x-2">
            <span>
              {row.personName} · saved: {row.current}
            </span>
            <button
              type="button"
              className="min-h-9 text-left text-xs font-semibold text-[var(--accent)]"
              disabled={picking !== null}
              onClick={() => void pickPhone(row.label)}
            >
              {picking === row.label ? "Saving…" : `Use ${row.phone} instead`}
            </button>
          </li>
        ))}
      </ul>
      {pickError ? <p className="mt-1 text-sm text-[var(--danger)]">Couldn’t save that number. Try again.</p> : null}
    </div>
  ) : null;

  // Everything else is in; only a number David has to pick between is left.
  if (nothingToApply) {
    return (
      <section className="card mb-5 px-3 py-3 text-sm" data-testid="task-corrections-card">
        {differs}
      </section>
    );
  }

  async function apply() {
    setState("working");
    const result = await applyTaskCorrectionsAction().catch(() => ({ ok: false as const }));
    if (!result.ok) {
      setState("error");
      return;
    }
    setState("done");
    window.location.reload();
  }

  return (
    <section className="card mb-5 px-3 py-3" data-testid="task-corrections-card">
      <p className="text-sm font-semibold">Task update ready</p>
      <p className="mt-0.5 text-xs text-muted">
        From your printout: {count(plan.inserts.length, "new job")}, {count(plan.marks.length, "item")} marked done
        {plan.dueFills.length ? `, ${count(plan.dueFills.length, "job")} given a day` : ""}
        {phonesToAdd.length ? `, ${count(phonesToAdd.length, "phone number")} added` : ""}
        {full.contacts.length ? `, ${count(full.contacts.length, "contact")} added` : ""}
        {full.dayJobs.length ? `, ${count(full.dayJobs.length, "Day-of job")} added` : ""}
        {full.dayJobRewords.length ? `, ${count(full.dayJobRewords.length, "Day-of job")} corrected` : ""}. Nothing you wrote is reworded or deleted.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary min-h-11 px-4 py-2 text-sm" onClick={() => void apply()} disabled={state === "working"}>
          {state === "working" ? "Applying…" : "Apply to tasks"}
        </button>
        <button type="button" className="min-h-11 px-2 text-sm font-semibold text-[var(--accent)]" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide details" : "See what changes"}
        </button>
      </div>
      {state === "error" ? <p className="mt-2 text-sm text-[var(--danger)]">Couldn’t apply — nothing was changed. Try again.</p> : null}
      {open ? (
        <div className="mt-3 space-y-2 text-sm">
          {plan.inserts.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">New</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.inserts.map((row) => (
                  <li key={row.title}>
                    {row.due ? `${dayLabel(row.due)} · ` : ""}{row.title}
                    {row.summary ? <span className="text-muted"> ({row.summary})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.dueFills.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Given a day</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.dueFills.map((row) => (
                  <li key={row.id}>
                    {dayLabel(row.due)} · {row.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {full.dayJobs.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Day-of jobs from your schedule</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {full.dayJobs.map((row) => (
                  <li key={row.title}>
                    {row.title} <span className="text-muted">({row.notes.split(" · ")[0]})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {full.dayJobRewords.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Corrected Day-of jobs</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {full.dayJobRewords.map((row) => (
                  <li key={row.id}>
                    {row.title} <span className="text-muted">({row.correction})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {full.contacts.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">New contacts</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {full.contacts.map((row) => (
                  <li key={row.name}>
                    {row.name} · {row.phone} <span className="text-muted">({row.directoryLabel})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.alreadyListed.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Already on your list, not added</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.alreadyListed.map((row) => (
                  <li key={row.title}>
                    {row.title} <span className="text-muted">(you have “{row.existing}”)</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {phonesToAdd.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Phone numbers</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {phonesToAdd.map((row) => (
                  <li key={row.label}>{row.personName} · {row.phone}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {differs}
          {phonesNotFound.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Not matched to one person</p>
              <p className="mt-0.5 text-xs text-muted">Add these on the person’s People page.</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {phonesNotFound.map((row) => (
                  <li key={row.label}>{row.label} · {row.phone}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.marks.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Marked done</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.marks.map((row) => (
                  <li key={row.id}>{row.card ? `${row.card} · ${row.title}` : row.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
