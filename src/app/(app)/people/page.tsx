import { redirect } from "next/navigation";

/** @deprecated Stage B — People filters live on Home. */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; done?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  if (sp.who) next.set("who", sp.who);
  if (sp.done) next.set("done", sp.done);
  const q = next.toString();
  redirect(q ? `/home?${q}` : "/home");
}
