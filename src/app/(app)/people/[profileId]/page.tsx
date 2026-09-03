import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PeopleProfileView } from "@/components/PeopleProfileView";
import { V2PageHeader } from "@/components/V2PageHeader";
import { parseProfileId } from "@/lib/people-directory";
import { loadPeopleProfile } from "@/lib/people-profile";
import { requirePageSession } from "@/lib/session";

export default async function PeopleProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId: rawProfileId } = await params;
  const profileId = decodeURIComponent(rawProfileId);
  if (!parseProfileId(profileId)) notFound();

  const session = await requirePageSession();
  const profile = await loadPeopleProfile(session, profileId);
  if (!profile) notFound();
  if (profile.profileId !== profileId) {
    redirect(`/people/${encodeURIComponent(profile.profileId)}`);
  }

  return (
    <>
      <V2PageHeader session={session} title={profile.name} subtitle={profile.roles.join(" · ")} />
      <PeopleProfileView profile={profile} />
      <div className="mt-6">
        <Link href="/people" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to People
        </Link>
      </div>
    </>
  );
}
