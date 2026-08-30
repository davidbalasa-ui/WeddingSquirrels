import { redirect } from "next/navigation";

/** @deprecated V2 — Today lives at /today. */
export default async function HomeRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") next.set(key, value);
    else if (Array.isArray(value)) {
      for (const part of value) next.append(key, part);
    }
  }
  const q = next.toString();
  redirect(q ? `/today?${q}` : "/today");
}
