/**
 * Phase 9 first UI slice: shared shell for the unauthenticated
 * register/login pages - centered, no navigation (there's nothing to
 * navigate to yet without a session).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">ONEVYRT</h1>
      {children}
    </main>
  );
}
