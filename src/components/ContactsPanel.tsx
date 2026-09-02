"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createContact, deleteContact, saveContact } from "@/app/actions";
import { PersonAvatar } from "@/components/PersonAvatar";
import { fileToResizedDataUrl } from "@/lib/resize-image";

export type ContactView = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photoData: string | null;
};

function ContactRow({
  contact,
  canEdit,
  onEdit,
  onDelete,
  pending,
}: {
  contact: ContactView;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const phoneHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <article className="flex items-center gap-2 px-3 py-2">
      <PersonAvatar name={contact.name} photoSrc={contact.photoData} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{contact.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {contact.phone && phoneHref ? (
            <a href={phoneHref} className="font-semibold text-[var(--accent)] hover:underline">
              {contact.phone}
            </a>
          ) : null}
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
          ) : null}
        </div>
      </div>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="text-xs font-semibold text-[var(--accent)]"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--danger)]"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      ) : phoneHref ? (
        <a href={phoneHref} className="shrink-0 text-sm text-muted" aria-label="Call">
          ›
        </a>
      ) : null}
    </article>
  );
}

export function ContactsPanel({
  contacts,
  canEdit,
  dayOfMode = false,
}: {
  contacts: ContactView[];
  canEdit: boolean;
  /** New contacts are added to the day-of call list with photo support. */
  dayOfMode?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ContactView | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => setEditing((current) => (current === "new" ? null : "new"))}
        >
          {dayOfMode ? "Add day-of contact" : "Add person"}
        </button>
      ) : null}

      {editing === "new" ? (
        <section className="card overflow-hidden">
          <ContactForm
            key="new"
            contact={null}
            dayOfMode={dayOfMode}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </section>
      ) : null}

      {contacts.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">
          {dayOfMode
            ? canEdit
              ? "No one on the call list yet — add the first contact above."
              : "No one on the call list yet."
            : canEdit
              ? "No contacts yet — add the first person above."
              : "No contacts yet."}
        </div>
      ) : (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {dayOfMode ? "Call list" : "Contacts"} · {contacts.length}
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {contacts.map((contact) =>
              editing !== "new" && editing?.id === contact.id ? (
                  <ContactForm
                    key={contact.id}
                    contact={contact}
                    dayOfMode={dayOfMode}
                    onDone={() => setEditing(null)}
                    onCancel={() => setEditing(null)}
                  />
              ) : (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  canEdit={canEdit}
                  pending={pending}
                  onEdit={() => setEditing(contact)}
                  onDelete={() => {
                    if (!window.confirm(`Delete ${contact.name}?`)) return;
                    startTransition(async () => {
                      await deleteContact(contact.id);
                      router.refresh();
                    });
                  }}
                />
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ContactForm({
  contact,
  dayOfMode = false,
  onDone,
  onCancel,
}: {
  contact: ContactView | null;
  dayOfMode?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [photoData, setPhotoData] = useState<string | null>(contact?.photoData ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      setPhotoData(await fileToResizedDataUrl(file));
    } catch {
      setPhotoError("That image couldn't be read. Try a JPEG or PNG.");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <form
      className="flex flex-col gap-3 px-3 py-3"
      action={async (formData) => {
        startTransition(async () => {
          if (photoData) formData.set("photoData", photoData);
          if (contact) {
            formData.set("id", contact.id);
            await saveContact(formData);
          } else {
            await createContact(formData);
          }
          onDone();
          router.refresh();
        });
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
        {contact ? "Edit person" : dayOfMode ? "New day-of contact" : "New person"}
      </p>

      {dayOfMode && !contact ? <input type="hidden" name="isDayOfContact" value="on" /> : null}

      {photoData ? (
        <div className="flex items-center gap-3">
          <img
            src={photoData}
            alt="Contact preview"
            className="h-12 w-12 rounded-full object-cover"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="text-sm font-semibold text-[var(--accent)]"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
            >
              {photoBusy ? "Resizing…" : "Change photo"}
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-[var(--danger)]"
              onClick={() => setPhotoData(null)}
            >
              Remove photo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn-secondary self-start"
          onClick={() => fileRef.current?.click()}
          disabled={photoBusy}
        >
          {photoBusy ? "Resizing…" : "Add photo"}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {contact?.photoData && !photoData ? <input type="hidden" name="clearPhoto" value="on" /> : null}
      {photoError ? <p className="text-sm text-[var(--danger)]">{photoError}</p> : null}

      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Name</span>
        <input
          name="name"
          required
          defaultValue={contact?.name ?? ""}
          placeholder="e.g. Avalon Green"
          className="field-input"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Phone</span>
        <input
          name="phone"
          defaultValue={contact?.phone ?? ""}
          placeholder="(000) 000-0000"
          inputMode="tel"
          className="field-input"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Email</span>
        <input
          name="email"
          defaultValue={contact?.email ?? ""}
          placeholder="name@example.com"
          inputMode="email"
          className="field-input"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : contact ? "Save" : "Add person"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
