import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: post } = await supabase
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
      )
      `,
    )
    .eq("id", postId)
    .single();

  if (!post) {
    notFound();
  }

  const gameIds = new Set(
    post.post_want_items.flatMap((slot) => slot.acceptable_game_ids),
  );
  const { data: wantGames } =
    gameIds.size > 0
      ? await supabase
          .from("games")
          .select("id, opponent")
          .in("id", Array.from(gameIds))
      : { data: [] };
  const gameNameById = new Map(
    (wantGames ?? []).map((g) => [g.id, g.opponent]),
  );

  const isOwnPost = post.author_id === user.id;

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
        Posted by {isOwnPost ? "you" : (post.profiles_public?.display_name ?? "a Gator Trade user")}
      </p>

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
                      item.sections ? ` (tier ${item.sections.tier}, ${item.sections.level})` : ""
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
        <h2 className="text-sm font-semibold text-gray-700">
          Looking for
        </h2>
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
                  Tier{" "}
                  {slot.min_tier ?? "any"}
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
    </main>
  );
}
