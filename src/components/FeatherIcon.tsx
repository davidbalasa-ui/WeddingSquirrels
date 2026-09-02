export function FeatherIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 20c4-8 8-12 16-14-2 8-6 12-14 14" />
      <path d="M4 20l3-3" />
    </svg>
  );
}
