"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

// A real-looking pendant lamp hanging from the top of the viewport.
// - Visible cord + bulb shape (always visible, even when off)
// - When ON: warm light cone radiates down, bulb glows, scene at full color
// - When OFF: bulb is dark/cold, no cone, the whole page is dimmed via a
//   body-level CSS filter so the toggle has an obvious visual effect
export function Lamp({ on }: { on: boolean }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.lamp = on ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.lamp;
    };
  }, [on]);

  return (
    <>
      {/* Hanging pendant — always visible, fixed top center */}
      <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-0 z-40 flex flex-col items-center">
        {/* Cord from ceiling to bulb cap */}
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-zinc-500/60 to-zinc-500/80" />
        {/* Bulb cap (the screw / fitting) */}
        <div className="w-3 h-1.5 bg-gradient-to-b from-zinc-400 to-zinc-700 rounded-t-[2px]" />
        {/* Glass bulb */}
        <div
          className={cn(
            "relative w-7 h-9 rounded-b-full rounded-t-[10px] transition-all duration-500",
            on
              ? "bg-gradient-to-b from-amber-100 via-amber-300 to-orange-400"
              : "bg-gradient-to-b from-zinc-300/60 to-zinc-500/80"
          )}
          style={{
            boxShadow: on
              ? "0 0 24px 8px hsl(40 100% 60% / 0.55), 0 0 64px 24px hsl(40 100% 55% / 0.32), inset 0 -4px 6px hsl(20 100% 40% / 0.5)"
              : "inset 0 -2px 4px rgba(0,0,0,0.18)",
          }}
        >
          {/* Filament glow when on */}
          {on && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-1.5 rounded-full bg-yellow-200"
                 style={{ boxShadow: "0 0 10px 3px hsl(50 100% 75%)" }} />
          )}
        </div>
      </div>

      {/* Light cone — only when on. Big soft warm wash that fades downward. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed left-1/2 -translate-x-1/2 top-[60px] z-20 w-full max-w-[1400px] transition-opacity duration-700",
          on ? "opacity-100" : "opacity-0"
        )}
        style={{ height: "70vh" }}
      >
        {/* Sharp central beam */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-[60vw] h-full"
          style={{
            background:
              "radial-gradient(ellipse 50% 100% at 50% 0%, hsl(40 100% 65% / 0.22), hsl(40 100% 65% / 0.08) 40%, transparent 75%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Wider ambient spill */}
        <div
          className="absolute inset-x-0 top-0 h-full"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(40 100% 70% / 0.1), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Cone outline — two angled gradients that look like beam edges */}
        <div
          className="absolute left-1/2 top-0 h-full w-[44vw]"
          style={{
            transform: "translateX(-50%)",
            background:
              "conic-gradient(from 165deg at 50% 0%, transparent 0deg, hsl(40 100% 70% / 0.06) 12deg, transparent 25deg, transparent 335deg, hsl(40 100% 70% / 0.06) 348deg, transparent 360deg)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </>
  );
}
