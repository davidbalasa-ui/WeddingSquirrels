import type { RoleNameContext } from "@/lib/day-timeline-view";
import { prisma } from "@/lib/db";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { isMcDirectoryLabel } from "@/lib/print-center";
import { lineupRole } from "@/lib/print-projection";

const FAMILY_LINEUP = /mother|father|\bmom\b|\bdad\b|parents?/i;
/** "Officiant & Mother of the Bride" names roles, not people; a role word must never become a name. */
const ROLE_NOT_NAME = /^(?:the\s+)?(?:officiant|mother|father|mom|dad|parents?|flower girl|ring bearer|bride|groom)\b/i;
const PHOTO_LABEL = /photo|video/i;
const VENDOR_LABEL = /planner|venue|cater|dj|florist|bar|coordinator|officiant|rental|hair|makeup/i;

/**
 * Names that place a timeline line with a role even when the line has no role word:
 * lineup rows give the wedding party and family, the directory gives MC, photographer and vendors.
 */
export async function loadTimelineRoleNames(): Promise<RoleNameContext> {
  const [lineup, people, contacts] = await Promise.all([
    loadPlaybookItems("lineup").catch(() => []),
    prisma.person.findMany({ select: { name: true, directoryLabel: true } }).catch(() => []),
    prisma.contact.findMany({ select: { name: true, directoryLabel: true } }).catch(() => []),
  ]);
  return roleNamesFrom({ lineup, people: [...people, ...contacts] });
}

export function roleNamesFrom(input: {
  lineup: Array<{ title: string }>;
  people: Array<{ name: string; directoryLabel?: string | null }>;
}): RoleNameContext {
  const { lineup, people } = input;
  const party: string[] = [];
  const family: string[] = [];
  for (const row of lineup) {
    const parsed = lineupRole(row.title);
    const target = FAMILY_LINEUP.test(row.title) ? family : party;
    for (const name of parsed.names) {
      if (/^(david|haley)\b/i.test(name) || ROLE_NOT_NAME.test(name)) continue;
      target.push(name);
    }
  }

  const mc: string[] = [];
  const photo: string[] = [];
  const vendors: string[] = [];
  for (const row of people) {
    const label = row.directoryLabel ?? "";
    if (isMcDirectoryLabel(label)) mc.push(row.name);
    else if (PHOTO_LABEL.test(label)) photo.push(row.name);
    else if (VENDOR_LABEL.test(label)) vendors.push(row.name);
  }

  return { party, family, mc, photo, vendors };
}
