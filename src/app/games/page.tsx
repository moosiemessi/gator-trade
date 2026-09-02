import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Games | Gator Trade",
};

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function GamesPage() {
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("games")
    .select("id, opponent, kickoff_at, venue, is_home")
    .order("kickoff_at", { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Games</h1>
      <p className="mb-6 text-sm text-gray-600">
        Pick a game to browse posts for it.
      </p>
      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
        {(games ?? []).map((game) => (
          <li key={game.id}>
            <Link
              href={`/games/${game.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {game.is_home ? "vs" : "at"} {game.opponent}
                </p>
                <p className="text-sm text-gray-600">
                  {formatKickoff(game.kickoff_at)}
                  {game.venue ? ` — ${game.venue}` : ""}
                </p>
              </div>
              <span className="text-sm text-orange-600">Browse →</span>
            </Link>
          </li>
        ))}
        {(games ?? []).length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-500">
            No games yet.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
