import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PostForm,
  type OfferItemState,
  type WantSlotState,
} from "@/app/posts/new/post-form";

export const metadata: Metadata = {
  title: "Edit post | Gator Trade",
};

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: postId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const [{ data: post }, { data: games }, { data: sections }, { count: pendingCount }] =
    await Promise.all([
      supabase
        .from("posts")
        .select(
          `
          id, author_id, cash_delta_cents, status, notes,
          post_offer_items (
            game_id, ticket_type, section_code, row_label, seat_labels, quantity
          ),
          post_want_items (
            acceptable_game_ids, min_tier, max_tier, quantity, require_together
          )
          `,
        )
        .eq("id", postId)
        .single(),
      supabase
        .from("games")
        .select("id, opponent, kickoff_at, is_home")
        .order("kickoff_at", { ascending: true }),
      supabase
        .from("sections")
        .select("code, tier, level")
        .order("code", { ascending: true }),
      supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("status", "pending"),
    ]);

  if (!post) {
    notFound();
  }

  // posts_select_open_or_own (SPEC.md section 6) already limits what a
  // non-author can see of someone else's post, but that's SELECT-only —
  // this route is author-only, so a non-author (or nobody, if RLS hid the
  // row entirely) gets the same 404 rather than a form they can't submit.
  if (post.author_id !== user.id) {
    notFound();
  }

  if (post.status !== "open") {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900">
          Not editable
        </h1>
        <p className="text-gray-600">
          Only open posts can be edited. This post is {post.status}.
        </p>
        <Link
          href={`/posts/${postId}`}
          className="mt-6 inline-block text-sm font-medium text-orange-600 underline"
        >
          Back to post
        </Link>
      </main>
    );
  }

  const initialOfferItems: OfferItemState[] = post.post_offer_items.map(
    (item) => ({
      gameId: item.game_id,
      ticketType: item.ticket_type,
      sectionCode: item.section_code ?? "",
      rowLabel: item.row_label ?? "",
      seatLabelsRaw: (item.seat_labels ?? []).join(", "),
      quantity: item.quantity,
    }),
  );

  const initialWantSlots: WantSlotState[] = post.post_want_items.map(
    (slot) => ({
      acceptableGameIds: slot.acceptable_game_ids,
      minTier: slot.min_tier?.toString() ?? "",
      maxTier: slot.max_tier?.toString() ?? "",
      quantity: slot.quantity,
      requireTogether: slot.require_together,
    }),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        Edit post
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Update what you&apos;re offering, what you&apos;ll take, or the cash
        amount.
      </p>
      <PostForm
        mode="edit"
        postId={post.id}
        games={games ?? []}
        sections={sections ?? []}
        initialCashDeltaCents={post.cash_delta_cents}
        initialNotes={post.notes ?? ""}
        initialOfferItems={initialOfferItems}
        initialWantSlots={initialWantSlots}
        pendingProposalsCount={pendingCount ?? 0}
      />
    </main>
  );
}
