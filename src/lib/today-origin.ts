"use client";

import { useSearchParams } from "next/navigation";

/** Preserve Today filters/tabs when drilling into linked records. */
export function useTodayOriginHref(): string {
  const params = useSearchParams();
  const query = params.toString();
  return query ? `/today?${query}` : "/today";
}
