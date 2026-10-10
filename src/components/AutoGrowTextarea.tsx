"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

export function fitTextarea(el: HTMLTextAreaElement) {
  // "auto" first so the box can shrink; `rows` stays the minimum height.
  el.style.height = "auto";
  // The box's height includes its border (border-box), scrollHeight does not.
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  // Hidden only once the box fits; before the page is interactive it can still scroll.
  el.style.overflowY = "hidden";
}

/**
 * A textarea that grows with its wrapped text, so a note is read in full on the
 * card instead of scrolling inside a small box. `rows` is the starting height.
 */
export function AutoGrowTextarea({ onInput, style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    fitTextarea(el);
    void document.fonts?.ready.then(() => fitTextarea(el));
    // A narrower or wider card wraps the text differently (rotation, fonts loading).
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitTextarea(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Values set from outside (a reload or a reset to the saved text) refit too.
  useEffect(() => {
    if (ref.current) fitTextarea(ref.current);
  });

  return (
    <textarea
      {...props}
      ref={ref}
      style={{ resize: "none", ...style }}
      onInput={(event) => {
        fitTextarea(event.currentTarget);
        onInput?.(event);
      }}
    />
  );
}
