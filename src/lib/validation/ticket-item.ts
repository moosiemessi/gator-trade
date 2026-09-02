import { z } from "zod";

export const uuid = z.uuid();

// Shared by post_offer_items and proposal_items — same columns, same
// assigned/general-admission pairing rule (SPEC.md section 5): section,
// row, and seats are null for GA, which is a valid, complete item, not
// missing data, so the refinement enforces the pairing in both directions
// rather than just allowing nulls.
export const ticketItemSchema = z
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

export type TicketItemInput = z.infer<typeof ticketItemSchema>;
