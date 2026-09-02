"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendMessageSchema, type SendMessageInput } from "@/lib/validation/messages";

export type ActionState = { error: string | null };

// Which specific column a caller may set (their own, forward-from-null
// only) is enforced by the enforce_handoff_update trigger from step 4,
// not here — this just validates the column name is one of the five real
// ones and lets that trigger be the actual authority, the same way it
// already was verified live.
const handoffColumnSchema = z.enum([
  "author_marked_sent_at",
  "proposer_marked_sent_at",
  "author_confirmed_at",
  "proposer_confirmed_at",
  "cash_settled_at",
]);

export async function markHandoffColumn(
  handoffId: string,
  column: string,
): Promise<ActionState> {
  const parsed = handoffColumnSchema.safeParse(column);
  if (!parsed.success) {
    return { error: "Invalid field" };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const update =
    parsed.data === "author_marked_sent_at"
      ? { author_marked_sent_at: now }
      : parsed.data === "proposer_marked_sent_at"
        ? { proposer_marked_sent_at: now }
        : parsed.data === "author_confirmed_at"
          ? { author_confirmed_at: now }
          : parsed.data === "proposer_confirmed_at"
            ? { proposer_confirmed_at: now }
            : { cash_settled_at: now };

  const { error } = await supabase
    .from("handoffs")
    .update(update)
    .eq("id", handoffId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/handoffs/${handoffId}`);
  return { error: null };
}

export async function sendMessage(
  handoffId: string,
  input: SendMessageInput,
): Promise<ActionState> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in" };
  }

  const { error } = await supabase.from("messages").insert({
    proposal_id: parsed.data.proposalId,
    sender_id: user.id,
    body: parsed.data.body,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/handoffs/${handoffId}`);
  return { error: null };
}
