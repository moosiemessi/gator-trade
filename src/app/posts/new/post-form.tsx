"use client";

import { useState, useTransition } from "react";
import { createPostSchema } from "@/lib/validation/posts";
import { createPost } from "./actions";

type Game = {
  id: string;
  opponent: string;
  kickoff_at: string;
  is_home: boolean;
};

type Section = {
  code: string;
  tier: number;
  level: string;
};

type OfferItemState = {
  gameId: string;
  ticketType: "assigned" | "general_admission";
  sectionCode: string;
  rowLabel: string;
  seatLabelsRaw: string;
  quantity: number;
};

type WantSlotState = {
  acceptableGameIds: string[];
  minTier: string;
  maxTier: string;
  quantity: number;
  requireTogether: boolean;
};

type CashDirection = "you_pay" | "they_pay" | "even";

function gameLabel(game: Game) {
  const date = new Date(game.kickoff_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${game.opponent} — ${date}`;
}

function sectionLabel(section: Section) {
  return `Section ${section.code} (tier ${section.tier}, ${section.level})`;
}

export function PostForm({
  games,
  sections,
}: {
  games: Game[];
  sections: Section[];
}) {
  const [defaultGameId, setDefaultGameId] = useState(games[0]?.id ?? "");
  const [offerItems, setOfferItems] = useState<OfferItemState[]>([
    {
      gameId: games[0]?.id ?? "",
      ticketType: "assigned",
      sectionCode: "",
      rowLabel: "",
      seatLabelsRaw: "",
      quantity: 1,
    },
  ]);
  const [wantSlots, setWantSlots] = useState<WantSlotState[]>([
    {
      acceptableGameIds: games[0] ? [games[0].id] : [],
      minTier: "",
      maxTier: "",
      quantity: 1,
      requireTogether: false,
    },
  ]);
  const [cashAmount, setCashAmount] = useState("");
  const [cashDirection, setCashDirection] = useState<CashDirection>("even");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateOfferItem(index: number, patch: Partial<OfferItemState>) {
    setOfferItems((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addOfferItem() {
    setOfferItems((items) => [
      ...items,
      {
        gameId: defaultGameId,
        ticketType: "assigned",
        sectionCode: "",
        rowLabel: "",
        seatLabelsRaw: "",
        quantity: 1,
      },
    ]);
  }

  function removeOfferItem(index: number) {
    setOfferItems((items) => items.filter((_, i) => i !== index));
  }

  function updateWantSlot(index: number, patch: Partial<WantSlotState>) {
    setWantSlots((slots) =>
      slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    );
  }

  function toggleWantSlotGame(index: number, gameId: string) {
    setWantSlots((slots) =>
      slots.map((slot, i) => {
        if (i !== index) return slot;
        const has = slot.acceptableGameIds.includes(gameId);
        return {
          ...slot,
          acceptableGameIds: has
            ? slot.acceptableGameIds.filter((id) => id !== gameId)
            : [...slot.acceptableGameIds, gameId],
        };
      }),
    );
  }

  function addWantSlot() {
    setWantSlots((slots) => [
      ...slots,
      {
        acceptableGameIds: defaultGameId ? [defaultGameId] : [],
        minTier: "",
        maxTier: "",
        quantity: 1,
        requireTogether: false,
      },
    ]);
  }

  function removeWantSlot(index: number) {
    setWantSlots((slots) => slots.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cents = Math.round((Number(cashAmount) || 0) * 100);
    const cashDeltaCents =
      cashDirection === "you_pay"
        ? -cents
        : cashDirection === "they_pay"
          ? cents
          : 0;

    const payload = {
      offerItems: offerItems.map((item) => ({
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
          item.ticketType === "general_admission" || !item.seatLabelsRaw.trim()
            ? null
            : item.seatLabelsRaw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
        quantity: item.quantity,
      })),
      wantSlots: wantSlots.map((slot) => ({
        acceptableGameIds: slot.acceptableGameIds,
        minTier: slot.minTier ? Number(slot.minTier) : null,
        maxTier: slot.maxTier ? Number(slot.maxTier) : null,
        quantity: slot.quantity,
        requireTogether: slot.requireTogether,
      })),
      cashDeltaCents,
      notes: notes.trim() || null,
    };

    const parsed = createPostSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    startTransition(async () => {
      const result = await createPost(parsed.data);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Game
        </label>
        <p className="mb-1 text-xs text-gray-500">
          Sets the default for the tickets and wants below — change any
          individual row afterward for a cross-game bundle.
        </p>
        <select
          value={defaultGameId}
          onChange={(e) => setDefaultGameId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {gameLabel(game)}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-700">
          What you&apos;re offering
        </legend>
        {offerItems.map((item, index) => (
          <div
            key={index}
            className="space-y-3 rounded-md border border-gray-200 p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Game
                </label>
                <select
                  value={item.gameId}
                  onChange={(e) =>
                    updateOfferItem(index, { gameId: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {gameLabel(game)}
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
                    updateOfferItem(index, {
                      ticketType: e.target.value as OfferItemState["ticketType"],
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="assigned">Assigned seat</option>
                  <option value="general_admission">General admission</option>
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
                      updateOfferItem(index, { sectionCode: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  >
                    <option value="">Select a section</option>
                    {sections.map((section) => (
                      <option key={section.code} value={section.code}>
                        {sectionLabel(section)}
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
                      updateOfferItem(index, { rowLabel: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Seats (optional, comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="12, 13"
                    value={item.seatLabelsRaw}
                    onChange={(e) =>
                      updateOfferItem(index, {
                        seatLabelsRaw: e.target.value,
                      })
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
                    updateOfferItem(index, {
                      quantity: Number(e.target.value),
                    })
                  }
                  className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                />
              </div>
              {offerItems.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeOfferItem(index)}
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
          onClick={addOfferItem}
          className="text-sm font-medium text-orange-600 underline"
        >
          + Add another ticket
        </button>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-700">
          What you&apos;ll take in return
        </legend>
        <p className="-mt-2 text-xs text-gray-500">
          Leave this empty for a cash-only sale. Add more than one to bundle
          across games — a slot is satisfied by any checked game.
        </p>
        {wantSlots.map((slot, index) => (
          <div
            key={index}
            className="space-y-3 rounded-md border border-gray-200 p-4"
          >
            <div>
              <span className="block text-xs font-medium text-gray-600">
                Acceptable games
              </span>
              <div className="mt-1 flex flex-wrap gap-3">
                {games.map((game) => (
                  <label
                    key={game.id}
                    className="flex items-center gap-1 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={slot.acceptableGameIds.includes(game.id)}
                      onChange={() => toggleWantSlotGame(index, game.id)}
                    />
                    {gameLabel(game)}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Min tier (optional)
                </label>
                <select
                  value={slot.minTier}
                  onChange={(e) =>
                    updateWantSlot(index, { minTier: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">Any</option>
                  {[1, 2, 3, 4, 5].map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Max tier (optional)
                </label>
                <select
                  value={slot.maxTier}
                  onChange={(e) =>
                    updateWantSlot(index, { maxTier: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">Any</option>
                  {[1, 2, 3, 4, 5].map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={slot.quantity}
                  onChange={(e) =>
                    updateWantSlot(index, {
                      quantity: Number(e.target.value),
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={slot.requireTogether}
                  onChange={(e) =>
                    updateWantSlot(index, {
                      requireTogether: e.target.checked,
                    })
                  }
                />
                Seats must be together
              </label>
              {wantSlots.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeWantSlot(index)}
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
          onClick={addWantSlot}
          className="text-sm font-medium text-orange-600 underline"
        >
          + Add another want
        </button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700">Cash</legend>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          />
          <select
            value={cashDirection}
            onChange={(e) =>
              setCashDirection(e.target.value as CashDirection)
            }
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="even">Even swap, no cash</option>
            <option value="you_pay">I pay extra to move up</option>
            <option value="they_pay">They pay me to take this</option>
          </select>
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
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
        className="w-full rounded-md bg-orange-600 px-4 py-2 font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
