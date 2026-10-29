"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";

/**
 * Global lightweight GSAP animation controller for the entire application:
 * 1. Smoothly staggers cards, sections, and tables on route navigation.
 * 2. Automatically detects and animates any modal/popup/popover (الانبثاقات) mounted in the DOM.
 */
export default function GsapAnimationProvider() {
  const pathname = usePathname();

  // 0. Sync saved theme preset on client mount without inline <script> tags
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("app_theme_preset");
      if (savedTheme && savedTheme !== "default") {
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // 1. Page transition & staggered cards animation on route change
  useEffect(() => {
    let ctx: gsap.Context | null = null;
    const rafId = requestAnimationFrame(() => {
      ctx = gsap.context(() => {
        const mainEl = document.querySelector("main");
        if (!mainEl) return;

        // Animate top-level cards and sections inside the active page
        const targets = mainEl.querySelectorAll(
          ".gsap-card, .rounded-3xl, .rounded-2xl > .divide-y"
        );

        if (targets.length > 0) {
          gsap.fromTo(
            Array.from(targets).slice(0, 18),
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.38,
              stagger: 0.035,
              ease: "power2.out",
              clearProps: "transform,opacity",
              overwrite: "auto",
            }
          );
        }
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, [pathname]);

  // 2. Global MutationObserver for Modals, Dialogs & Popups (الانبثاقات)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const animatedNodes = new WeakSet<Element>();

    const animateModalOrPopover = (el: HTMLElement) => {
      if (animatedNodes.has(el)) return;
      animatedNodes.add(el);

      const cls = el.className || "";
      if (typeof cls !== "string") return;

      // Full-screen modal backdrop + inner dialog card
      if (cls.includes("fixed") && cls.includes("inset-0")) {
        gsap.fromTo(
          el,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.22,
            ease: "power2.out",
            clearProps: "opacity",
          }
        );

        const dialogCard = el.firstElementChild as HTMLElement | null;
        if (dialogCard) {
          gsap.fromTo(
            dialogCard,
            { opacity: 0, scale: 0.94, y: 16 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.32,
              ease: "back.out(1.35)",
              clearProps: "transform,opacity",
            }
          );
        }
        return;
      }

      // Dropdowns / Popovers (absolute top-full or gsap-popover)
      if (
        cls.includes("gsap-popover") ||
        (cls.includes("absolute") && cls.includes("top-full"))
      ) {
        gsap.fromTo(
          el,
          { opacity: 0, y: -8, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.24,
            ease: "power2.out",
            clearProps: "transform,opacity",
          }
        );
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          animateModalOrPopover(node);
          const nestedModals = node.querySelectorAll<HTMLElement>(
            ".fixed.inset-0, .gsap-popover, .absolute.top-full"
          );
          nestedModals.forEach((nested) => animateModalOrPopover(nested));
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

