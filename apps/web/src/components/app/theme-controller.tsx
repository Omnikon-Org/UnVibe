"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

export function ThemeController() {
  const { darkMode, toggleDarkMode } = useUIStore();
  // Defer icon render until after hydration to prevent SVG mismatch.
  // Server has no access to localStorage/Zustand, so it always renders
  // the Zustand default. The client may differ → hydration error.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Button variant="ghost" size="icon" onClick={toggleDarkMode} aria-label="Toggle dark mode">
      {mounted ? (
        darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
      ) : (
        // Render Sun as a neutral placeholder during SSR — no SVG mismatch
        // because we suppress the hydration warning on this single button.
        <Sun className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
