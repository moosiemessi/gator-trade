import { z } from "zod";

const uuid = z.uuid();

// Section, row, and seats are null for general admission (SPEC.md section
// 5) — that's a valid, complete item, not missing data, so the refinement
// enforces the pairing in both directions rather than just allowing nulls.
const offerItemSchema = z
  .object({
    gameId: uuid,
    ticketType: z.enum(["assigned", "general_admission"]),
    sectionCode: z.string().trim().min(1).max(10).nullable(),
    rowLabel: z.string().trim().min(1).max(20).nullable(),
    seatLabels: z.array(z.string().trim().min(1).max(10)).nullable(),
    quantity: z.number().int().min(1).max(8),
  })
  .refine(
    (item) =>
      item.ticketType === "general_admission"
        ? item.sectionCode === null &&
          item.rowLabel === null &&
          (item.seatLabels === null || item.seatLabels.length === 0)
        : item.sectionCode !== null,
    {
      message:
        "Assigned tickets need a section; general admission items can't have one.",
    },
  );

const wantSlotSchema = z
  .object({
    acceptableGameIds: z.array(uuid).min(1, "Pick at least one game"),
    minTier: z.number().int().min(1).max(5).nullable(),
    maxTier: z.number().int().min(1).max(5).nullable(),
    quantity: z.number().int().min(1).max(8),
    requireTogether: z.boolean(),
  })
  .refine(
    (slot) =>
      slot.minTier === null ||
      slot.maxTier === null ||
      slot.minTier <= slot.maxTier,
    { message: "Minimum tier can't be higher than maximum tier" },
  );

export const createPostSchema = z.object({
  offerItems: z
    .array(offerItemSchema)
    .min(1, "Add at least one ticket you're offering"),
  // Zero slots is a valid, deliberate cash-only sale (SPEC.md section 4),
  // not an incomplete form.
  wantSlots: z.array(wantSlotSchema),
  cashDeltaCents: z.number().int(),
  notes: z.string().trim().max(1000).nullable(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
