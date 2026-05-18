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
        {/* Neon tube — white-hot core, cyan halo (classic LED look) */}
        <div
          className={cn(
            "relative h-[7px] rounded-full mx-[10%] transition-all duration-500",
            on ? "bg-white" : "bg-zinc-400/40"
          )}
          style={{
            boxShadow: on
              ? [
                  // tight white inner shell
                  "0 0 3px hsl(0 0% 100%)",
                  "0 0 10px hsl(190 95% 90% / 0.95)",
                  // cyan halos broadening outward
                  "0 0 28px hsl(190 100% 65% / 0.85)",
                  "0 0 70px hsl(190 100% 55% / 0.65)",
                  "0 0 160px hsl(190 100% 50% / 0.35)",
                  // downward bloom that lights the page
                  "0 18px 120px hsl(190 100% 55% / 0.5)",
                  // inner highlight so the tube reads as glass
                  "inset 0 0 6px hsl(0 0% 100%)",
                ].join(",")
              : "inset 0 0 2px rgba(0,0,0,0.25)",
          }}
        />
      </div>

      {/* Light wash below the tube — broad cold-white spill */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-20 transition-opacity duration-700",
          on ? "opacity-100" : "opacity-0"
        )}
        style={{ height: "100vh" }}
      >
        {/* Hot white core right under the tube */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-[70vw] h-[45vh]"
          style={{
            background:
              "radial-gradient(ellipse 55% 100% at 50% 0%, hsl(0 0% 100% / 0.5), hsl(190 80% 90% / 0.2) 35%, transparent 75%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Cyan ambient wash that fades down the page */}
        <div
          className="absolute inset-x-0 top-0 h-full"
          style={{
            background:
              "radial-gradient(ellipse 90% 90% at 50% -10%, hsl(190 100% 60% / 0.32), hsl(190 100% 55% / 0.12) 35%, transparent 75%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </>
  );
}
