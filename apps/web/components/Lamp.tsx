"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

// Horizontal neon tube fixed at the top of the viewport.
// - Visible whether on or off (so it's clearly a physical fixture)
// - When ON: bright neon coral with multi-layer halo + warm light wash below
// - When OFF: tube is dark, page is heavily dimmed (brightness ~0.5)
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
      {/* Two small mounting brackets, fixed at top, holding the tube */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 z-40 w-[min(680px,72vw)]">
        <div className="relative h-3">
          <div className="absolute left-[18%] top-0 w-1.5 h-2.5 bg-gradient-to-b from-zinc-500 to-zinc-700 rounded-b-sm" />
          <div className="absolute right-[18%] top-0 w-1.5 h-2.5 bg-gradient-to-b from-zinc-500 to-zinc-700 rounded-b-sm" />
        </div>
        {/* Neon tube */}
        <div
          className={cn(
            "relative h-[6px] rounded-full mx-[12%] transition-all duration-500",
            on ? "bg-accent" : "bg-zinc-400/40"
          )}
          style={{
            boxShadow: on
              ? "0 0 6px hsl(350 95% 65%), 0 0 18px hsl(350 95% 60% / 0.9), 0 0 60px hsl(350 95% 55% / 0.7), 0 0 120px hsl(350 95% 50% / 0.45), 0 12px 100px hsl(350 95% 50% / 0.35), inset 0 0 4px hsl(0 0% 100% / 0.9)"
              : "inset 0 0 2px rgba(0,0,0,0.25)",
          }}
        >
          {/* Inner highlight stripe — only when on */}
          {on && (
            <div
              className="absolute top-[1px] left-1/2 -translate-x-1/2 w-[80%] h-px rounded-full"
              style={{ background: "hsl(0 0% 100%)", boxShadow: "0 0 4px hsl(0 0% 100%)" }}
            />
          )}
        </div>
      </div>

      {/* Light wash below the tube — broad warm spill */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-20 transition-opacity duration-700",
          on ? "opacity-100" : "opacity-0"
        )}
        style={{ height: "85vh" }}
      >
        {/* Main cone — wide ellipse anchored at the top */}
        <div
          className="absolute inset-x-0 top-0 h-full"
          style={{
            background:
              "radial-gradient(ellipse 70% 90% at 50% -10%, hsl(350 95% 65% / 0.32), hsl(350 95% 55% / 0.12) 35%, transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Hot core right under the tube */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-[60vw] h-[35vh]"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, hsl(40 100% 70% / 0.28), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </>
  );
}
