"use client";

import { useState, useTransition } from "react";
import { createProposalSchema } from "@/lib/validation/proposals";
import { createProposal } from "@/app/proposals/actions";

type Game = { id: string; opponent: string };
type Section = { code: string; tier: number; level: string };

type ItemState = {
  gameId: string;
  ticketType: "assigned" | "general_admission";
  sectionCode: string;
  rowLabel: string;
  seatLabelsRaw: string;
  quantity: number;
};

export function ProposeForm({
  postId,
  defaultCashDeltaCents,
  games,
  sections,
}: {
  postId: string;
  defaultCashDeltaCents: number;
  games: Game[];
  sections: Section[];
}) {
  const [includeItems, setIncludeItems] = useState(false);
  const [items, setItems] = useState<ItemState[]>([
    {
      gameId: games[0]?.id ?? "",
      ticketType: "assigned",
      sectionCode: "",
      rowLabel: "",
      seatLabelsRaw: "",
      quantity: 1,
    },
  ]);
  const [cashAmount, setCashAmount] = useState(
    (Math.abs(defaultCashDeltaCents) / 100).toString(),
  );
  const [cashDirection, setCashDirection] = useState<
    "you_pay" | "they_pay" | "even"
  >(
    defaultCashDeltaCents > 0
      ? "you_pay"
      : defaultCashDeltaCents < 0
        ? "they_pay"
        : "even",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateItem(index: number, patch: Partial<ItemState>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        gameId: games[0]?.id ?? "",
        ticketType: "assigned",
        sectionCode: "",
        rowLabel: "",
        seatLabelsRaw: "",
        quantity: 1,
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // "they" here means the author, from whose perspective cash_delta_cents
    // is always stored — cashDirection is phrased from the proposer's own
    // point of view for a friendlier form.
    const cents = Math.round((Number(cashAmount) || 0) * 100);
    const cashDeltaCents =
      cashDirection === "you_pay"
        ? cents
        : cashDirection === "they_pay"
          ? -cents
          : 0;

    const payload = {
      postId,
      cashDeltaCents,
      message: message.trim() || null,
      items: includeItems
        ? items.map((item) => ({
            gameId: item.gameId,
            ticketType: item.ticketType,
            sectionCode:
              item.ticketType === "general_admission"
                ? null
                : item.sectionCode || null,
            rowLabel:
              item.ticketType === "general_admission"
                ? null
                : item.rowLabel.trim() || null,
            seatLabels:
              item.ticketType === "general_admission" ||
              !item.seatLabelsRaw.trim()
                ? null
                : item.seatLabelsRaw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
            quantity: item.quantity,
          }))
        : [],
    };

    const parsed = createProposalSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    startTransition(async () => {
      const result = await createProposal(parsed.data);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Proposal sent. You can withdraw it any time before the author
        responds.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border border-gray-200 p-4"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">Cash:</span>
        <span className="text-sm text-gray-700">$</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={cashAmount}
          onChange={(e) => setCashAmount(e.target.value)}
          className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
        />
        <select
          value={cashDirection}
          onChange={(e) =>
            setCashDirection(
              e.target.value as "you_pay" | "they_pay" | "even",
            )
          }
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
        >
          <option value="even">Even swap, no cash</option>
          <option value="you_pay">I pay extra</option>
          <option value="they_pay">They pay me</option>
        </select>
      </div>

      <label className="flex items-center gap-1 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={includeItems}
          onChange={(e) => setIncludeItems(e.target.checked)}
        />
        I&apos;m offering tickets in return (leave unchecked for a pure cash
        offer)
      </label>

      {includeItems ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="space-y-3 rounded-md border border-gray-200 p-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Game
                  </label>
                  <select
                    value={item.gameId}
                    onChange={(e) =>
                      updateItem(index, { gameId: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  >
                    {games.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.opponent}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Ticket type
                  </label>
                  <select
                    value={item.ticketType}
                    onChange={(e) =>
                      updateItem(index, {
                        ticketType: e.target.value as ItemState["ticketType"],
                      })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  >
                    <option value="assigned">Assigned seat</option>
                    <option value="general_admission">
                      General admission
                    </option>
                  </select>
                </div>
              </div>

              {item.ticketType === "assigned" ? (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Section
                    </label>
                    <select
                      value={item.sectionCode}
                      onChange={(e) =>
                        updateItem(index, { sectionCode: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    >
                      <option value="">Select a section</option>
                      {sections.map((section) => (
                        <option key={section.code} value={section.code}>
                          Section {section.code} (tier {section.tier})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Row (optional)
                    </label>
                    <input
                      type="text"
                      value={item.rowLabel}
                      onChange={(e) =>
                        updateItem(index, { rowLabel: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Seats (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="12, 13"
                      value={item.seatLabelsRaw}
                      onChange={(e) =>
                        updateItem(index, { seatLabelsRaw: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-end justify-between">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: Number(e.target.value) })
                    }
                    className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  />
                </div>
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-sm text-red-600 underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-sm font-medium text-orange-600 underline"
          >
            + Add another ticket
          </button>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Message (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send proposal"}
      </button>
    </form>
  );
}
