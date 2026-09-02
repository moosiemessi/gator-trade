// Dev-only sample data: a dozen realistic posts across a handful of games
// and sections, using throwaway test accounts. NOT part of the production
// seed (supabase/seed.sql / `supabase db push --include-seed`) — this is a
// standalone script you run yourself with `npm run seed:dev`.
//
// There is no separate local Supabase instance in this environment (no
// Docker), so this talks to whichever project .env.local points at — the
// same live database real users are in. The DEV_SEED_EMAIL_PREFIX below is
// the only thing separating this script's data from real data, so don't
// change it casually, and prefer `npm run seed:dev:wipe` over touching
// anything by hand.
//
// Every account uses the same password so you can log in as any of them
// through the actual UI to test flows (e.g. proposals between two of them).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

process.loadEnvFile(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in .env.local first.",
  );
}

const DEV_SEED_EMAIL_PREFIX = "dev-seed-";
const DEV_SEED_PASSWORD = "DevSeed123!";

const admin = createClient<Database>(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_STUDENTS = [
  { slug: "jake-thompson", displayName: "Jake Thompson" },
  { slug: "maria-gonzalez", displayName: "Maria Gonzalez" },
  { slug: "derek-williams", displayName: "Derek Williams" },
  { slug: "sarah-chen", displayName: "Sarah Chen" },
  { slug: "tyler-brooks", displayName: "Tyler Brooks" },
  { slug: "ashley-patel", displayName: "Ashley Patel" },
] as const;

type StudentSlug = (typeof TEST_STUDENTS)[number]["slug"];

function emailFor(slug: string) {
  return `${DEV_SEED_EMAIL_PREFIX}${slug}@ufl.edu`;
}

async function wipe() {
  const { data: users, error } = await admin.auth.admin.listUsers({
    perPage: 200,
  });
  if (error) throw error;

  const devUsers = users.users.filter((u) =>
    u.email?.startsWith(DEV_SEED_EMAIL_PREFIX),
  );

  for (const u of devUsers) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(u.id);
    if (deleteError) throw deleteError;
    console.log(`  deleted ${u.email}`);
  }

  console.log(
    `Wiped ${devUsers.length} dev-seed account(s) (their posts cascade-deleted with them).`,
  );
}

async function createStudent(slug: string, displayName: string) {
  const email = emailFor(slug);
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: DEV_SEED_PASSWORD,
      email_confirm: false,
      user_metadata: { display_name: displayName },
    });
  if (createError || !created.user) {
    throw createError ?? new Error("createUser returned no user");
  }

  // Confirm as a separate update, not email_confirm: true up front, so the
  // real AFTER UPDATE trigger sets profiles.is_verified the same way it
  // would for an actual confirmation-link click.
  const { error: confirmError } = await admin.auth.admin.updateUserById(
    created.user.id,
    { email_confirm: true },
  );
  if (confirmError) throw confirmError;

  const client = createClient<Database>(SUPABASE_URL!, PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: DEV_SEED_PASSWORD,
  });
  if (signInError) throw signInError;

  return { id: created.user.id, email, client };
}

type OfferItemPlan = {
  gameOpponent: string;
  ticketType: "assigned" | "general_admission";
  sectionCode: string | null;
  rowLabel: string | null;
  seatLabels: string[] | null;
  quantity: number;
};

type WantSlotPlan = {
  gameOpponents: string[];
  minTier: number | null;
  maxTier: number | null;
  quantity: number;
  requireTogether: boolean;
};

type PostPlan = {
  authorSlug: StudentSlug;
  cashDeltaCents: number;
  notes: string | null;
  offerItems: OfferItemPlan[];
  wantSlots: WantSlotPlan[];
  withdraw?: boolean;
};

const POST_PLANS: PostPlan[] = [
  // Classic upgrade: worse seat + cash for a better one, same game.
  {
    authorSlug: "jake-thompson",
    cashDeltaCents: -8000,
    notes: "Just want to sit closer, section 33 is a long walk",
    offerItems: [
      {
        gameOpponent: "Florida Atlantic",
        ticketType: "assigned",
        sectionCode: "33",
        rowLabel: "10",
        seatLabels: null,
        quantity: 1,
      },
    ],
    wantSlots: [
      {
        gameOpponents: ["Florida Atlantic"],
        minTier: 1,
        maxTier: 2,
        quantity: 1,
        requireTogether: false,
      },
    ],
  },
  // Good seat, take cash to move back.
  {
    authorSlug: "maria-gonzalez",
    cashDeltaCents: 8000,
    notes: null,
    offerItems: [
      {
        gameOpponent: "Florida Atlantic",
        ticketType: "assigned",
        sectionCode: "38",
        rowLabel: "4",
        seatLabels: ["7", "8"],
        quantity: 2,
      },
    ],
    wantSlots: [
      {
        gameOpponents: ["Florida Atlantic"],
        minTier: null,
        maxTier: null,
        quantity: 2,
        requireTogether: false,
      },
    ],
  },
  // Straight sale, assigned seats.
  {
    authorSlug: "derek-williams",
    cashDeltaCents: 12000,
    notes: "Can't make the game anymore, selling as-is",
    offerItems: [
      {
        gameOpponent: "Campbell",
        ticketType: "assigned",
        sectionCode: "30",
        rowLabel: null,
        seatLabels: null,
        quantity: 2,
      },
    ],
    wantSlots: [],
  },
  // Straight sale, general admission.
  {
    authorSlug: "sarah-chen",
    cashDeltaCents: 6000,
    notes: null,
    offerItems: [
      {
        gameOpponent: "Campbell",
        ticketType: "general_admission",
        sectionCode: null,
        rowLabel: null,
        seatLabels: null,
        quantity: 4,
      },
    ],
    wantSlots: [],
  },
  // Cross-game bundle: one want slot accepts either of two games.
  {
    authorSlug: "tyler-brooks",
    cashDeltaCents: -5000,
    notes: "Flexible on which of these two games works for you",
    offerItems: [
      {
        gameOpponent: "Ole Miss",
        ticketType: "assigned",
        sectionCode: "32",
        rowLabel: "6",
        seatLabels: ["1", "2"],
        quantity: 2,
      },
    ],
    wantSlots: [
      {
        gameOpponents: ["Ole Miss", "South Carolina"],
        minTier: 1,
        maxTier: 2,
        quantity: 1,
        requireTogether: false,
      },
    ],
  },
  // Even swap, no cash.
  {
    authorSlug: "ashley-patel",
    cashDeltaCents: 0,
    notes: null,
    offerItems: [
      {
        gameOpponent: "South Carolina",
        ticketType: "assigned",
        sectionCode: "37",
        rowLabel: null,
        seatLabels: null,
        quantity: 1,
      },
    ],
    wantSlots: [
      {
        gameOpponents: ["South Carolina"],
        minTier: 2,
        maxTier: 3,
        quantity: 1,
        requireTogether: false,
      },
    ],
  },
  // Multi-item bundle within one post, same game.
  {
    authorSlug: "jake-thompson",
    cashDeltaCents: 15000,
    notes: "Selling two separate pairs, will split",
    offerItems: [
      {
        gameOpponent: "Oklahoma",
        ticketType: "assigned",
        sectionCode: "40",
        rowLabel: "3",
        seatLabels: null,
        quantity: 2,
      },
      {
        gameOpponent: "Oklahoma",
        ticketType: "assigned",
        sectionCode: "39",
        rowLabel: "8",
        seatLabels: null,
        quantity: 2,
      },
    ],
    wantSlots: [],
  },
  // Downgrade for cash, with a want side attached.
  {
    authorSlug: "maria-gonzalez",
    cashDeltaCents: -3000,
    notes: null,
    offerItems: [
      {
        gameOpponent: "Vanderbilt",
        ticketType: "assigned",
        sectionCode: "27",
        rowLabel: null,
        seatLabels: null,
        quantity: 1,
      },
    ],
    wantSlots: [
      {
        gameOpponents: ["Vanderbilt"],
        minTier: 1,
        maxTier: 3,
        quantity: 1,
        requireTogether: false,
      },
    ],
  },
  // Premium straight sale, adjacent seats.
  {
    authorSlug: "derek-williams",
    cashDeltaCents: 20000,
    notes: "Best seats I'm offering all season, together",
    offerItems: [
      {
        gameOpponent: "Ole Miss",
        ticketType: "assigned",
        sectionCode: "36",
        rowLabel: "2",
        seatLabels: ["5", "6"],
        quantity: 2,
      },
    ],
    wantSlots: [],
  },
  // Upgrade wanted, seats not adjacent, require_together on the want side.
  {
    authorSlug: "sarah-chen",
    cashDeltaCents: -6000,
    notes: null,
    offerItems: [
      {
        gameOpponent: "South Carolina",
        ticketType: "assigned",
        sectionCode: "41",
        rowLabel: "14",
        seatLabels: ["2", "5", "9"],
        quantity: 3,
      },
    ],
    wantSlots: [
      {
        gameOpponents: ["South Carolina"],
        minTier: 1,
        maxTier: 2,
        quantity: 3,
        requireTogether: true,
      },
    ],
  },
  // Want side targets different games than the offer side.
  {
    authorSlug: "tyler-brooks",
    cashDeltaCents: 4000,
    notes: null,
    offerItems: [
      {
        gameOpponent: "Vanderbilt",
        ticketType: "assigned",
        sectionCode: "42",
        rowLabel: null,
        seatLabels: null,
        quantity: 1,
      },
    ],
    wantSlots: [
      {
        gameOpponents: ["Florida Atlantic", "Campbell"],
        minTier: null,
        maxTier: null,
        quantity: 1,
        requireTogether: false,
      },
    ],
  },
  // Small GA sale, withdrawn afterward to exercise the my-posts view.
  {
    authorSlug: "ashley-patel",
    cashDeltaCents: 2500,
    notes: "Grabbed an extra by mistake",
    offerItems: [
      {
        gameOpponent: "Oklahoma",
        ticketType: "general_admission",
        sectionCode: null,
        rowLabel: null,
        seatLabels: null,
        quantity: 1,
      },
    ],
    wantSlots: [],
    withdraw: true,
  },
];

async function seed() {
  console.log(`Seeding against ${SUPABASE_URL}\n`);

  const { data: games, error: gamesError } = await admin
    .from("games")
    .select("id, opponent");
  if (gamesError) throw gamesError;
  const gameIdByOpponent = new Map(games.map((g) => [g.opponent, g.id]));

  const students = new Map<
    StudentSlug,
    { id: string; email: string; client: SupabaseClient<Database> }
  >();
  for (const student of TEST_STUDENTS) {
    const created = await createStudent(student.slug, student.displayName);
    students.set(student.slug, created);
    console.log(`  created ${student.displayName} <${created.email}>`);
  }

  console.log();
  let createdCount = 0;
  for (const plan of POST_PLANS) {
    const author = students.get(plan.authorSlug);
    if (!author) throw new Error(`unknown author slug ${plan.authorSlug}`);

    const offerItems = plan.offerItems.map((item) => {
      const gameId = gameIdByOpponent.get(item.gameOpponent);
      if (!gameId) throw new Error(`unknown game ${item.gameOpponent}`);
      return {
        game_id: gameId,
        ticket_type: item.ticketType,
        section_code: item.sectionCode,
        row_label: item.rowLabel,
        seat_labels: item.seatLabels,
        quantity: item.quantity,
      };
    });

    const wantSlots = plan.wantSlots.map((slot) => ({
      acceptable_game_ids: slot.gameOpponents.map((opponent) => {
        const gameId = gameIdByOpponent.get(opponent);
        if (!gameId) throw new Error(`unknown game ${opponent}`);
        return gameId;
      }),
      min_tier: slot.minTier,
      max_tier: slot.maxTier,
      quantity: slot.quantity,
      require_together: slot.requireTogether,
    }));

    const { data: postId, error } = await author.client.rpc("create_post", {
      p_cash_delta_cents: plan.cashDeltaCents,
      p_notes: plan.notes ?? undefined,
      p_offer_items: offerItems,
      p_want_slots: wantSlots,
    });
    if (error || !postId) {
      throw error ?? new Error("create_post returned no id");
    }

    if (plan.withdraw) {
      const { error: withdrawError } = await admin
        .from("posts")
        .update({ status: "withdrawn" })
        .eq("id", postId);
      if (withdrawError) throw withdrawError;
    }

    createdCount += 1;
    console.log(
      `  post ${createdCount}/${POST_PLANS.length}: ${plan.authorSlug} — $${(
        Math.abs(plan.cashDeltaCents) / 100
      ).toFixed(0)} ${plan.cashDeltaCents === 0 ? "even" : plan.cashDeltaCents > 0 ? "(they pay)" : "(author pays)"}${plan.withdraw ? " [withdrawn]" : ""}`,
    );
  }

  console.log(
    `\nDone: ${students.size} test accounts, ${createdCount} posts.`,
  );
  console.log(`Every account's password is: ${DEV_SEED_PASSWORD}`);
  console.log(`Run "npm run seed:dev:wipe" to remove all of it.`);
}

async function main() {
  const mode = process.argv[2];

  if (mode === "--wipe") {
    await wipe();
  } else {
    console.log("Clearing any previous dev-seed run first...");
    await wipe();
    console.log();
    await seed();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
