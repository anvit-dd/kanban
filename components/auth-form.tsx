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
    <Card className="rounded-[1.8rem] border-black/8 bg-[rgba(252,249,243,0.92)] py-0 shadow-[0_20px_60px_rgba(32,27,21,0.08)] backdrop-blur">
      <CardHeader className="gap-2 border-b border-black/8 px-6 py-5">
        <CardTitle className="font-[family:var(--font-display)] text-4xl tracking-[-0.04em] text-stone-950">
          {mode === "signin" ? "Sign in" : "Sign up"}
        </CardTitle>
        <CardDescription className="text-sm leading-6 text-stone-500">Email and password.</CardDescription>
      </CardHeader>

      <CardContent className="px-6 py-5">
        <form action={action} className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Email</span>
            <Input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Password</span>
            <Input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="Password"
              className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
            />
          </label>

          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

          <Button
            type="submit"
            disabled={isPending}
            className="h-11 rounded-full bg-stone-950 px-5 text-sm font-medium text-stone-50 shadow-none hover:bg-stone-800"
          >
            {isPending ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
