import type { PrismaClient } from "@prisma/client";

export type StaySectionId = "bride" | "couple" | "groom";

export type StaySlotDef = {
  id: string;
  label: string;
  optional?: boolean;
  defaultOccupant?: string;
  group?: string;
};

export type StaySectionDef = {
  id: StaySectionId;
  title: string;
  detail: string;
  slots: StaySlotDef[];
};

export const STAY_SECTIONS: StaySectionDef[] = [
  {
    id: "bride",
    title: "Bed 1 · Bride side",
    detail: "Triple bunk twins + single twin · 4 beds",
    slots: [
      { id: "bride.bottom", label: "Bottom bunk" },
      { id: "bride.middle", label: "Middle bunk" },
      { id: "bride.top", label: "Top bunk" },
      { id: "bride.single", label: "Single bed" },
    ],
  },
  {
    id: "couple",
    title: "Bedroom 2",
    detail: "Couple room",
    slots: [
      { id: "couple.1", label: "Person 1", defaultOccupant: "Haley" },
      { id: "couple.2", label: "Person 2", defaultOccupant: "David" },
    ],
  },
  {
    id: "groom",
    title: "Bed 3 · Groom side",
    detail: "2 full bunk beds + optional queen air mattress",
    slots: [
      { id: "groom.bottom.1", label: "Bottom bunk · person 1", group: "2 full bunk beds" },
      { id: "groom.bottom.2", label: "Bottom bunk · person 2", optional: true, group: "2 full bunk beds" },
      { id: "groom.top.1", label: "Top bunk · person 1", group: "2 full bunk beds" },
      { id: "groom.top.2", label: "Top bunk · person 2", optional: true, group: "2 full bunk beds" },
      { id: "groom.air.1", label: "Person 1", optional: true, group: "Queen air mattress" },
      { id: "groom.air.2", label: "Person 2", optional: true, group: "Queen air mattress" },
    ],
  },
];

export const STAY_SECTION_IDS = STAY_SECTIONS.map((section) => section.id);

export function isStaySectionId(value: string): value is StaySectionId {
  return STAY_SECTION_IDS.includes(value as StaySectionId);
}

export function isStaySlotId(value: string): boolean {
  return STAY_SECTIONS.some((section) => section.slots.some((slot) => slot.id === value));
}

export async function ensureStayLayout(client: PrismaClient) {
  let sort = 0;
  for (const section of STAY_SECTIONS) {
    for (const slot of section.slots) {
      const existing = await client.staySlot.findUnique({ where: { id: slot.id } });
      if (!existing) {
        await client.staySlot.create({
          data: {
            id: slot.id,
            sectionId: section.id,
            label: slot.label,
            occupant: slot.defaultOccupant ?? "",
            optional: Boolean(slot.optional),
            sortOrder: sort,
          },
        });
      } else {
        await client.staySlot.update({
          where: { id: slot.id },
          data: {
            sectionId: section.id,
            label: slot.label,
            optional: Boolean(slot.optional),
            sortOrder: sort,
            occupant:
              !existing.occupant.trim() && slot.defaultOccupant
                ? slot.defaultOccupant
                : existing.occupant,
          },
        });
      }
      sort += 1;
    }
  }
}
