import { z } from "zod";
import { ticketItemSchema, uuid } from "./ticket-item";

export const createProposalSchema = z.object({
  postId: uuid,
  // From the post author's perspective, same convention as posts
  // (SPEC.md section 5) — a proposer counters on price by changing this,
  // not by adding a second signed field.
  cashDeltaCents: z.number().int(),
  message: z.string().trim().max(1000).nullable(),
  // May be empty: a proposer offering nothing but cash against a
  // want-slot-free post is the normal case for buying a straight sale.
  items: z.array(ticketItemSchema),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
