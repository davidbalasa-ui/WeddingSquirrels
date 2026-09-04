import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { lockAction } from "@/app/actions";
import { PeopleProfileView } from "@/components/PeopleProfileView";
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
      <div className="flex items-center justify-between gap-3 pt-5">
        <Link href="/people" className="min-h-11 text-sm font-semibold text-[var(--accent)]">
          ← People
        </Link>
        <form action={lockAction}>
          <button
            type="submit"
            className="min-h-11 px-1 text-xs font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Log out
          </button>
        </form>
      </div>
      <div className="mt-4">
        <PeopleProfileView profile={profile} />
      </div>
    </>
  );
}
