"use client";

import { useTransition } from "react";

import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => startTransition(async () => signOutAction())}
      disabled={isPending}
      className="h-11 rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
    >
      {isPending ? "Signing out..." : "Log out"}
    </Button>
  );
}
