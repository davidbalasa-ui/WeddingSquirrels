"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-[var(--warn)] bg-[var(--warn-soft)] px-4 py-2 text-sm font-semibold text-[var(--warn)]">
      You&apos;re offline —{" "}
      <Link href="/offline" className="underline">
        open the offline copy
      </Link>
    </div>
  );
}
