import Link from "next/link";
import { PersonAvatar } from "@/components/PersonAvatar";
import type { PeopleSectionPreview } from "@/lib/people-hub";

export function PeopleSectionGrid({ sections }: { sections: PeopleSectionPreview[] }) {
  if (sections.length === 0) return null;

  return (
    <div className="mb-6 grid gap-3">
      {sections.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          className="card block p-4 transition-colors hover:bg-[var(--accent-soft)]/35"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-xl leading-tight">
                {section.label}
              </p>
              <p className="mt-1 text-sm text-muted">{section.detail}</p>
            </div>
            <span className="text-lg text-muted" aria-hidden>
              ›
            </span>
          </div>
          {section.faces.length > 0 ? (
            <div className="mt-4 flex items-center gap-2">
              {section.faces.map((face) => (
                <PersonAvatar
                  key={face.profileId}
                  name={face.name}
                  photoSrc={face.photoSrc}
                  size="sm"
                />
              ))}
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
