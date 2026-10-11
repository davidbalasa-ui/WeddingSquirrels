import { Fragment } from "react";

/**
 * David, 2026-10-11 15:52: "add "SHARP" bolded to the 3:45 leave time on thursday".
 * A moment title's "SHARP" prints heavier than the title around it, on every screen and printout.
 */
export function SharpTitle({ text }: { text: string }) {
  const parts = text.split(/\b(SHARP)\b/);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        part === "SHARP" ? (
          <strong key={index} className="sharp-word">
            SHARP
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
