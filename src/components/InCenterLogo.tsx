"use client";

import React from "react";

interface InCenterLogoProps {
  className?: string;
}

/**
 * Renders the isolated, background-free InCenter brand logo (`in center logo.png`)
 * using two pixel-exact alpha mask layers:
 * 1. `incenter-badge-mask.png` ("in" rounded badge) -> themed vertical gradient
 * 2. `incenter-text-mask.png` ("center" wordmark) -> themed dark/light contrast color
 *
 * Automatically adapts its colors to every active theme (`default`, `emerald`,
 * `orange`, `burgundy`, `violet`, and `dark`).
 */
export default function InCenterLogo({ className = "h-10" }: InCenterLogoProps) {
  return (
    <div
      dir="ltr"
      role="img"
      aria-label="InCenter Logo"
      className={`relative inline-block select-none shrink-0 ${className}`}
      style={{ aspectRatio: "918 / 255" }}
    >
      {/* Layer 1: The "in" rounded square badge with theme-reactive gradient */}
      <span
        aria-hidden="true"
        className="absolute inset-0 block transition-colors duration-300"
        style={{
          background:
            "linear-gradient(180deg, var(--logo-badge-top, var(--theme-primary-400)) 0%, var(--logo-badge-mid, var(--theme-primary-600)) 55%, var(--logo-badge-bottom, var(--theme-primary-950)) 100%)",
          WebkitMaskImage: "url('/incenter-badge-mask.png')",
          maskImage: "url('/incenter-badge-mask.png')",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />

      {/* Layer 2: The "center" wordmark with theme-reactive contrast color */}
      <span
        aria-hidden="true"
        className="absolute inset-0 block transition-colors duration-300"
        style={{
          backgroundColor: "var(--logo-wordmark-color, var(--theme-primary-950))",
          WebkitMaskImage: "url('/incenter-text-mask.png')",
          maskImage: "url('/incenter-text-mask.png')",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
    </div>
  );
}

