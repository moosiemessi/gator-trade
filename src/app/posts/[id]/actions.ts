"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  withdrawPostSchema,
  type WithdrawPostInput,
} from "@/lib/validation/posts";

export type ActionState = { error: string | null };

export async function withdrawPost(
  input: WithdrawPostInput,
): Promise<ActionState> {
  const parsed = withdrawPostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  // posts_update_open_author (step 10.5) only allows this transition from
  // 'open', so a post that's pending/completed/withdrawn/expired quietly
  // matches zero rows here rather than erroring.
  const { data, error } = await supabase
    .from("posts")
    .update({ status: "withdrawn" })
    .eq("id", parsed.data.postId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: "This post can no longer be withdrawn." };
  }

  revalidatePath(`/posts/${parsed.data.postId}`);
  return { error: null };
}
