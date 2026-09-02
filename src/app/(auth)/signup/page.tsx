import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up | Gator Trade",
};

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        Create an account
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Gator Trade is restricted to verified UF students.
      </p>
      <SignupForm />
    </main>
  );
}
