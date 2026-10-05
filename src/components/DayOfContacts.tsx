import Link from "next/link";
import { PersonAvatar } from "@/components/PersonAvatar";
import { contactChannelHref, type DayOfContact } from "@/lib/day-of";

function ContactActions({ contact }: { contact: DayOfContact }) {
  const actions: Array<{ href: string; label: string; sr: string }> = [];
  if (contact.phone) {
    actions.push({
      href: contactChannelHref(contact.phone, "tel"),
      label: "Call",
      sr: `Call ${contact.name}`,
    });
    actions.push({
      href: contactChannelHref(contact.phone, "sms"),
      label: "Text",
      sr: `Text ${contact.name}`,
    });
  }
  if (contact.email) {
    actions.push({
      href: contactChannelHref(contact.email, "mailto"),
      label: "Email",
      sr: `Email ${contact.name}`,
    });
  }
  if (actions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          className="inline-flex min-h-12 min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-line bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--accent)]"
        >
          <span className="sr-only">{action.sr}</span>
          <span aria-hidden="true">{action.label}</span>
        </a>
      ))}
    </div>
  );
}

export function NeedSomeone({
  contacts,
  className = "mt-10",
}: {
  contacts: DayOfContact[];
  className?: string;
}) {
  if (contacts.length === 0) return null;
  return (
    <section className={className} aria-labelledby="need-someone-heading">
      <h2 id="need-someone-heading" className="font-[family-name:var(--font-display)] text-xl tracking-tight">
        Need someone?
      </h2>
      <ul className="mt-4 space-y-5">
        {contacts.map((contact) => (
          <li key={contact.id} className="card p-4">
            <div className="flex items-start gap-3">
              <PersonAvatar name={contact.name} photoSrc={contact.photoSrc} size="md" />
              <div className="min-w-0 flex-1">
                {contact.profileHref ? (
                  <Link href={contact.profileHref} className="block font-semibold leading-snug underline-offset-4 hover:underline">
                    {contact.name}
                  </Link>
                ) : (
                  <p className="font-semibold leading-snug">{contact.name}</p>
                )}
                {contact.context ? <p className="mt-0.5 text-sm text-muted">{contact.context}</p> : null}
              </div>
            </div>
            <ContactActions contact={contact} />
          </li>
        ))}
      </ul>
    </section>
  );
}
