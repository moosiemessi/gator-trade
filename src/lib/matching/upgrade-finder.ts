import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type CashDirectionFilter = "any" | "you_pay" | "they_pay" | "even";

export type BrowseFilters = {
  // The section the browsing user holds. Posts must offer something
  // strictly better (lower tier number) than this — SPEC.md section 7.
  myTier: number | null;
  minTier: number | null;
  maxTier: number | null;
  minQuantity: number | null;
  seatsTogether: boolean;
  cashDirection: CashDirectionFilter;
  // Straight-sale view: posts with no want slots at all.
  cashOnly: boolean;
};

export type OfferItemResult = {
  id: string;
  ticketType: Database["public"]["Enums"]["ticket_type"];
  sectionCode: string | null;
  tier: number | null;
  level: string | null;
  rowLabel: string | null;
  seatLabels: string[] | null;
  quantity: number;
  seatsAdjacent: boolean;
};

export type PostResult = {
  id: string;
  authorId: string;
  cashDeltaCents: number;
  notes: string | null;
  offerItems: OfferItemResult[];
  wantItemCount: number;
  thumbnailKey: string | null;
};

// Derives adjacency from seat_labels rather than trusting a client
// assertion (SPEC.md section 5). Seats are "together" if, sorted
// numerically, they form one run with no gaps.
function areSeatsAdjacent(seatLabels: string[] | null): boolean {
  if (!seatLabels || seatLabels.length < 2) return true;
  const numbers = seatLabels.map((label) => Number(label));
  if (numbers.some((n) => !Number.isFinite(n))) return false;
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
}

type RawOfferItem = {
  id: string;
  ticket_type: Database["public"]["Enums"]["ticket_type"];
  section_code: string | null;
  row_label: string | null;
  seat_labels: string[] | null;
  quantity: number;
  game_id: string;
  sections: { tier: number; level: string } | null;
};

function toOfferItemResult(item: RawOfferItem): OfferItemResult {
  return {
    id: item.id,
    ticketType: item.ticket_type,
    sectionCode: item.section_code,
    tier: item.sections?.tier ?? null,
    level: item.sections?.level ?? null,
    rowLabel: item.row_label,
    seatLabels: item.seat_labels,
    quantity: item.quantity,
    seatsAdjacent: areSeatsAdjacent(item.seat_labels),
  };
}

function applyCommonFilters<
  Q extends {
    gt: (col: string, val: number) => Q;
    lt: (col: string, val: number) => Q;
    eq: (col: string, val: number | string) => Q;
    gte: (col: string, val: number) => Q;
    lte: (col: string, val: number) => Q;
  },
>(query: Q, filters: BrowseFilters): Q {
  let q = query;
  if (filters.minTier !== null) {
    q = q.gte("post_offer_items.sections.tier", filters.minTier);
  }
  if (filters.maxTier !== null) {
    q = q.lte("post_offer_items.sections.tier", filters.maxTier);
  }
  if (filters.minQuantity !== null) {
    q = q.gte("post_offer_items.quantity", filters.minQuantity);
  }
  if (filters.cashDirection === "you_pay") {
    q = q.gt("cash_delta_cents", 0);
  } else if (filters.cashDirection === "they_pay") {
    q = q.lt("cash_delta_cents", 0);
  } else if (filters.cashDirection === "even") {
    q = q.eq("cash_delta_cents", 0);
  }
  return q;
}

// PostgREST silently ignores a filter on a nested relation's column unless
// that relation is embedded with !inner — confirmed live, not assumed.
// sections!inner also (correctly) drops general-admission offer items,
// since they have no section to satisfy a tier comparison against, so this
// branch is only used when a tier filter is actually in play.
async function queryWithTierFilter(
  supabase: SupabaseClient<Database>,
  gameId: string,
  filters: BrowseFilters,
) {
  let query = supabase
    .from("posts")
    .select(
      `
      id, author_id, cash_delta_cents, notes,
      post_offer_items!inner (
        id, ticket_type, section_code, row_label, seat_labels, quantity, game_id,
        sections!inner ( tier, level )
      ),
      post_want_items ( id ),
      post_images ( s3_key, created_at )
      `,
    )
    .eq("status", "open")
    .eq("post_offer_items.game_id", gameId)
    .order("created_at", { referencedTable: "post_images", ascending: true });

  if (filters.myTier !== null) {
    query = query.lt("post_offer_items.sections.tier", filters.myTier);
  }
  query = applyCommonFilters(query, filters);

  return query.order("cash_delta_cents", { ascending: true });
}

// Tier-agnostic branch: keeps general-admission offer items in the
// results, which sections!inner above would otherwise drop.
async function queryWithoutTierFilter(
  supabase: SupabaseClient<Database>,
  gameId: string,
  filters: BrowseFilters,
) {
  const query = supabase
    .from("posts")
    .select(
      `
      id, author_id, cash_delta_cents, notes,
      post_offer_items!inner (
        id, ticket_type, section_code, row_label, seat_labels, quantity, game_id,
        sections ( tier, level )
      ),
      post_want_items ( id ),
      post_images ( s3_key, created_at )
      `,
    )
    .eq("status", "open")
    .eq("post_offer_items.game_id", gameId)
    .order("created_at", { referencedTable: "post_images", ascending: true });

  return applyCommonFilters(query, filters).order("cash_delta_cents", {
    ascending: true,
  });
}

export async function findGamePosts(
  supabase: SupabaseClient<Database>,
  gameId: string,
  filters: BrowseFilters,
  excludeAuthorId: string | null,
): Promise<PostResult[]> {
  const needsTierFilter =
    filters.myTier !== null ||
    filters.minTier !== null ||
    filters.maxTier !== null;

  const { data, error } = needsTierFilter
    ? await queryWithTierFilter(supabase, gameId, filters)
    : await queryWithoutTierFilter(supabase, gameId, filters);

  if (error) throw error;

  let results: PostResult[] = (data ?? [])
    .filter((post) => post.author_id !== excludeAuthorId)
    .map((post) => ({
      id: post.id,
      authorId: post.author_id,
      cashDeltaCents: post.cash_delta_cents,
      notes: post.notes,
      offerItems: post.post_offer_items
        .filter((item) => item.game_id === gameId)
        .map(toOfferItemResult),
      wantItemCount: post.post_want_items.length,
      thumbnailKey: post.post_images[0]?.s3_key ?? null,
    }));

  if (filters.cashOnly) {
    results = results.filter((post) => post.wantItemCount === 0);
  }
  if (filters.seatsTogether) {
    results = results.filter((post) =>
      post.offerItems.some((item) => item.seatsAdjacent),
    );
  }

  return results;
}
