"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createProposalSchema,
  type CreateProposalInput,
} from "@/lib/validation/proposals";

export type ActionState = { error: string | null };

export async function createProposal(
  input: CreateProposalInput,
): Promise<ActionState> {
  const parsed = createProposalSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_proposal", {
    p_post_id: parsed.data.postId,
    p_cash_delta_cents: parsed.data.cashDeltaCents,
    p_message: parsed.data.message ?? undefined,
    p_items: parsed.data.items.map((item) => ({
      game_id: item.gameId,
      ticket_type: item.ticketType,
      section_code: item.sectionCode,
      row_label: item.rowLabel,
      seat_labels: item.seatLabels,
      quantity: item.quantity,
    })),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/posts/${parsed.data.postId}`);
  revalidatePath("/proposals");
  return { error: null };
}

async function updateProposalStatus(
  proposalId: string,
  status: "accepted" | "declined" | "withdrawn",
): Promise<ActionState> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("proposals")
    .update({ status })
    .eq("id", proposalId)
    .select("post_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return {
      error: "This proposal can no longer be updated.",
    };
  }

  revalidatePath(`/posts/${data.post_id}`);
  revalidatePath("/proposals");
  return { error: null };
}

export async function acceptProposal(proposalId: string): Promise<ActionState> {
  return updateProposalStatus(proposalId, "accepted");
}

export async function declineProposal(
  proposalId: string,
): Promise<ActionState> {
  return updateProposalStatus(proposalId, "declined");
}

export async function withdrawProposal(
  proposalId: string,
): Promise<ActionState> {
  return updateProposalStatus(proposalId, "withdrawn");
}
