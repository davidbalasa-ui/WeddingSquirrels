"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UNREAD_ASKS_EVENT } from "@/components/AskNotifier";
import { ModuleIcon } from "@/components/ModuleIcon";

/** One-tap route from Today into conversations, with the live unread count. */
export function MessagesShortcut({ initialUnread = 0 }: { initialUnread?: number }) {
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => {
    const onUnread = (event: Event) => {
      const detail = (event as CustomEvent<{ count: number }>).detail;
      if (detail && typeof detail.count === "number") setUnread(detail.count);
    };
    window.addEventListener(UNREAD_ASKS_EVENT, onUnread);
    return () => window.removeEventListener(UNREAD_ASKS_EVENT, onUnread);
  }, []);

  return (
    <Link
      href="/messages"
      className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--accent)]"
    >
      <ModuleIcon name="ask" className="h-4 w-4" />
      Messages
      {unread > 0 ? (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[11px] font-bold leading-5 text-white">
          {unread > 9 ? "9+" : unread} new
        </span>
      ) : null}
    </Link>
  );
}
