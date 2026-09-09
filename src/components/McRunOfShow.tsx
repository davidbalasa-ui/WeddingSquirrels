import Link from "next/link";
import type { McRunOfShow } from "@/lib/mc-run-of-show";
import { groupPlaybookSections, type PlaybookItemView } from "@/lib/playbook";

export function McRunOfShowView({
  show,
  lineup,
}: {
  show: McRunOfShow;
  lineup: PlaybookItemView[];
}) {
  const lineupGroups = groupPlaybookSections(lineup);
  return (
    <div className="pb-8">
      {show.mcNames.length ? (
        <p className="mb-6 text-base text-muted">
          {show.mcNames.join(" · ")}
        </p>
      ) : (
        <p className="mb-6 text-base text-muted">
          Wendy Rush is Mistress of Ceremonies. Kurt Huizenga is MC.
        </p>
      )}

      {show.cues.length === 0 ? (
        <p className="text-base text-muted">
          MC cues live on the wedding-day timeline. Add playlist and &quot;MC cue&quot; lines there
          and they will appear here automatically.
        </p>
      ) : (
        <ol className="divide-y divide-[var(--line)]">
          {show.cues.map((cue, index) => (
            <li
              key={`${cue.time ?? "cue"}-${cue.kind}-${index}`}
              className="py-5"
              data-mc-cue={cue.kind}
            >
              <p className="text-sm font-semibold text-[var(--accent)]">
                {cue.time ?? "Cue"}
                {cue.heading ? ` · ${cue.heading}` : ""}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {cue.momentTitle}
              </p>
              {cue.kind === "spoken" && cue.spoken ? (
                <p className="mt-3 text-lg leading-snug">“{cue.spoken}”</p>
              ) : null}
              {cue.introduces && cue.introduces !== cue.heading ? (
                <p className="mt-2 text-sm text-muted">Introducing: {cue.introduces}</p>
              ) : null}
              {cue.music.map((line) => (
                <p key={line} className="mt-2 text-sm font-semibold text-[var(--accent)]">
                  {line}
                </p>
              ))}
              {cue.operatorNotes.map((line) => (
                <p key={line} className="mt-1 text-sm leading-relaxed text-muted">
                  {line}
                </p>
              ))}
              {cue.nextTitle ? (
                <p className="mt-3 text-sm text-muted">
                  Next: {cue.nextTime ? `${cue.nextTime} · ` : ""}
                  {cue.nextTitle}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted">Last cue.</p>
              )}
            </li>
          ))}
        </ol>
      )}

      {lineupGroups.length ? (
        <section className="mt-10" aria-labelledby="ceremony-lineup-heading">
          <h2
            id="ceremony-lineup-heading"
            className="font-[family-name:var(--font-display)] text-[1.65rem] leading-tight"
          >
            Ceremony lineup · 3:20 PM
          </h2>
          <p className="mt-2 text-sm text-muted">
            Processional order. This is the same lineup stored for setup — not a second copy of the
            timeline.
          </p>
          <ol className="mt-4 divide-y divide-[var(--line)]">
            {lineup.map((row, index) => (
              <li key={row.sourceKey} className="flex min-h-12 items-baseline gap-3 py-3">
                <span className="w-6 shrink-0 text-sm font-semibold text-muted">{index + 1}</span>
                <span className="text-base font-semibold leading-snug">{row.title}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-10">
        <Link
          href="/plan/timeline"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)]"
        >
          Open the full timeline
        </Link>
      </p>
    </div>
  );
}
