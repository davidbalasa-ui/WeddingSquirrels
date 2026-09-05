import { DayOfExperience } from "@/components/DayOfExperience";
import { loadDayOfExperience } from "@/lib/day-of-page";
import { requirePageSession } from "@/lib/session";

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const params = await searchParams;
  const asOf = typeof params.asOf === "string" ? params.asOf : undefined;
  const { source, view, canEdit } = await loadDayOfExperience(session, { asOf });

  return <DayOfExperience source={source} initialView={view} canEdit={canEdit} />;
}
