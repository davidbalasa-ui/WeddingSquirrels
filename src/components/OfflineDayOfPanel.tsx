"use client";

import { useMemo } from "react";
import { DayOfExperience } from "@/components/DayOfExperience";
import {
  formatWeddingDateLabel,
  toDayOfBlock,
  viewFromExperienceSource,
  type DayOfAssignmentInput,
  type DayOfContactInput,
  type DayOfExperienceSource,
} from "@/lib/day-of";
import type { OfflinePack } from "@/lib/offline-db";

type TimelineRow = {
  id: string;
  schedule?: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  startMinutes?: number | null;
  endMinutes?: number | null;
  dayOffset?: number;
  sortOrder?: number;
};

type ContactRow = {
  id: string;
  name: string;
  directoryLabel?: string | null;
  phone: string | null;
  email: string | null;
  photoData: string | null;
  sortOrder?: number;
  isDayOfContact?: boolean;
  personId?: string | null;
};

type AssignmentRow = {
  id: string;
  title: string;
  notes: string | null;
  sortOrder?: number;
  assignees?: Array<{ personId: string }>;
};

type PersonRow = { id: string; name: string };

function sourceFromPack(pack: OfflinePack): DayOfExperienceSource {
  const timezone = pack.timezone || "America/Detroit";
  const now = new Date();
  const people = (pack.people ?? []) as PersonRow[];
  const peopleById = new Map(people.map((person) => [person.id, person.name]));
  const blocks = ((pack.timeline ?? []) as TimelineRow[])
    .filter((block) => block.schedule !== "rehearsal")
    .map(toDayOfBlock);
  const contacts: DayOfContactInput[] = ((pack.contacts ?? []) as ContactRow[]).map((contact) => ({
    id: contact.id,
    name: contact.name,
    personName: contact.personId ? peopleById.get(contact.personId) ?? null : null,
    directoryLabel: contact.directoryLabel ?? null,
    phone: contact.phone,
    email: contact.email,
    photoData: contact.photoData,
    sortOrder: contact.sortOrder,
    isDayOfContact: contact.isDayOfContact,
    personId: contact.personId ?? null,
  }));
  const assignments: DayOfAssignmentInput[] = ((pack.assignments ?? []) as AssignmentRow[]).map(
    (assignment) => ({
      id: assignment.id,
      title: assignment.title,
      notes: assignment.notes,
      sortOrder: assignment.sortOrder,
      assignees: assignment.assignees ?? [],
    }),
  );

  return {
    generatedAt: now.toISOString(),
    freezeClock: false,
    timezone,
    weddingDateIso: pack.weddingDate,
    coupleNames: pack.coupleNames,
    weddingDateLabel: pack.weddingDate
      ? formatWeddingDateLabel(new Date(pack.weddingDate), timezone)
      : null,
    blocks,
    contacts,
    assignments,
    linkedPersonId: null,
    canSeeContacts: true,
  };
}

export function OfflineDayOfPanel({
  pack,
}: {
  pack: OfflinePack;
  onAllContacts?: () => void;
}) {
  const source = useMemo(() => sourceFromPack(pack), [pack]);
  const initialView = useMemo(
    () => viewFromExperienceSource(source, new Date(source.generatedAt)),
    [source],
  );

  return (
    <DayOfExperience
      source={source}
      initialView={initialView}
      canEdit={false}
      showTabs={false}
    />
  );
}
