import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My posts | Gator Trade",
};

function formatCash(cents: number) {
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
  if (cents > 0) return `Buyer pays ${formatted}`;
  if (cents < 0) return `You pay ${formatted}`;
  return "Even swap";
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  withdrawn: "bg-gray-100 text-gray-600",
  expired: "bg-gray-100 text-gray-600",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: posts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, ufl_email, is_verified")
      .eq("id", user.id)
      .single(),
    supabase
      .from("posts")
      .select(
        "id, status, cash_delta_cents, created_at, post_offer_items ( id, games ( opponent ) )",
      )
      .eq("author_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        {profile?.display_name ?? "My profile"}
      </h1>
      <p className="mb-8 text-sm text-gray-600">{profile?.ufl_email}</p>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">My posts</h2>
        <Link
          href="/posts/new"
          className="text-sm font-medium text-orange-600 underline"
        >
          + New post
        </Link>
      </div>

      <ul className="mt-4 space-y-3">
        {(posts ?? []).map((post) => {
          const opponents = Array.from(
            new Set(
              post.post_offer_items
                .map((item) => item.games?.opponent)
                .filter((o): o is string => Boolean(o)),
            ),
          );
          return (
            <li key={post.id}>
              <Link
                href={`/posts/${post.id}`}
                className="block rounded-md border border-gray-200 p-4 hover:border-orange-300 hover:bg-orange-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {opponents.join(", ") || "Post"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[post.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {formatCash(post.cash_delta_cents)}
                </p>
              </Link>
            </li>
          );
        })}
        {(posts ?? []).length === 0 ? (
          <li className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
            No posts yet.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
