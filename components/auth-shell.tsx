import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { Badge } from "@/components/ui/badge";

type AuthShellProps = {
  mode: "signin" | "signup";
};

export function AuthShell({ mode }: AuthShellProps) {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] lg:items-center">
        <section className="max-w-md">
          <Badge
            variant="outline"
            className="rounded-full border-black/8 bg-white/65 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-500"
          >
            Kanban
          </Badge>
          <h1 className="mt-4 font-[family:var(--font-display)] text-5xl leading-none tracking-[-0.05em] text-stone-950 sm:text-6xl">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-6 text-sm text-stone-500">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <Link href="/signup" className="text-stone-950 underline underline-offset-4">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Have an account?{" "}
                <Link href="/signin" className="text-stone-950 underline underline-offset-4">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </section>
        <AuthForm mode={mode} />
      </div>
    </main>
  );
}
