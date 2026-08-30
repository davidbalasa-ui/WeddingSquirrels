type PersonAvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<PersonAvatarSize, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-[4.5rem] w-[4.5rem] text-lg",
};

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PersonAvatar({
  name,
  photoSrc,
  size = "md",
  className = "",
}: {
  name: string;
  /** Reserved for a future photo URL or data URL. */
  photoSrc?: string | null;
  size?: PersonAvatarSize;
  className?: string;
}) {
  const sizeClass = SIZE_CLASSES[size];
  const label = name.trim() || "?";
  const initials = initialsFromName(label) || "?";

  if (photoSrc) {
    return (
      <img
        src={photoSrc}
        alt={label}
        className={`shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-[family-name:var(--font-display)] font-semibold text-[var(--accent)] ${sizeClass} ${className}`}
      aria-hidden={!name.trim()}
    >
      {initials}
    </span>
  );
}
