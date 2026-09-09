import Link from "next/link";
import { operationalViewLinks } from "@/lib/playbook";

export function OperationalViewsNav({ current }: { current?: string }) {
  const links = operationalViewLinks();
  return (
    <nav aria-label="Wedding-day operational views" className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => {
        const active = current === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="filter-pill rounded-full border px-3.5 py-2 text-sm font-semibold"
            data-active={active}
            aria-current={active ? "page" : undefined}
            style={
              active
                ? {
                    borderColor: "var(--accent)",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }
                : undefined
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
