export const VENUE_LAYOUT_SRC = "/seating-layout.png";

/**
 * The Black Sheep Shelter layout. One source of truth for Day-of, the guest
 * seating view, and the offline copy. Tapping opens the full-size image so the
 * phone's native zoom works even though the app itself disables pinch-zoom.
 */
export function VenueLayoutFigure({ caption = true }: { caption?: boolean }) {
  return (
    <figure className="card overflow-hidden">
      <a
        href={VENUE_LAYOUT_SRC}
        target="_blank"
        rel="noreferrer"
        aria-label="Open the Black Sheep Shelter layout full size"
        className="block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset, also used offline */}
        <img
          src={VENUE_LAYOUT_SRC}
          alt="Black Sheep Shelter layout: Entry and Tyler tables at the top, South tables on the left, North tables on the right, the head table between the bar and the band, dessert table on the south wall and gift table on the north wall"
          width={527}
          height={745}
          className="h-auto w-full"
        />
      </a>
      {caption ? (
        <figcaption className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-muted">
          <span>South is left, North is right. Head table sits between the bar and the band.</span>
          <a
            href={VENUE_LAYOUT_SRC}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 font-semibold text-[var(--accent)]"
          >
            Full size
          </a>
        </figcaption>
      ) : null}
    </figure>
  );
}
