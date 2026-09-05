"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OfflineDayOfPanel } from "@/components/OfflineDayOfPanel";
import { formatFetchedAt, loadOfflinePack, type OfflinePack } from "@/lib/offline-db";

type TabId =
  | "tasks"
  | "day"
  | "contacts"
  | "assignments"
  | "guests"
  | "money"
  | "requests"
  | "shop"
  | "stay";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  amountNeeded: number | null;
  amountSpent: number | null;
  planNotes: string | null;
  summary: string | null;
  escalatedAt: string | null;
  assignees: { person: { id: string; name: string } }[];
  children: unknown[];
};

type TimelineRow = {
  id: string;
  schedule: string;
  startAt: string;
  endAt: string | null;
  notes: string;
};

type ContactRow = { id: string; name: string; phone: string | null; email: string | null; photoData: string | null };

type AssignmentRow = {
  id: string;
  title: string;
  notes: string | null;
  assignees: { person: { id: string; name: string } }[];
};

type GuestRow = {
  id: string;
  nameLine1: string;
  nameLine2: string | null;
  rsvpStatus: string;
  invitedCount: number;
  acceptedCount: number;
  gifts: { id: string; description: string; thanked: boolean }[];
};

type BudgetRow = {
  id: string;
  name: string;
  price: number;
  amountPaid: number;
  payByDate: string | null;
  note: string | null;
};

type RequestRow = {
  id: string;
  title: string;
  status: string;
  note: string | null;
  senderAccount: { id: string; name: string };
  recipientAccount: { id: string; name: string };
  declineNote: string | null;
  messages: { id: string; body: string; authorAccount: { id: string; name: string }; createdAt: string }[];
};

type ShoppingRow = { id: string; name: string; quantity: string | null; note: string | null; purchased: boolean };
type StayRow = { id: string; sectionId: string; label: string; occupant: string };

function asTasks(pack: OfflinePack | null): TaskRow[] {
  return (pack?.tasks ?? []) as TaskRow[];
}
function asTimeline(pack: OfflinePack | null): TimelineRow[] {
  return (pack?.timeline ?? []) as TimelineRow[];
}
function asContacts(pack: OfflinePack | null): ContactRow[] {
  return (pack?.contacts ?? []) as ContactRow[];
}
function asAssignments(pack: OfflinePack | null): AssignmentRow[] {
  return (pack?.assignments ?? []) as AssignmentRow[];
}
function asGuests(pack: OfflinePack | null): GuestRow[] {
  return (pack?.guests ?? []) as GuestRow[];
}
function asBudget(pack: OfflinePack | null): BudgetRow[] {
  return (pack?.budgetItems ?? []) as BudgetRow[];
}
function asRequests(pack: OfflinePack | null): RequestRow[] {
  return (pack?.requests ?? []) as RequestRow[];
}
function asShopping(pack: OfflinePack | null): ShoppingRow[] {
  return (pack?.shopping ?? []) as ShoppingRow[];
}
function asStay(pack: OfflinePack | null): StayRow[] {
  return (pack?.stay ?? []) as StayRow[];
}

export function OfflineApp() {
  const [pack, setPack] = useState<OfflinePack | null | "loading">("loading");

  useEffect(() => {
    let active = true;
    loadOfflinePack()
      .then((loaded) => {
        if (active) setPack(loaded);
      })
      .catch(() => {
        if (active) setPack(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const tabs = useMemo(() => {
    if (!pack || pack === "loading") return [];
    const available: { id: TabId; label: string; count: number }[] = [];
    if (asTasks(pack).length) available.push({ id: "tasks", label: "Home", count: asTasks(pack).length });
    if (asTimeline(pack).length) available.push({ id: "day", label: "Day-of", count: asTimeline(pack).length });
    if (asContacts(pack).length) available.push({ id: "contacts", label: "Contacts", count: asContacts(pack).length });
    if (asAssignments(pack).length)
      available.push({ id: "assignments", label: "Assignments", count: asAssignments(pack).length });
    if (asGuests(pack).length) available.push({ id: "guests", label: "Guests", count: asGuests(pack).length });
    if (asBudget(pack).length) available.push({ id: "money", label: "Money", count: asBudget(pack).length });
    if (asRequests(pack).length) available.push({ id: "requests", label: "Ask", count: asRequests(pack).length });
    if (asShopping(pack).length) available.push({ id: "shop", label: "Shop", count: asShopping(pack).length });
    if (asStay(pack).length) available.push({ id: "stay", label: "Stay", count: asStay(pack).length });
    return available;
  }, [pack]);

  const [tab, setTab] = useState<TabId>("tasks");

  if (pack === "loading") {
    return (
      <div className="app-shell py-8 text-center text-sm text-muted">Loading offline copy…</div>
    );
  }

  if (!pack) {
    return (
      <div className="app-shell py-8">
        <header className="mb-4">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Offline copy</h1>
        </header>
        <div className="card p-6 text-sm">
          <p className="font-semibold">No offline copy saved yet.</p>
          <p className="mt-1 text-muted">
            Sign in on this device while online and open <span className="font-semibold">Today</span>{" "}
            or <span className="font-semibold">More</span>. Your offline copy saves automatically,
            then this page will show it.
          </p>
          <Link href="/today" className="btn-primary mt-4 inline-flex">
            Go to Today
          </Link>
        </div>
      </div>
    );
  }

  const active = tabs.find((item) => item.id === tab)?.id ?? tabs[0]?.id;

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-3 backdrop-blur-md">
        <h1 className="font-[family-name:var(--font-display)] text-2xl leading-tight">
          WeddingSquirrels · Offline
        </h1>
        <p className="mt-1 text-sm text-muted">
          {pack.coupleNames ?? "David & Haley"} · saved {formatFetchedAt(pack.fetchedAt)}
        </p>
        <Link href="/" className="mt-2 inline-block text-sm font-semibold text-[var(--accent)]">
          ← Back to app
        </Link>
      </header>

      {tabs.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className="filter-pill rounded-full border px-3.5 py-2 text-sm font-semibold"
              data-active={item.id === active}
              style={
                item.id === active
                  ? {
                      borderColor: "var(--accent)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }
                  : undefined
              }
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.count > 0 ? ` · ${item.count}` : ""}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted">
          This offline copy has no saved data yet. Sign in while online and open Today or More to
          sync automatically.
        </p>
      )}

      {active === "tasks" ? <TasksView pack={pack} /> : null}
      {active === "day" ? (
        <OfflineDayOfPanel pack={pack} onAllContacts={() => setTab("contacts")} />
      ) : null}
      {active === "contacts" ? <ContactsView pack={pack} /> : null}
      {active === "assignments" ? <AssignmentsView pack={pack} /> : null}
      {active === "guests" ? <GuestsView pack={pack} /> : null}
      {active === "money" ? <MoneyView pack={pack} /> : null}
      {active === "requests" ? <RequestsView pack={pack} /> : null}
      {active === "shop" ? <ShopView pack={pack} /> : null}
      {active === "stay" ? <StayView pack={pack} /> : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </p>
  );
}

function TasksView({ pack }: { pack: OfflinePack }) {
  const tasks = asTasks(pack);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Home</SectionTitle>
      {tasks.map((task) => {
        const names = task.assignees.map((a) => a.person.name).join(" · ");
        return (
          <article key={task.id} className={`card p-4 ${task.status === "done" ? "opacity-60" : ""}`}>
            <p className={`font-semibold leading-snug ${task.status === "done" ? "line-through" : ""}`}>
              {task.title}
            </p>
            <p className="mt-1 text-sm text-muted">{task.planNotes || task.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              {names ? <span>{names}</span> : null}
              {task.dueDate ? (
                <span>{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              ) : null}
              {task.amountNeeded != null || (task.amountSpent ?? 0) > 0 ? (
                <span>
                  ${(task.amountSpent ?? 0).toLocaleString()}
                  {task.amountNeeded != null ? ` / $${task.amountNeeded.toLocaleString()}` : ""}
                </span>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ContactsView({ pack }: { pack: OfflinePack }) {
  const contacts = asContacts(pack);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Contacts</SectionTitle>
      {contacts.map((contact) => (
        <article key={contact.id} className="card flex items-center gap-3 p-4">
          {contact.photoData ? (
            <img src={contact.photoData} alt={contact.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-[family-name:var(--font-display)] text-base text-[var(--accent)]">
              {contact.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{contact.name}</p>
            {contact.phone ? (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="mt-0.5 block text-sm text-[var(--accent)]"
                aria-label={`Call ${contact.name}`}
              >
                {contact.phone}
              </a>
            ) : null}
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="mt-0.5 block text-sm text-[var(--accent)]"
                aria-label={`Email ${contact.name}`}
              >
                {contact.email}
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function AssignmentsView({ pack }: { pack: OfflinePack }) {
  const assignments = asAssignments(pack);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Assignments</SectionTitle>
      {assignments.map((assignment) => (
        <article key={assignment.id} className="card p-4">
          <p className="font-semibold leading-snug">{assignment.title}</p>
          {assignment.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{assignment.notes}</p> : null}
          {assignment.assignees.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {assignment.assignees.map((row) => (
                <span
                  key={row.person.id}
                  className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted"
                >
                  {row.person.name}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function GuestsView({ pack }: { pack: OfflinePack }) {
  const guests = asGuests(pack);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Guests</SectionTitle>
      {guests.map((guest) => (
        <article key={guest.id} className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold leading-snug">
              {guest.nameLine1}
              {guest.nameLine2 ? ` & ${guest.nameLine2}` : ""}
            </p>
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              {guest.rsvpStatus}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {guest.acceptedCount} / {guest.invitedCount} attending
          </p>
          {guest.gifts.length > 0 ? (
            <p className="mt-2 text-sm text-muted">
              Gifts: {guest.gifts.filter((gift) => gift.thanked).length} thanked
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function MoneyView({ pack }: { pack: OfflinePack }) {
  const items = asBudget(pack);
  const spent = items.reduce((sum, item) => sum + (item.amountPaid || 0), 0);
  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Money · {items.length} items</SectionTitle>
      <div className="card p-4 text-sm">
        <p className="flex justify-between">
          <span className="text-muted">Paid so far</span>
          <span className="font-semibold">${spent.toLocaleString()}</span>
        </p>
        <p className="mt-1 flex justify-between">
          <span className="text-muted">Budgeted</span>
          <span className="font-semibold">${total.toLocaleString()}</span>
        </p>
      </div>
      {items.map((item) => (
        <article key={item.id} className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold leading-snug">{item.name}</p>
            <p className="shrink-0 text-sm font-bold">${item.price.toLocaleString()}</p>
          </div>
          <p className="mt-1 text-sm text-muted">
            Paid ${item.amountPaid.toLocaleString()}
            {item.payByDate
              ? ` · by ${new Date(item.payByDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : ""}
          </p>
          {item.note ? <p className="mt-1 text-sm text-muted">{item.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

function RequestsView({ pack }: { pack: OfflinePack }) {
  const requests = asRequests(pack);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Asks</SectionTitle>
      {requests.map((request) => (
        <article key={request.id} className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold leading-snug">{request.title}</p>
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              {request.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {request.senderAccount.name} → {request.recipientAccount.name}
          </p>
          {request.messages.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {request.messages.map((message) => (
                <p key={message.id} className="text-sm leading-relaxed text-muted">
                  <span className="font-semibold text-ink">{message.authorAccount.name}:</span> {message.body}
                </p>
              ))}
            </div>
          ) : null}
          {request.status === "declined" && request.declineNote ? (
            <p className="mt-2 text-sm text-[var(--danger)]">Declined: {request.declineNote}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ShopView({ pack }: { pack: OfflinePack }) {
  const items = asShopping(pack);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Shop</SectionTitle>
      {items.map((item) => (
        <article key={item.id} className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-semibold leading-snug ${item.purchased ? "line-through opacity-60" : ""}`}>
              {item.name}
            </p>
            {item.quantity ? <span className="shrink-0 text-sm text-muted">{item.quantity}</span> : null}
          </div>
          {item.note ? <p className="mt-1 text-sm text-muted">{item.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

function StayView({ pack }: { pack: OfflinePack }) {
  const slots = asStay(pack);
  const bySection = new Map<string, StayRow[]>();
  for (const slot of slots) {
    const list = bySection.get(slot.sectionId) ?? [];
    list.push(slot);
    bySection.set(slot.sectionId, list);
  }
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Stay</SectionTitle>
      {[...bySection.entries()].map(([sectionId, rows]) => (
        <div key={sectionId} className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{sectionId}</p>
          {rows.map((row) => (
            <article key={row.id} className="card flex items-center justify-between p-3 text-sm">
              <span>{row.label}</span>
              <span className="text-muted">{row.occupant || "—"}</span>
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
