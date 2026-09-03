import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postImageUrl } from "@/lib/aws/cloudfront";
import { ImageUploader } from "@/components/post-images/image-uploader";
import { PostImageGallery } from "@/components/post-images/post-image-gallery";
import { ProposeForm } from "./propose-form";
import { ProposalStatusButtons } from "@/app/proposals/proposal-status-buttons";

export const metadata: Metadata = {
  title: "Post | Gator Trade",
};

function formatCash(cents: number) {
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
  if (cents > 0) return `Buyer pays ${formatted}`;
  if (cents < 0) return `Author pays ${formatted}`;
  return "Even swap";
}

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  pending: "Pending",
  completed: "Completed",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export default async function PostDetailPage({
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

  const [{ data: post }, { data: profile }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        `
        id, author_id, cash_delta_cents, status, notes, created_at,
        profiles_public ( display_name ),
        post_offer_items (
          id, ticket_type, section_code, row_label, seat_labels, quantity,
          games ( opponent, kickoff_at ),
          sections ( tier, level )
        ),
        post_want_items (
          id, acceptable_game_ids, min_tier, max_tier, quantity, require_together
        ),
        post_images (
          id, s3_key
        )
        `,
      )
      .eq("id", postId)
      .single(),
    supabase.from("profiles").select("is_verified").eq("id", user.id).single(),
  ]);

  if (!post) {
    notFound();
  }

  const isOwnPost = post.author_id === user.id;
  const images = post.post_images.map((image) => ({
    id: image.id,
    url: postImageUrl(image.s3_key),
  }));

  const [{ data: wantGames }, { data: proposals }, { data: games }, { data: sections }] =
    await Promise.all([
      post.post_want_items.length > 0
        ? supabase
            .from("games")
            .select("id, opponent")
            .in(
              "id",
              Array.from(
                new Set(
                  post.post_want_items.flatMap((slot) => slot.acceptable_game_ids),
                ),
              ),
            )
        : Promise.resolve({ data: [] }),
      // RLS scopes this naturally: the author sees every proposal on their
      // post, anyone else sees only their own proposal(s) on it.
      supabase
        .from("proposals")
        .select(
          `
          id, proposer_id, cash_delta_cents, message, status, created_at,
          profiles_public ( display_name ),
          proposal_items (
            id, ticket_type, section_code, row_label, seat_labels, quantity,
            games ( opponent, kickoff_at ),
            sections ( tier, level )
          ),
          handoffs ( id )
          `,
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: false }),
      isOwnPost
        ? Promise.resolve({ data: [] })
        : supabase
            .from("games")
            .select("id, opponent")
            .order("kickoff_at", { ascending: true }),
      isOwnPost
        ? Promise.resolve({ data: [] })
        : supabase
            .from("sections")
            .select("code, tier, level")
            .order("code", { ascending: true }),
    ]);

  const gameNameById = new Map((wantGames ?? []).map((g) => [g.id, g.opponent]));

  const myPendingProposal = !isOwnPost
    ? (proposals ?? []).find((p) => p.status === "pending")
    : undefined;
  const canPropose =
    !isOwnPost &&
    profile?.is_verified &&
    post.status === "open" &&
    !myPendingProposal;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {formatCash(post.cash_delta_cents)}
        </h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          {STATUS_LABELS[post.status] ?? post.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Posted by{" "}
        {isOwnPost
          ? "you"
          : (post.profiles_public?.display_name ?? "a Gator Trade user")}
      </p>

      {isOwnPost ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700">Photos</h2>
          <div className="mt-2">
            <ImageUploader postId={post.id} existingImages={images} />
          </div>
        </section>
      ) : images.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700">Photos</h2>
          <div className="mt-2">
            <PostImageGallery images={images} />
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700">Offering</h2>
        <ul className="mt-2 space-y-2">
          {post.post_offer_items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-gray-200 p-3 text-sm text-gray-700"
            >
              <p className="font-medium text-gray-900">
                {item.games?.opponent}
                {item.games?.kickoff_at
                  ? ` — ${formatKickoff(item.games.kickoff_at)}`
                  : ""}
              </p>
              <p>
                {item.quantity}×{" "}
                {item.ticket_type === "general_admission"
                  ? "general admission"
                  : `Section ${item.section_code}${
                      item.sections
                        ? ` (tier ${item.sections.tier}, ${item.sections.level})`
                        : ""
                    }`}
                {item.row_label ? `, row ${item.row_label}` : ""}
              </p>
              {item.seat_labels && item.seat_labels.length > 0 ? (
                <p>Seats: {item.seat_labels.join(", ")}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700">Looking for</h2>
        {post.post_want_items.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            Cash only — no trade wanted.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {post.post_want_items.map((slot) => (
              <li
                key={slot.id}
                className="rounded-md border border-gray-200 p-3 text-sm text-gray-700"
              >
                <p>
                  {slot.quantity}× at{" "}
                  {slot.acceptable_game_ids
                    .map((id) => gameNameById.get(id) ?? id)
                    .join(" or ")}
                </p>
                <p>
                  Tier {slot.min_tier ?? "any"}
                  {" – "}
                  {slot.max_tier ?? "any"}
                  {slot.require_together ? ", seats must be together" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {post.notes ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700">Notes</h2>
          <p className="mt-2 text-sm text-gray-600">{post.notes}</p>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700">
          {isOwnPost ? "Proposals" : "Your proposal"}
        </h2>

        {isOwnPost && (proposals ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            No proposals yet.
          </p>
        ) : null}

        <ul className="mt-2 space-y-3">
          {(proposals ?? []).map((proposal) => (
            <li
              key={proposal.id}
              className="rounded-md border border-gray-200 p-3 text-sm text-gray-700"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  {isOwnPost
                    ? (proposal.profiles_public?.display_name ??
                      "a Gator Trade user")
                    : "You"}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status}
                </span>
              </div>
              <p className="mt-1">{formatCash(proposal.cash_delta_cents)}</p>
              {proposal.proposal_items.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {proposal.proposal_items.map((item) => (
                    <li key={item.id}>
                      Offering {item.quantity}×{" "}
                      {item.ticket_type === "general_admission"
                        ? `general admission at ${item.games?.opponent ?? ""}`
                        : `Section ${item.section_code}${
                            item.sections ? ` (tier ${item.sections.tier})` : ""
                          } at ${item.games?.opponent ?? ""}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-gray-500">Cash offer, no tickets</p>
              )}
              {proposal.message ? (
                <p className="mt-1 italic text-gray-600">
                  &ldquo;{proposal.message}&rdquo;
                </p>
              ) : null}

              {proposal.status === "pending" ? (
                <ProposalStatusButtons
                  proposalId={proposal.id}
                  role={isOwnPost ? "author" : "proposer"}
                />
              ) : null}
              {proposal.status === "accepted" && proposal.handoffs ? (
                <Link
                  href={`/handoffs/${proposal.handoffs.id}`}
                  className="mt-2 inline-block text-sm font-medium text-orange-600 underline"
                >
                  View handoff
                </Link>
              ) : null}
            </li>
          ))}
        </ul>

        {canPropose ? (
          <div className="mt-4">
            <ProposeForm
              postId={post.id}
              defaultCashDeltaCents={post.cash_delta_cents}
              games={games ?? []}
              sections={sections ?? []}
            />
          </div>
        ) : null}

        {!isOwnPost && !profile?.is_verified ? (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Confirm your ufl.edu email to send proposals.
          </p>
        ) : null}
      </section>
    </main>
  );
}
