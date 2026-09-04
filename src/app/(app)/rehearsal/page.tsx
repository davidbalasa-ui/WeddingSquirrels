import { redirect } from "next/navigation";

/** Legacy rehearsal URL — PLAN destination is /plan/rehearsal. */
export default async function RehearsalPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  redirect(editParam === "1" ? "/plan/rehearsal?edit=1" : "/plan/rehearsal");
}
