import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Check your email | Gator Trade",
};

export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12 text-center">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">
        Check your inbox
      </h1>
      <p className="text-gray-600">
        We sent a confirmation link to your ufl.edu address. Click it to
        verify your account, then come back and log in.
      </p>
      <p className="mt-6 text-sm text-gray-600">
        Already confirmed?{" "}
        <Link href="/login" className="font-medium text-orange-600 underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
