import { redirect } from "next/navigation";

/** @deprecated V2 shopping lives under Plan. */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  if (sp.who) next.set("who", sp.who);
  const query = next.toString();
  redirect(query ? `/plan/shopping?${query}` : "/plan/shopping");
}
