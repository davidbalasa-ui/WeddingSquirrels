type StarProps = {
  className?: string;
  filled?: boolean;
  size?: number;
};

/** Discrete star vector used as the edit affordance. */
export function StarIcon({ className, filled = false, size = 18 }: StarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3.2l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.9l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L12 3.2z" />
    </svg>
  );
}
