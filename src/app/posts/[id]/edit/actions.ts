"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  updatePostSchema,
  type UpdatePostInput,
} from "@/lib/validation/posts";

export type UpdatePostState =
  | { error: string; postId: null }
  | { error: null; postId: string };

export async function updatePost(
  input: UpdatePostInput,
): Promise<UpdatePostState> {
  const parsed = updatePostSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      postId: null,
    };
  }

  const supabase = await createClient();

  const { data: postId, error } = await supabase.rpc("update_post", {
    p_post_id: parsed.data.postId,
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
    p_decline_pending: parsed.data.declinePending,
  });

  if (error) {
    return { error: error.message, postId: null };
  }
  if (!postId) {
    return { error: "Post update did not return an id", postId: null };
  }

  revalidatePath(`/posts/${postId}`);
  revalidatePath(`/posts/${postId}/edit`);
  return { error: null, postId };
}
