"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createContact, deleteContact, saveContact } from "@/app/actions";
import { fileToResizedDataUrl } from "@/lib/resize-image";

export type ContactView = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photoData: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ContactsPanel({
  contacts,
  canEdit,
}: {
  contacts: ContactView[];
  canEdit: boolean;
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
          Add person
        </button>
      ) : null}

      {editing === "new" ? (
        <ContactForm
          key="new"
          contact={null}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {contacts.length === 0 ? (
        <div className="card p-5 text-sm text-muted">
          No contacts yet{canEdit ? " — add the first person above" : "."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((contact) =>
            editing !== "new" && editing?.id === contact.id ? (
              <ContactForm
                key={contact.id}
                contact={contact}
                onDone={() => setEditing(null)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <article key={contact.id} className="card flex items-center gap-3 p-4">
                {contact.photoData ? (
                  <img
                    src={contact.photoData}
                    alt={contact.name}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-[family-name:var(--font-display)] text-lg text-[var(--accent)]">
                    {initials(contact.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{contact.name}</p>
                  {contact.phone ? (
                    <p className="mt-0.5 text-sm text-muted">
                      <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                        {contact.phone}
                      </a>
                    </p>
                  ) : null}
                  {contact.email ? (
                    <p className="mt-0.5 text-sm text-muted">
                      <a href={`mailto:${contact.email}`} className="hover:underline">
                        {contact.email}
                      </a>
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--accent)]"
                      onClick={() => setEditing(contact)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--danger)]"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Delete ${contact.name}?`)) return;
                        startTransition(async () => {
                          await deleteContact(contact.id);
                          router.refresh();
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ContactForm({
  contact,
  onDone,
  onCancel,
}: {
  contact: ContactView | null;
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
      className="card flex flex-col gap-3 p-4"
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
        {contact ? "Edit person" : "New person"}
      </p>

      {photoData ? (
        <div className="flex items-center gap-3">
          <img
            src={photoData}
            alt="Contact preview"
            className="h-16 w-16 rounded-full object-cover"
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
