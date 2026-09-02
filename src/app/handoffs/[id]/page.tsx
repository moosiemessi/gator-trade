import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarkButton } from "./mark-button";
import { MessageForm } from "./message-form";

export const metadata: Metadata = {
  title: "Handoff | Gator Trade",
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

function ChecklistRow({
  label,
  done,
  action,
}: {
  label: string;
  done: boolean;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between rounded-md border border-gray-200 p-3">
      <span className="text-sm text-gray-700">
        {done ? "✓ " : ""}
        {label}
      </span>
      {done ? (
        <span className="text-sm text-green-700">Done</span>
      ) : (
        action
      )}
    </li>
  );
}

export default async function HandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: handoffId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: handoff } = await supabase
    .from("handoffs")
    .select(
      `
      id, proposal_id, author_marked_sent_at, proposer_marked_sent_at,
      author_confirmed_at, proposer_confirmed_at, cash_settled_at, created_at,
      proposals (
        id, cash_delta_cents, proposer_id, status,
        profiles_public ( display_name ),
        posts ( id, author_id, profiles_public ( display_name ) )
      )
      `,
    )
    .eq("id", handoffId)
    .single();

  if (!handoff || !handoff.proposals || !handoff.proposals.posts) {
    notFound();
  }

  const proposal = handoff.proposals;
  const post = proposal.posts!;
  const isAuthor = post.author_id === user.id;
  const isProposer = proposal.proposer_id === user.id;

  if (!isAuthor && !isProposer) {
    notFound();
  }

  const otherPartyName = isAuthor
    ? (proposal.profiles_public?.display_name ?? "the proposer")
    : (post.profiles_public?.display_name ?? "the author");

  const mySentAt = isAuthor
    ? handoff.author_marked_sent_at
    : handoff.proposer_marked_sent_at;
  const theirSentAt = isAuthor
    ? handoff.proposer_marked_sent_at
    : handoff.author_marked_sent_at;
  const myConfirmedAt = isAuthor
    ? handoff.author_confirmed_at
    : handoff.proposer_confirmed_at;
  const theirConfirmedAt = isAuthor
    ? handoff.proposer_confirmed_at
    : handoff.author_confirmed_at;

  const mySentColumn = isAuthor ? "author_marked_sent_at" : "proposer_marked_sent_at";
  const myConfirmedColumn = isAuthor
    ? "author_confirmed_at"
    : "proposer_confirmed_at";

  const cashApplies = proposal.cash_delta_cents !== 0;
  const isComplete =
    Boolean(handoff.author_marked_sent_at) &&
    Boolean(handoff.proposer_marked_sent_at) &&
    Boolean(handoff.author_confirmed_at) &&
    Boolean(handoff.proposer_confirmed_at) &&
    (!cashApplies || Boolean(handoff.cash_settled_at));

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("proposal_id", handoff.proposal_id)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900">
        Handoff with {otherPartyName}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {formatCash(proposal.cash_delta_cents)}
      </p>
      {isComplete ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Handoff complete.
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700">Checklist</h2>
        <p className="mb-2 text-xs text-gray-500">
          This coordinates the handoff — it doesn&apos;t transfer tickets or
          money itself.
        </p>
        <ul className="mt-2 space-y-2">
          <ChecklistRow
            label="You sent your tickets"
            done={Boolean(mySentAt)}
            action={
              <MarkButton
                handoffId={handoff.id}
                column={mySentColumn}
                label="Mark sent"
              />
            }
          />
          <ChecklistRow
            label={`${otherPartyName} sent their tickets`}
            done={Boolean(theirSentAt)}
            action={<span className="text-sm text-gray-400">Waiting</span>}
          />
          <ChecklistRow
            label="You received their tickets"
            done={Boolean(myConfirmedAt)}
            action={
              <MarkButton
                handoffId={handoff.id}
                column={myConfirmedColumn}
                label="Confirm received"
              />
            }
          />
          <ChecklistRow
            label={`${otherPartyName} received your tickets`}
            done={Boolean(theirConfirmedAt)}
            action={<span className="text-sm text-gray-400">Waiting</span>}
          />
          {cashApplies ? (
            <ChecklistRow
              label="Cash settled"
              done={Boolean(handoff.cash_settled_at)}
              action={
                <MarkButton
                  handoffId={handoff.id}
                  column="cash_settled_at"
                  label="Mark settled"
                />
              }
            />
          ) : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700">Messages</h2>
        <ul className="mt-2 space-y-2">
          {(messages ?? []).map((message) => (
            <li
              key={message.id}
              className="rounded-md border border-gray-200 p-3 text-sm"
            >
              <p className="font-medium text-gray-900">
                {message.sender_id === user.id ? "You" : otherPartyName}
              </p>
              <p className="text-gray-700">{message.body}</p>
            </li>
          ))}
          {(messages ?? []).length === 0 ? (
            <li className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No messages yet.
            </li>
          ) : null}
        </ul>
        <MessageForm handoffId={handoff.id} proposalId={handoff.proposal_id} />
      </section>
    </main>
  );
}
