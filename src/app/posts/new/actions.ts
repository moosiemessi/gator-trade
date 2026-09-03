"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createPostSchema,
  type CreatePostInput,
} from "@/lib/validation/posts";

export type CreatePostState =
  | { error: string; postId: null }
  | { error: null; postId: string };

export async function createPost(
  input: CreatePostInput,
): Promise<CreatePostState> {
  const parsed = createPostSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      postId: null,
    };
  }

  const supabase = await createClient();

  const { data: postId, error } = await supabase.rpc("create_post", {
    p_cash_delta_cents: parsed.data.cashDeltaCents,
    p_notes: parsed.data.notes ?? undefined,
    p_offer_items: parsed.data.offerItems.map((item) => ({
      game_id: item.gameId,
      ticket_type: item.ticketType,
      section_code: item.sectionCode,
      row_label: item.rowLabel,
      seat_labels: item.seatLabels,
      quantity: item.quantity,
    })),
    p_want_slots: parsed.data.wantSlots.map((slot) => ({
      acceptable_game_ids: slot.acceptableGameIds,
      min_tier: slot.minTier,
      max_tier: slot.maxTier,
      quantity: slot.quantity,
      require_together: slot.requireTogether,
    })),
  });

  if (error) {
    return { error: error.message, postId: null };
  }
  if (!postId) {
    return { error: "Post creation did not return an id", postId: null };
  }

  return { error: null, postId };
}
