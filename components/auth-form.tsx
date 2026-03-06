"use client";

import { useActionState } from "react";

import type { AuthState } from "@/app/actions";
import { signInAction, signUpAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: AuthState = {};

type AuthMode = "signin" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const [state, action, isPending] = useActionState(
    mode === "signin" ? signInAction : signUpAction,
    initialState
  );

  return (
    <Card className="rounded-[1.8rem] border-black/8 bg-[rgba(252,249,243,0.92)] py-0 shadow-[0_20px_60px_rgba(32,27,21,0.08)] backdrop-blur dark:border-white/12 dark:bg-[rgba(36,32,28,0.9)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <CardHeader className="gap-2 border-b border-black/8 px-6 py-5 dark:border-white/10">
        <CardTitle className="font-[family:var(--font-display)] text-4xl tracking-[-0.04em] text-stone-950 dark:text-stone-50">
          {mode === "signin" ? "Sign in" : "Sign up"}
        </CardTitle>
        <CardDescription className="text-sm leading-6 text-stone-500 dark:text-stone-400">Email and password.</CardDescription>
      </CardHeader>

      <CardContent className="px-6 py-5">
        <form action={action} className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">Email</span>
            <Input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0 dark:border-white/12 dark:bg-white/6 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:border-white/20"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">Password</span>
            <Input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="Password"
              className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0 dark:border-white/12 dark:bg-white/6 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:border-white/20"
            />
          </label>

          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

          <Button
            type="submit"
            disabled={isPending}
            className="h-11 rounded-full bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--primary-foreground)] shadow-none hover:opacity-92"
          >
            {isPending ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
