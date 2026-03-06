"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const themeStorageKey = "kanban-theme";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light" as const;
  }

  return window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleTheme}
      className="h-10 rounded-full border-black/10 bg-white/60 px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/80 hover:text-stone-950 dark:border-white/12 dark:bg-white/6 dark:text-stone-300 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-stone-50"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}
