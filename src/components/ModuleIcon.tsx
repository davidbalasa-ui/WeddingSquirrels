import type { ModuleIconName } from "@/lib/modules";

function base(props: { className?: string }) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function ModuleIcon({
  name,
  className,
}: {
  name: ModuleIconName;
  className?: string;
}) {
  switch (name) {
    case "tasks":
      return (
        <svg {...base({ className })}>
          <path d="M9 6h8M9 12h8M9 18h5" />
          <path d="M5 6.5 5.5 7l1.5-1.5M5 12.5 5.5 13l1.5-1.5M5 18.5 5.5 19l1.5-1.5" />
        </svg>
      );
    case "day":
      return (
        <svg {...base({ className })}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "ask":
      return (
        <svg {...base({ className })}>
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "guests":
      return (
        <svg {...base({ className })}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
          <circle cx="17.5" cy="9" r="2.5" />
          <path d="M17 14.5c2.3.4 4 2 4 4.5" />
        </svg>
      );
    case "people":
      return (
        <svg {...base({ className })}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      );
    case "shop":
      return (
        <svg {...base({ className })}>
          <path d="M6 7h12l1.2 13H4.8z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
      );
    case "money":
      return (
        <svg {...base({ className })}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10" />
          <path d="M9.5 9.5c0-1.1 1.1-1.5 2.5-1.5s2.5.4 2.5 1.5-1.1 1.5-2.5 2-2.5 1-2.5 2 1.1 1.5 2.5 1.5 2.5-.4 2.5-1.5" />
        </svg>
      );
    case "stay":
      return (
        <svg {...base({ className })}>
          <path d="M3 11l9-7 9 7" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M9 21v-6h6v6" />
        </svg>
      );
    case "rehearsal":
      return (
        <svg {...base({ className })}>
          <path d="M12 3l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2z" />
        </svg>
      );
    case "dinner":
      return (
        <svg {...base({ className })}>
          <path d="M6 3v8a2 2 0 0 0 4 0V3M8 3v18" />
          <path d="M16 3v6a2 2 0 0 0 4 0V3M18 3v18" />
        </svg>
      );
    case "accounts":
      return (
        <svg {...base({ className })}>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="9" cy="18" r="2" />
        </svg>
      );
    case "more":
      return (
        <svg {...base({ className })}>
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      );
    default:
      return null;
  }
}
