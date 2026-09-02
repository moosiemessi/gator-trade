"use client";

import { useState, useTransition } from "react";
import { sendMessageSchema } from "@/lib/validation/messages";
import { sendMessage } from "./actions";

export function MessageForm({
  handoffId,
  proposalId,
}: {
  handoffId: string;
  proposalId: string;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = sendMessageSchema.safeParse({ proposalId, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    startTransition(async () => {
      const result = await sendMessage(handoffId, parsed.data);
      if (result.error) {
        setError(result.error);
      } else {
        setBody("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Message the other side about the handoff…"
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending || body.trim().length === 0}
        className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
