"use client";

import { useMemo, useState } from "react";
import {
  FULL_BINDER_SECTIONS,
  PRINT_SECTION_IDS,
  PRINT_SECTION_LABELS,
  formatPrintMoney,
  presetMatchesSelection,
  printableSections,
  sectionsForPreset,
  toggleSection,
  triggerBrowserPrint,
  assignmentOwnerLabel,
  type PrintCenterDocument,
  type PrintPresetId,
  type PrintSectionId,
} from "@/lib/print-center";

export function PrintCenter({ document }: { document: PrintCenterDocument }) {
  const [selected, setSelected] = useState<PrintSectionId[]>([...FULL_BINDER_SECTIONS]);
  const visible = useMemo(() => printableSections(document, selected), [document, selected]);
  const packetActive = presetMatchesSelection("packet", selected);
  const binderActive = presetMatchesSelection("binder", selected);

  function applyPreset(next: PrintPresetId) {
    setSelected(sectionsForPreset(next).filter((id) => document.availableSections.includes(id)));
  }

  function onToggle(id: PrintSectionId) {
    setSelected(toggleSection(selected, id));
  }

  return (
    <div className="print-center pb-8">
      <div className="print-hide">
        <header className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Print</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.05] tracking-tight">
            Wedding Binder & Print
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted">
            Create a printable wedding binder or a focused day-of packet from your current
            WeddingSquirrels information.
          </p>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PresetCard
            title="Full Wedding Binder"
            body="The complete planning record: timeline, rehearsal, guests, stay, meals, shopping, tasks, calendar, and money."
            active={binderActive}
            testId="print-preset-binder"
            onClick={() => applyPreset("binder")}
          />
          <PresetCard
            title="Day-of Packet"
            body="A helper packet for Kurt, Shelly, Wendy, or another day-of lead. Timeline, MC cues, contacts, and setup — not money or the full guest list."
            active={packetActive}
            testId="print-preset-packet"
            onClick={() => applyPreset("packet")}
          />
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Sections
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRINT_SECTION_IDS.filter((id) => document.availableSections.includes(id)).map((id) => (
              <label key={id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-print-section={id}
                  checked={selected.includes(id)}
                  onChange={() => onToggle(id)}
                />
                <span>{PRINT_SECTION_LABELS[id]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            data-testid="print-save-pdf"
            onClick={() => triggerBrowserPrint()}
          >
            Print / Save PDF
          </button>
          <p className="text-xs text-muted">Create or save your PDF while online before the wedding.</p>
        </div>
      </div>

      <article className="binder-doc mt-8">
        <PrintTitlePage document={document} packet={packetActive && !binderActive} />
        {visible.map((id) => (
          <PrintSection key={id} id={id} document={document} />
        ))}
      </article>
    </div>
  );
}

function PresetCard({
  title,
  body,
  active,
  testId,
  onClick,
}: {
  title: string;
  body: string;
  active: boolean;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="rounded-2xl border px-4 py-4 text-left"
      style={
        active
          ? { borderColor: "var(--accent)", background: "var(--accent-soft)" }
          : { borderColor: "var(--line)", background: "var(--bg-elevated)" }
      }
      aria-pressed={active}
    >
      <p className="font-[family-name:var(--font-display)] text-xl leading-tight">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </button>
  );
}

function PrintTitlePage({
  document,
  packet,
}: {
  document: PrintCenterDocument;
  packet: boolean;
}) {
  return (
    <header className="binder-title">
      <p className="binder-kicker">{packet ? "Wedding Day Packet" : "Wedding Binder"}</p>
      <h1>{document.coupleNames}</h1>
      <p className="binder-date">{document.weddingDateLabel}</p>
    </header>
  );
}

function PrintSection({ id, document }: { id: PrintSectionId; document: PrintCenterDocument }) {
  switch (id) {
    case "overview":
      return (
        <section className="binder-section">
          <h2>Overview</h2>
          <p className="binder-lede">
            {document.coupleNames}
            {document.weddingDateLabel ? ` · ${document.weddingDateLabel}` : ""}
          </p>
          {document.mcNames.length ? (
            <p className="binder-note">MC: {document.mcNames.join(" · ")}</p>
          ) : (
            <p className="binder-note">Master of ceremonies is listed on the wedding-day timeline notes.</p>
          )}
        </section>
      );
    case "rehearsal":
      return (
        <section className="binder-section">
          <h2>Rehearsal dinner + rehearsal</h2>
          <TimelineList rows={document.rehearsal} />
        </section>
      );
    case "timeline":
      return (
        <section className="binder-section">
          <h2>Wedding-day timeline</h2>
          <TimelineList rows={document.timeline} />
        </section>
      );
    case "mc":
      return (
        <section className="binder-section">
          <h2>MC &amp; music cues</h2>
          {document.mcNames.length ? (
            <p className="binder-lede">{document.mcNames.join(" · ")} · MC</p>
          ) : null}
          <ol className="binder-cues">
            {document.mcCues.map((cue, index) => (
              <li key={`${cue.time ?? "cue"}-${index}`} className="binder-card">
                <p className="binder-time">
                  {cue.time ?? "Cue"}
                  {cue.heading ? ` · ${cue.heading}` : ` · ${cue.momentTitle}`}
                </p>
                <p className="binder-spoken">“{cue.spoken}”</p>
                {cue.music.map((line) => (
                  <p key={line} className="binder-music">
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </section>
      );
    case "contacts":
      return (
        <section className="binder-section">
          <h2>Vendor &amp; day-of contacts</h2>
          {document.vendorContacts.length ? (
            <>
              <h3>Vendor contacts</h3>
              <ContactList rows={document.vendorContacts} />
            </>
          ) : null}
          {document.dayOfContacts.length ? (
            <>
              <h3>Day-of contacts</h3>
              <ContactList rows={document.dayOfContacts} />
            </>
          ) : null}
          {document.otherContacts.length ? (
            <>
              <h3>Other contacts</h3>
              <ContactList rows={document.otherContacts} />
            </>
          ) : null}
        </section>
      );
    case "assignments":
      return (
        <section className="binder-section">
          <h2>Day assignments</h2>
          <ul className="binder-list">
            {document.assignments.map((row) => (
              <li key={row.title} className="binder-card">
                <p className="binder-item-title">{row.title}</p>
                {row.notes ? <p className="binder-note">{row.notes}</p> : null}
                <p className={row.assignees.length ? "binder-note" : "binder-unassigned"}>
                  {assignmentOwnerLabel(row.assignees)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "setup":
      return (
        <section className="binder-section">
          <h2>Setup / teardown</h2>
          {document.setupContacts.length ? <ContactList rows={document.setupContacts} /> : null}
          {document.setupMoments.length ? <TimelineList rows={document.setupMoments} /> : null}
        </section>
      );
    case "guests":
      return (
        <section className="binder-section">
          <h2>Guests / households</h2>
          <ul className="binder-list">
            {document.households.map((house, index) => (
              <li key={`${house.names.join("-")}-${index}`} className="binder-card">
                <p className="binder-item-title">{house.names.join(" & ") || "Household"}</p>
                {house.addressLines.length ? (
                  house.addressLines.map((line) => (
                    <p key={line} className="binder-note">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="binder-note">No address on file</p>
                )}
                <p className="binder-kicker">{house.rsvp}</p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "stay":
      return (
        <section className="binder-section">
          <h2>Stay</h2>
          {document.stay.map((section) => (
            <div key={section.title} className="binder-block">
              <h3>{section.title}</h3>
              {section.detail ? <p className="binder-note">{section.detail}</p> : null}
              <ul className="binder-list">
                {section.slots.map((slot) => (
                  <li key={`${section.title}-${slot.label}`} className="binder-row">
                    <span>{slot.label}</span>
                    <span>{slot.occupant}</span>
                  </li>
                ))}
              </ul>
              {section.notes.map((note) => (
                <p key={note} className="binder-note">
                  {note}
                </p>
              ))}
            </div>
          ))}
        </section>
      );
    case "meals":
      return (
        <section className="binder-section">
          <h2>Meals</h2>
          <p className="binder-lede">
            {document.mealsPublished ? "Menu published." : "Meal choices are not published yet."}{" "}
            {document.mealChoiceCount === 0
              ? "No selections have been recorded."
              : `${document.mealChoiceCount} selections recorded.`}
          </p>
          {document.meals.map((section) => (
            <div key={section.title} className="binder-block">
              <h3>{section.title}</h3>
              <ul className="binder-list">
                {section.guests.map((guest) => (
                  <li key={`${section.title}-${guest.name}`} className="binder-row">
                    <span>{guest.name}</span>
                    <span>{guest.selection ?? "No selection"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      );
    case "shopping":
      return (
        <section className="binder-section">
          <h2>Shopping</h2>
          <ul className="binder-list">
            {document.shopping.map((item) => (
              <li key={item.name} className="binder-card">
                <p className="binder-item-title">
                  {item.name}
                  {item.quantity ? ` · ${item.quantity}` : ""}
                  {item.purchased ? " · purchased" : ""}
                </p>
                {item.note ? <p className="binder-note">{item.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      );
    case "tasks":
      return (
        <section className="binder-section">
          <h2>Tasks</h2>
          <ul className="binder-list">
            {document.tasks.map((task) => (
              <li key={task.title} className="binder-card">
                <p className="binder-item-title">{task.title}</p>
                <p className="binder-note">
                  {task.status}
                  {task.dueLabel ? ` · ${task.dueLabel}` : ""}
                  {task.assignees.length ? ` · ${task.assignees.join(" · ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "calendar":
      return (
        <section className="binder-section">
          <h2>Calendar</h2>
          <ul className="binder-list">
            {document.calendar.map((event) => (
              <li key={event.title} className="binder-card">
                <p className="binder-item-title">{event.title}</p>
                <p className="binder-note">{event.when}</p>
                {event.notes ? <p className="binder-note">{event.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      );
    case "money":
      return (
        <section className="binder-section">
          <h2>Money</h2>
          <p className="binder-lede">
            {`Committed ${formatPrintMoney(document.money.committed)} · Paid ${formatPrintMoney(document.money.paid)} · Remaining ${formatPrintMoney(document.money.remaining)}`}
          </p>
          <table className="binder-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {document.money.items.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{formatPrintMoney(item.total)}</td>
                  <td>{formatPrintMoney(item.paid)}</td>
                  <td>{formatPrintMoney(item.remaining)}</td>
                  <td>{item.dueLabel ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
  }
}

function TimelineList({ rows }: { rows: PrintCenterDocument["timeline"] }) {
  return (
    <ol className="binder-timeline">
      {rows.map((row, index) => (
        <li key={`${row.timeLabel}-${row.title}-${index}`} className="binder-card">
          <p className="binder-time">{row.timeLabel}</p>
          <p className="binder-item-title">{row.title}</p>
          {row.location ? <p className="binder-note">{row.location}</p> : null}
          {row.notes.map((line) => (
            <p key={line} className="binder-note">
              {line}
            </p>
          ))}
        </li>
      ))}
    </ol>
  );
}

function ContactList({ rows }: { rows: PrintCenterDocument["vendorContacts"] }) {
  return (
    <ul className="binder-list">
      {rows.map((row) => (
        <li key={`${row.name}-${row.phone ?? ""}-${row.email ?? ""}`} className="binder-card">
          <p className="binder-item-title">{row.name}</p>
          {row.role ? <p className="binder-note">{row.role}</p> : null}
          {row.phone ? <p className="binder-note">{row.phone}</p> : null}
          {row.email ? <p className="binder-note">{row.email}</p> : null}
          {!row.phone && !row.email ? <p className="binder-note">No phone or email on file</p> : null}
        </li>
      ))}
    </ul>
  );
}
