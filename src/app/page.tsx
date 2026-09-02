import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated requests away from here;
  // this is a defensive fallback, not the primary guard.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, ufl_email, is_verified")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Gator Trade</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm font-medium text-gray-600 underline"
          >
            Log out
          </button>
        </form>
      </div>

      {profile && !profile.is_verified ? (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Verification pending. Confirm your ufl.edu email to unlock the
          marketplace.
        </div>
      ) : (
        <p className="mt-6 text-gray-600">
          Welcome back, {profile?.display_name ?? user.email}.
        </p>
      )}
    </main>
  );
}
