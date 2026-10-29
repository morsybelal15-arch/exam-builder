"use client";

import { useLayoutEffect } from "react";

/**
 * Zero-delay theme synchronizer on client hydration.
 * Route transitions render instantaneously at 100% opacity without hiding cards or blocking the main thread.
 */
export default function GsapAnimationProvider() {
  useLayoutEffect(() => {
    try {
      const savedTheme = localStorage.getItem("app_theme_preset");
      if (savedTheme && savedTheme !== "default") {
        document.documentElement.setAttribute("data-theme", savedTheme);
        if (savedTheme === "dark") {
          document.documentElement.style.backgroundColor = "#0b1120";
          document.documentElement.style.colorScheme = "dark";
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  return null;
}
