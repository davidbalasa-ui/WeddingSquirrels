import { redirect } from "next/navigation";
import { isTemporalPreviewAllowed } from "@/lib/preview-clock";
import { requirePageSession } from "@/lib/session";

export default async function DayNowPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePageSession({ need: "canSeeTimeline" });
  const params = await searchParams;
  const asOf = typeof params.asOf === "string" ? params.asOf : undefined;
  if (asOf && isTemporalPreviewAllowed()) {
    redirect(`/day?asOf=${encodeURIComponent(asOf)}`);
  }
  redirect("/day");
}
