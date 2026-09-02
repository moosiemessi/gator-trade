import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's default (non-custom-SMTP) confirmation email links to its own
// hosted /auth/v1/verify endpoint rather than straight to this route. That
// endpoint verifies the signup token itself, then redirects here with a
// PKCE `code` param (our @supabase/ssr clients default to flowType: pkce),
// which we exchange for a session.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmation-failed", request.url),
  );
}
