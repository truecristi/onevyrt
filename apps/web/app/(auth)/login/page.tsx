"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

interface LoginErrorBody {
  error?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(undefined);

    try {
      const result = await postJson<LoginErrorBody>("/api/auth/login", { email, password });

      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Deliberately the same generic message regardless of status (401
      // invalid credentials vs. 429 rate-limited vs. 400 malformed) -
      // packages/domain's InvalidCredentialsError is already identical for
      // "no such user" and "wrong password" (auth-use-cases.ts's timing-
      // safe login), and the UI shouldn't re-introduce a distinction the
      // API deliberately collapsed.
      setFormError(result.data.error ?? "Could not log in. Check your email and password.");
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-700">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-gray-600">
        Need an account?{" "}
        <Link href="/register" className="font-medium text-blue-600 hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
