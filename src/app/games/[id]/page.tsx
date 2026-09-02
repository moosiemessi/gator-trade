import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findGamePosts, type BrowseFilters } from "@/lib/matching/upgrade-finder";
import { BrowseFiltersForm } from "./browse-filters-form";

export const metadata: Metadata = {
  title: "Browse | Gator Trade",
};

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCash(cents: number) {
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
  if (cents > 0) return `You pay ${formatted}`;
  if (cents < 0) return `They pay you ${formatted}`;
  return "Even swap";
}

function parseIntParam(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseBoolParam(value: string | string[] | undefined): boolean {
  return value === "1";
}

function parseCashDirection(
  value: string | string[] | undefined,
): BrowseFilters["cashDirection"] {
  if (value === "you_pay" || value === "they_pay" || value === "even") {
    return value;
  }
  return "any";
}

export default async function GameBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: gameId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const [{ data: game }, { data: sections }] = await Promise.all([
    supabase
      .from("games")
      .select("id, opponent, kickoff_at, venue, is_home")
      .eq("id", gameId)
      .single(),
    supabase
      .from("sections")
      .select("code, tier, level")
      .order("code", { ascending: true }),
  ]);

  if (!game) {
    notFound();
  }

  const mySectionCode = typeof sp.mySection === "string" ? sp.mySection : "";
  const mySection = (sections ?? []).find((s) => s.code === mySectionCode);

  const filters: BrowseFilters = {
    myTier: mySection?.tier ?? null,
    minTier: parseIntParam(sp.minTier),
    maxTier: parseIntParam(sp.maxTier),
    minQuantity: parseIntParam(sp.minQuantity),
    seatsTogether: parseBoolParam(sp.seatsTogether),
    cashDirection: parseCashDirection(sp.cashDirection),
    cashOnly: parseBoolParam(sp.cashOnly),
  };

  const posts = await findGamePosts(supabase, gameId, filters, user.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        {game.is_home ? "vs" : "at"} {game.opponent}
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        {formatKickoff(game.kickoff_at)}
        {game.venue ? ` — ${game.venue}` : ""}
      </p>

      <BrowseFiltersForm sections={sections ?? []} />

      <div className="mt-6 space-y-4">
        {posts.length === 0 ? (
          <p className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
            No posts match yet. Try widening the filters.
          </p>
        ) : (
          posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.id}`}
              className="block rounded-md border border-gray-200 p-4 hover:border-orange-300 hover:bg-orange-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  {formatCash(post.cashDeltaCents)}
                </span>
                {post.wantItemCount === 0 ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Cash sale
                  </span>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {post.offerItems.map((item) => (
                  <li key={item.id}>
                    {item.quantity}×{" "}
                    {item.ticketType === "general_admission"
                      ? "general admission"
                      : `Section ${item.sectionCode}${
                          item.tier ? ` (tier ${item.tier})` : ""
                        }`}
                    {item.rowLabel ? `, row ${item.rowLabel}` : ""}
                    {item.seatLabels && item.seatLabels.length > 0
                      ? `, seats ${item.seatLabels.join(", ")}${
                          item.seatsAdjacent ? " (together)" : ""
                        }`
                      : ""}
                  </li>
                ))}
              </ul>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
