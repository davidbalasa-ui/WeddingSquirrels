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
            body="Operations first, then guests, stay, meals, open work, key dates, and money."
            active={binderActive}
            testId="print-preset-binder"
            onClick={() => applyPreset("binder")}
          />
          <PresetCard
            title="Day-of Packet"
            body="A helper packet for Kurt, Shelly, Wendy, or another day-of lead. Run sheet, MC cues, contacts, and setup — not money or the guest list."
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
      <BinderSunsetRule />
    </header>
  );
}

function PrintSection({ id, document }: { id: PrintSectionId; document: PrintCenterDocument }) {
  switch (id) {
    case "overview":
      return <QuickReferenceSection document={document} />;
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
          <h2>Wedding-day run sheet</h2>
          {document.runSheet.length ? (
            <RunSheet phases={document.runSheet} />
          ) : (
            <TimelineList rows={document.timeline} />
          )}
        </section>
      );
    case "mc":
      return (
        <section className="binder-section">
          <h2>MC Run of Show</h2>
          {document.mcNames.length ? (
            <p className="binder-lede">{document.mcNames.join(" · ")}</p>
          ) : null}
          <ol className="binder-cues">
            {document.mcCues.map((cue, index) => (
              <li key={`${cue.time ?? "cue"}-${cue.kind ?? "spoken"}-${index}`} className="binder-cue binder-card">
                <p className="binder-time">
                  {cue.time ?? "Cue"}
                  {cue.heading ? ` · ${cue.heading}` : ` · ${cue.momentTitle}`}
                </p>
                {cue.kind === "music" || !cue.spoken ? null : (
                  <>
                    <p className="binder-label">Spoken</p>
                    <p className="binder-spoken">“{cue.spoken}”</p>
                  </>
                )}
                {cue.music.length ? (
                  <>
                    <p className="binder-label">Music</p>
                    {cue.music.map((line) => (
                      <p key={line} className="binder-music">
                        {line}
                      </p>
                    ))}
                  </>
                ) : null}
                {(cue.operatorNotes ?? []).map((line) => (
                  <p key={line} className="binder-note">
                    {line}
                  </p>
                ))}
                {cue.nextTitle ? (
                  <p className="binder-next">
                    Next {cue.nextTime ? `${cue.nextTime} · ` : ""}
                    {cue.nextTitle}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      );
    case "hair":
      return (
        <section className="binder-section">
          <h2>Hair &amp; makeup</h2>
          {document.hairRooms.length ? (
            <>
              <h3>Room / station key</h3>
              <ul className="binder-list">
                {document.hairRooms.map((room) => (
                  <li key={room.title} className="binder-row">
                    <span>{room.title}</span>
                    <span>{room.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {document.hairSchedule.length ? (
            <>
              <h3>Schedule</h3>
              <table className="binder-table binder-hair-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Person / group</th>
                    <th>Service</th>
                    <th>Location</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {document.hairSchedule.map((row, index) => (
                    <tr key={`${row.timeLabel}-${row.person}-${index}`}>
                      <td>{row.showTime ? row.timeLabel : ""}</td>
                      <td>{row.person}</td>
                      <td>{row.service ?? "—"}</td>
                      <td>{row.location ?? "—"}</td>
                      <td>{row.notes.join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <PlaybookPrintList rows={document.hairMakeup} />
          )}
        </section>
      );
    case "shots":
      return (
        <section className="binder-section">
          <h2>Photo shot list</h2>
          {document.shotGroups.map((group) => (
            <div key={group.section} className="binder-block">
              <h3>{group.section}</h3>
              {group.confirmationNote ? <p className="binder-note">{group.confirmationNote}</p> : null}
              <ul className="binder-shot-grid">
                {group.items.map((item) => (
                  <li key={item.title} className="binder-shot">
                    <span className="binder-check" aria-hidden>
                      {item.completed ? "☑" : "☐"}
                    </span>
                    <span>
                      {item.title}
                      {item.notes.length ? (
                        <span className="binder-note"> {item.notes.join(" · ")}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
        </section>
      );
    case "assignments":
      return (
        <section className="binder-section">
          <h2>Day-of jobs</h2>
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
          {document.setupContacts.length ? (
            <>
              <h3>Current cleanup contacts</h3>
              <p className="binder-note">Support contacts — not assigned teardown owners.</p>
              <ContactList rows={document.setupContacts} />
            </>
          ) : null}
          {document.setupConfirmed.length ? (
            <>
              <h3>Confirmed responsibilities</h3>
              <ul className="binder-list">
                {document.setupConfirmed.map((row) => (
                  <li key={`${row.owner}-${row.work}`} className="binder-row">
                    <span>{row.owner}</span>
                    <span>{row.work}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {document.setupOpen.length ? (
            <>
              <h3>Still open</h3>
              <ul className="binder-list">
                {document.setupOpen.map((row) => (
                  <li key={row} className="binder-note">
                    {row}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {document.setupMoments.length ? <TimelineList rows={document.setupMoments} /> : null}
        </section>
      );
    case "coordinator":
      return (
        <section className="binder-section">
          <h2>Coordinator scope</h2>
          <p className="binder-lede">Avalon Green · Green Garden Events</p>
          <PlaybookPrintList rows={document.coordinatorScope} hideSection />
        </section>
      );
    case "decor":
      return (
        <section className="binder-section">
          <h2>Décor / setup details</h2>
          {groupDecor(document.setupDecor).map((group) => (
            <div key={group.section} className="binder-block">
              <h3>{group.section}</h3>
              <PlaybookPrintList rows={group.items} hideSection />
            </div>
          ))}
        </section>
      );
    case "guests":
      return (
        <section className="binder-section">
          <h2>Guests / RSVP</h2>
          {document.rsvpSummary ? (
            <p className="binder-lede">
              {document.rsvpSummary.attending} attending · {document.rsvpSummary.declined} declined ·{" "}
              {document.rsvpSummary.awaiting} awaiting RSVP
            </p>
          ) : null}
          <ul className="binder-list">
            {document.households.map((house, index) => (
              <li key={`${house.title}-${index}`} className="binder-card">
                <p className="binder-item-title">{house.title}</p>
                {house.members.map((member) => (
                  <p key={`${member.name}-${member.rsvpLabel}`} className="binder-row">
                    <span>{member.name}</span>
                    <span>{member.rsvpLabel}</span>
                  </p>
                ))}
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
          <h2>Meals / food &amp; supplies</h2>
          {document.meals.length ? (
            document.mealsPublished ? (
              document.meals.map((section) => (
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
              ))
            ) : (
              <>
                <h3>Rehearsal dinner meals</h3>
                <p className="binder-lede">
                  Menu not published yet
                  {document.meals.reduce((sum, section) => sum + section.guests.length, 0)
                    ? ` · ${document.meals.reduce((sum, section) => sum + section.guests.length, 0)} guests awaiting selections`
                    : ""}
                </p>
                {document.meals.map((section) => (
                  <div key={section.title} className="binder-block">
                    <h3>{section.title}</h3>
                    <p className="binder-note">{section.guests.map((guest) => guest.name).join(" · ")}</p>
                  </div>
                ))}
              </>
            )
          ) : null}
          {document.shopping.length ? (
            <>
              <h3>Food &amp; serving supplies</h3>
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
            </>
          ) : null}
        </section>
      );
    case "tasks":
      return (
        <section className="binder-section">
          <h2>Open work</h2>
          {(document.taskGroups.length ? document.taskGroups : []).map((group) => (
            <div key={group.title} className="binder-block">
              <h3>{group.title}</h3>
              <ul className="binder-list">
                {group.items.map((item) => (
                  <li key={item.title} className="binder-shot">
                    <span className="binder-check" aria-hidden>
                      {item.done ? "☑" : "☐"}
                    </span>
                    <span>
                      <span className="binder-item-title">{item.title}</span>
                      {item.dueLabel || item.assignees.length ? (
                        <p className="binder-note">
                          {[item.dueLabel, item.assignees.join(" · ")].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      );
    case "calendar":
      return (
        <section className="binder-section">
          <h2>Key dates</h2>
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

function QuickReferenceSection({ document }: { document: PrintCenterDocument }) {
  const ref = document.quickReference;
  return (
    <section className="binder-section">
      <h2>Quick reference</h2>
      <p className="binder-lede">
        {ref.coupleNames}
        {ref.weddingDateLabel ? ` · ${ref.weddingDateLabel}` : ""}
      </p>
      <dl className="binder-ref">
        <RefBlock label="Ceremony" lines={[ref.ceremonyTime, ref.venueName, ...ref.venueAddress]} />
        <RefBlock label="Airbnb" lines={[ref.airbnbName, ...ref.airbnbAddress]} />
        <RefBlock label="Rehearsal dinner" lines={[ref.rehearsalDinnerName, ...ref.rehearsalDinnerAddress]} />
        <RefBlock label="Coordinator" lines={[ref.coordinatorName, ref.coordinatorPhone]} />
        <RefBlock label="Mistress of Ceremonies" lines={[ref.mistressOfCeremonies]} />
        <RefBlock label="MC" lines={[ref.mcName]} />
        <RefBlock label="Reception concludes" lines={[ref.receptionEnds]} />
        <RefBlock label="Venue closes" lines={[ref.venueCloses]} />
      </dl>
      {ref.rsvp ? (
        <p className="binder-lede">
          {ref.rsvp.attending} attending · {ref.rsvp.declined} declined · {ref.rsvp.awaiting} awaiting RSVP
        </p>
      ) : null}
    </section>
  );
}

function RefBlock({ label, lines }: { label: string; lines: Array<string | null | undefined> }) {
  const visible = lines.filter((line): line is string => Boolean(line?.trim()));
  if (!visible.length) return null;
  return (
    <div className="binder-ref-item">
      <dt>{label}</dt>
      {visible.map((line) => (
        <dd key={line}>{line}</dd>
      ))}
    </div>
  );
}

function RunSheet({ phases }: { phases: PrintCenterDocument["runSheet"] }) {
  return (
    <div className="binder-run">
      {phases.map((phase) => (
        <div key={phase.title} className="binder-block">
          <h3>{phase.title}</h3>
          {phase.location ? <p className="binder-note">{phase.location}</p> : null}
          {phase.notes.map((line) => (
            <p key={line} className="binder-note">
              {line}
            </p>
          ))}
          <ol className="binder-timeline">
            {phase.events.map((event, index) => (
              <li key={`${event.timeLabel}-${event.title}-${index}`} className="binder-card">
                {event.timeLabel ? <p className="binder-time">{event.timeLabel}</p> : null}
                <p className="binder-item-title">{event.title}</p>
                {event.notes.map((line) => (
                  <p key={line} className="binder-note">
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function BinderSunsetRule() {
  return (
    <div className="binder-sunset" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
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

function PlaybookPrintList({
  rows,
  hideSection = false,
}: {
  rows: PrintCenterDocument["hairMakeup"];
  hideSection?: boolean;
}) {
  return (
    <ol className="binder-timeline">
      {rows.map((row, index) => (
        <li key={`${row.section}-${row.title}-${index}`} className="binder-card">
          {!hideSection ? <p className="binder-kicker">{row.section}</p> : null}
          {row.timeLabel ? <p className="binder-time">{row.timeLabel}</p> : null}
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

function groupDecor(rows: PrintCenterDocument["setupDecor"]) {
  const groups: Array<{ section: string; items: PrintCenterDocument["setupDecor"] }> = [];
  const index = new Map<string, number>();
  for (const row of rows) {
    const existing = index.get(row.section);
    if (existing == null) {
      index.set(row.section, groups.length);
      groups.push({ section: row.section, items: [row] });
    } else {
      groups[existing]!.items.push(row);
    }
  }
  return groups;
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
        </li>
      ))}
    </ul>
  );
}
