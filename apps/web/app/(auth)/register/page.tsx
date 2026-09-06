"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@onevyrt/design-system";
import { postJson } from "@/lib/browser-api";

/**
 * Phase 9 first UI slice: the first real, rendered page beyond the
 * Phase 0/1 scaffold. Wires directly to the existing, already-tested
 * register API (apps/web/app/api/auth/register/route.ts) - no new
 * backend behavior, just a real form in front of what already worked
 * only via curl.
 */

interface RegisterErrorBody {
  error?: string;
  issues?: { fieldErrors?: Record<string, string[]> };
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(undefined);
    setFieldErrors({});

    try {
      const result = await postJson<RegisterErrorBody>("/api/auth/register", {
        email,
        password,
        workspaceName,
      });

      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const nextFieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(result.data.issues?.fieldErrors ?? {})) {
        const first = messages?.[0];
        if (first) nextFieldErrors[field] = first;
      }
      setFieldErrors(nextFieldErrors);
      setFormError(
        Object.keys(nextFieldErrors).length > 0
          ? undefined
          : (result.data.error ?? "Registration failed"),
      );
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
          label="Work email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 12 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          {...(fieldErrors.password ? { error: fieldErrors.password } : {})}
        />
        <Input
          label="Workspace name"
          type="text"
          autoComplete="organization"
          required
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          {...(fieldErrors.workspaceName ? { error: fieldErrors.workspaceName } : {})}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-700">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
