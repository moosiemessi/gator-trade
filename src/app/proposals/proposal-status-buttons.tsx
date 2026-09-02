"use client";

import { useState, useTransition } from "react";
import { acceptProposal, declineProposal, withdrawProposal } from "./actions";

export function ProposalStatusButtons({
  proposalId,
  role,
}: {
  proposalId: string;
  role: "author" | "proposer";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(proposalId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-2">
      <div className="flex gap-3">
        {role === "author" ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(acceptProposal)}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(declineProposal)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Decline
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(withdrawProposal)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Withdraw
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
