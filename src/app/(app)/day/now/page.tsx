import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/session";

export default async function DayNowPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePageSession({ need: "canSeeTimeline" });
  const params = await searchParams;
  const asOf = typeof params.asOf === "string" ? params.asOf : undefined;
  if (asOf && process.env.NODE_ENV !== "production") {
    redirect(`/day?asOf=${encodeURIComponent(asOf)}`);
  }
  redirect("/day");
}
