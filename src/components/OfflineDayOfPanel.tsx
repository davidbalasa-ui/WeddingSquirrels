"use client";

import { useMemo } from "react";
import { DayOfExperience } from "@/components/DayOfExperience";
import { viewFromExperienceSource } from "@/lib/day-of";
import { sourceFromPack } from "@/lib/offline-pack";
import type { OfflinePack } from "@/lib/offline-db";

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
