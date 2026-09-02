import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProposalStatusButtons } from "./proposal-status-buttons";

export const metadata: Metadata = {
  title: "Proposals | Gator Trade",
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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-gray-100 text-gray-600",
  withdrawn: "bg-gray-100 text-gray-600",
};

export default async function ProposalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, post_id, cash_delta_cents, status, created_at, posts ( id, author_id, profiles_public ( display_name ) ), handoffs ( id )",
      )
      .eq("proposer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("proposals")
      .select(
        "id, post_id, cash_delta_cents, status, created_at, profiles_public ( display_name ), posts!inner ( id, author_id ), handoffs ( id )",
      )
      .eq("posts.author_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">
        Proposals
      </h1>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">Received</h2>
        <p className="mb-3 text-sm text-gray-600">
          Proposals other students sent on your posts.
        </p>
        <ul className="space-y-3">
          {(received ?? []).map((proposal) => (
            <li
              key={proposal.id}
              className="rounded-md border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/posts/${proposal.post_id}`}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {proposal.profiles_public?.display_name ??
                    "a Gator Trade user"}
                </Link>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[proposal.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {proposal.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {formatCash(proposal.cash_delta_cents)}
              </p>
              {proposal.status === "pending" ? (
                <ProposalStatusButtons proposalId={proposal.id} role="author" />
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
          {(received ?? []).length === 0 ? (
            <li className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No proposals received yet.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Sent</h2>
        <p className="mb-3 text-sm text-gray-600">
          Proposals you&apos;ve sent on other students&apos; posts.
        </p>
        <ul className="space-y-3">
          {(sent ?? []).map((proposal) => (
            <li
              key={proposal.id}
              className="rounded-md border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/posts/${proposal.post_id}`}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {proposal.posts?.profiles_public?.display_name ??
                    "a Gator Trade user"}
                </Link>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[proposal.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {proposal.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {formatCash(proposal.cash_delta_cents)}
              </p>
              {proposal.status === "pending" ? (
                <ProposalStatusButtons
                  proposalId={proposal.id}
                  role="proposer"
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
          {(sent ?? []).length === 0 ? (
            <li className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No proposals sent yet.
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
