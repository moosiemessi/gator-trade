import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../src/types/database";

// Exercises the RLS policies from SPEC.md section 6 against the real,
// linked Supabase project. There is no local Postgres in this environment
// (no Docker), so this is the only way these policies get verified.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  throw new Error(
    "RLS tests need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, " +
      "and SUPABASE_SECRET_KEY in .env.local. The secret key bypasses RLS and is " +
      "only used here to create test users and seed the handoff fixture.",
  );
}

const admin = createClient<Database>(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = `Rls-Test-${randomUUID()}!`;

type TestUser = {
  id: string;
  client: SupabaseClient<Database>;
};

async function createVerifiedUser(label: string): Promise<TestUser> {
  const email = `rls-test-${label}-${randomUUID()}@ufl.edu`;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: false,
    });
  if (createError || !created.user) {
    throw createError ?? new Error("createUser returned no user");
  }

  // A separate confirm step, rather than email_confirm: true up front, so
  // the AFTER UPDATE trigger from step 2 (which sets profiles.is_verified)
  // fires the same way it does for a real confirmation-link click.
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
    password: TEST_PASSWORD,
  });
  if (signInError) throw signInError;

  return { id: created.user.id, client };
}

describe("RLS policies", () => {
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;

  let withdrawnPostId: string;
  let openPostId: string;
  let acceptedProposalId: string;
  let outsiderProposalId: string;
  let handoffId: string;

  beforeAll(async () => {
    [userA, userB, userC] = await Promise.all([
      createVerifiedUser("a"),
      createVerifiedUser("b"),
      createVerifiedUser("c"),
    ]);

    // A withdrawn post owned by A, for the "B can't read A's withdrawn
    // post" case.
    const { data: withdrawnPost, error: withdrawnPostError } =
      await userA.client
        .from("posts")
        .insert({ author_id: userA.id, cash_delta_cents: 0 })
        .select("id")
        .single();
    if (withdrawnPostError || !withdrawnPost) throw withdrawnPostError;
    withdrawnPostId = withdrawnPost.id;

    const { error: withdrawError } = await userA.client
      .from("posts")
      .update({ status: "withdrawn" })
      .eq("id", withdrawnPostId);
    if (withdrawError) throw withdrawError;

    // An open post owned by A, for the proposal/handoff cases.
    const { data: openPost, error: openPostError } = await userA.client
      .from("posts")
      .insert({ author_id: userA.id, cash_delta_cents: -8000 })
      .select("id")
      .single();
    if (openPostError || !openPost) throw openPostError;
    openPostId = openPost.id;

    // B proposes on A's open post — through the real insert policy, not
    // the admin client.
    const { data: acceptedProposal, error: proposalError } =
      await userB.client
        .from("proposals")
        .insert({
          post_id: openPostId,
          proposer_id: userB.id,
          cash_delta_cents: -8000,
        })
        .select("id")
        .single();
    if (proposalError || !acceptedProposal) throw proposalError;
    acceptedProposalId = acceptedProposal.id;

    // C proposes on the same post. B has no part in this one — used for
    // the "can't read a proposal on a post you're not party to" case. This
    // has to happen before A accepts B's proposal below: accepting moves
    // the post out of 'open' (step 8's trigger), and
    // proposals_insert_verified_non_author only allows new proposals on an
    // open post.
    const { data: outsiderProposal, error: outsiderError } =
      await userC.client
        .from("proposals")
        .insert({
          post_id: openPostId,
          proposer_id: userC.id,
          cash_delta_cents: -5000,
        })
        .select("id")
        .single();
    if (outsiderError || !outsiderProposal) throw outsiderError;
    outsiderProposalId = outsiderProposal.id;

    const { error: acceptError } = await userA.client
      .from("proposals")
      .update({ status: "accepted" })
      .eq("id", acceptedProposalId);
    if (acceptError) throw acceptError;

    // Step 8's accept trigger creates this row automatically, so it's read
    // back here (through the real select policy) rather than seeded.
    const { data: handoff, error: handoffError } = await userB.client
      .from("handoffs")
      .select("id")
      .eq("proposal_id", acceptedProposalId)
      .single();
    if (handoffError || !handoff) throw handoffError;
    handoffId = handoff.id;
  }, 30000);

  afterAll(async () => {
    await Promise.all(
      [userA, userB, userC]
        .filter((u): u is TestUser => Boolean(u))
        .map((u) => admin.auth.admin.deleteUser(u.id)),
    );
  });

  it("blocks reading another user's withdrawn post", async () => {
    const { data, error } = await userB.client
      .from("posts")
      .select("id")
      .eq("id", withdrawnPostId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("blocks inserting a proposal that impersonates another user", async () => {
    const { error } = await userB.client.from("proposals").insert({
      post_id: openPostId,
      proposer_id: userA.id,
      cash_delta_cents: 0,
    });

    expect(error).not.toBeNull();
  });

  it("blocks reading a proposal on a post you're not party to", async () => {
    const { data, error } = await userB.client
      .from("proposals")
      .select("id")
      .eq("id", outsiderProposalId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("blocks setting the other participant's handoff timestamp", async () => {
    const { error } = await userB.client
      .from("handoffs")
      .update({ author_confirmed_at: new Date().toISOString() })
      .eq("id", handoffId);

    expect(error).not.toBeNull();
  });

  it("allows setting your own handoff timestamp", async () => {
    const { error } = await userB.client
      .from("handoffs")
      .update({ proposer_confirmed_at: new Date().toISOString() })
      .eq("id", handoffId);

    expect(error).toBeNull();
  });

  it("blocks a user from verifying their own profile", async () => {
    const { error } = await userB.client
      .from("profiles")
      .update({ is_verified: true })
      .eq("id", userB.id);

    expect(error).not.toBeNull();
  });

  it("blocks another user from updating your post", async () => {
    const { data, error } = await userB.client
      .from("posts")
      .update({ notes: "hijacked" })
      .eq("id", openPostId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("blocks the author from updating a post that isn't open", async () => {
    // No user-facing action reaches 'completed' yet (step 9's handoff
    // completion is future work), so the admin client stands in for it —
    // the point here is posts_update_open_author's status = 'open' guard,
    // not how a post gets to 'completed'.
    const { data: completedPost, error: completedPostError } = await admin
      .from("posts")
      .insert({ author_id: userA.id, cash_delta_cents: 0, status: "completed" })
      .select("id")
      .single();
    if (completedPostError || !completedPost) throw completedPostError;

    const { data, error } = await userA.client
      .from("posts")
      .update({ notes: "still editable?" })
      .eq("id", completedPost.id)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
