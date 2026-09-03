import { z } from "zod";
import { ticketItemSchema, uuid } from "./ticket-item";

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
    .array(ticketItemSchema)
    .min(1, "Add at least one ticket you're offering"),
  // Zero slots is a valid, deliberate cash-only sale (SPEC.md section 4),
  // not an incomplete form.
  wantSlots: z.array(wantSlotSchema),
  cashDeltaCents: z.number().int(),
  notes: z.string().trim().max(1000).nullable(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = createPostSchema.extend({
  postId: uuid,
  // Whether cash delta, offer items, or want slots changed from what's
  // stored — decided by the form, which holds both the loaded values and
  // the submitted ones. A notes-only save leaves pending proposals alone.
  declinePending: z.boolean(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const withdrawPostSchema = z.object({
  postId: uuid,
});

export type WithdrawPostInput = z.infer<typeof withdrawPostSchema>;
