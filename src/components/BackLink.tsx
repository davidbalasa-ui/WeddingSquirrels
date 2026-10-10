"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { readNavigationMemory } from "@/components/ScrollMemory";
import { backLinkStepsBack } from "@/lib/navigation-memory";

/**
 * An in-app "← Back" link. When the previous screen is the one it points at,
 * it steps back in history so that screen comes back as it was (same tab,
 * same scroll position); otherwise it opens the page fresh.
 */
export function BackLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!backLinkStepsBack(readNavigationMemory(), href)) return;
    event.preventDefault();
    router.back();
  }

  return <Link href={href} onClick={handleClick} {...rest} />;
}
