"use client";

import { useState, useTransition } from "react";
import { markHandoffColumn } from "./actions";

export function MarkButton({
  handoffId,
  column,
  label,
}: {
  handoffId: string;
  column: string;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await markHandoffColumn(handoffId, column);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Marking…" : label}
      </button>
      {error ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
