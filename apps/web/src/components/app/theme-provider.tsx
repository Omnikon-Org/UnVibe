"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const darkMode = useUIStore((state) => state.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className="relative min-h-screen w-full">
      <div
        className="absolute inset-0 z-0"
        style={
          darkMode
            ? {
                background: "radial-gradient(125% 125% at 50% 100%, hsl(220 24% 6%) 40%, hsl(188 91% 35% / 0.12) 100%)",
              }
            : {
                background: "radial-gradient(125% 125% at 50% 90%, hsl(210 25% 98%) 40%, hsl(188 91% 35% / 0.08) 100%)",
              }
        }
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
