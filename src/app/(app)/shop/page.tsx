import { redirect } from "next/navigation";

/** @deprecated Stage B — Shop lives on Home. */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams({ filter: "buy" });
  if (sp.who) next.set("who", sp.who);
  redirect(`/home?${next.toString()}`);
}
