import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "./post-form";

export const metadata: Metadata = {
  title: "New post | Gator Trade",
};

export default async function NewPostPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already requires auth for every route but /login etc; user
  // is non-null here in practice. Narrowing satisfies TypeScript.
  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: games }, { data: sections }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("is_verified")
        .eq("id", user.id)
        .single(),
      supabase
        .from("games")
        .select("id, opponent, kickoff_at, is_home")
        .order("kickoff_at", { ascending: true }),
      supabase
        .from("sections")
        .select("code, tier, level")
        .order("code", { ascending: true }),
    ]);

  if (!profile?.is_verified) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900">
          Verification pending
        </h1>
        <p className="text-gray-600">
          Confirm your ufl.edu email before you can post a listing.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-orange-600 underline"
        >
          Back home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">New post</h1>
      <p className="mb-6 text-sm text-gray-600">
        Describe what you&apos;re holding and what you&apos;d take in
        return. The most common case is a same-game seat upgrade — pick a
        game, list your seats, and say what tier you&apos;d move up to.
      </p>
      <PostForm games={games ?? []} sections={sections ?? []} />
    </main>
  );
}
