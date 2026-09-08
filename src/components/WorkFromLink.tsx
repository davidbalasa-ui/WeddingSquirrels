"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { workHrefWithFrom } from "@/lib/work-return";

export function useWorkHref(href: string | undefined | null): string | undefined {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!href) return href ?? undefined;
  if (pathname === "/work" || pathname.startsWith("/work/")) return href;
  const search = searchParams.toString();
  const from = search ? `${pathname}?${search}` : pathname;
  return workHrefWithFrom(href, from);
}

export function WorkFromLink({
  href,
  ...props
}: ComponentProps<typeof Link> & { href: string }) {
  const nextHref = useWorkHref(href) ?? href;
  return <Link href={nextHref} {...props} />;
}
