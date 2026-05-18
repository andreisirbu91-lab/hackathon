"use client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

// Pendant neon mounted to the bottom of the top header bar.
// - Two metal brackets pierce through the header and hold a horizontal tube
//   right beneath it (so it reads as "attached to the bar", not floating).
// - White-only LED light (no cyan tint). Tube remains visible when on
//   thanks to a bright inner rim that out-bright-ens the surrounding halo.
// - Page-wide brightness/saturation filter on the html element provides the
//   "room dim" effect when off.
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
      {/* Lamp assembly: brackets in the header band + tube below it.
          Container starts at top:0 so the bracket origins look anchored INTO
          the header bar. */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 z-40 w-[min(680px,72vw)]">
        {/* Reserved row matching the 48px header — brackets live inside it */}
        <div className="relative h-12">
          {/* Bracket: small mounting plate at the header bottom + a short bar
              that drops down to the tube below */}
          {[18, 82].map((pct) => (
            <div
              key={pct}
              className="absolute"
              style={{ left: `${pct}%`, top: "30px", transform: "translateX(-50%)" }}
            >
              {/* Mounting plate flush with the header bottom edge */}
              <div className="w-3 h-1 bg-gradient-to-b from-zinc-500 to-zinc-700 rounded-sm shadow-soft" />
              {/* Drop bar */}
              <div className="mx-auto w-[2px] h-3.5 bg-gradient-to-b from-zinc-500 to-zinc-700" />
              {/* Small clamp where it grips the tube */}
              <div className="w-2.5 h-[3px] bg-gradient-to-b from-zinc-500 to-zinc-800 rounded-sm" />
            </div>
          ))}
        </div>

        {/* Neon tube — sits just under the header / brackets */}
        <div className="relative mx-[10%] -mt-px">
          <div
            className={cn(
              "relative h-[9px] rounded-full transition-all duration-500",
              on ? "bg-white" : "bg-zinc-300/35"
            )}
            style={{
              boxShadow: on
                ? [
                    // crisp visible rim — keeps the tube's silhouette readable
                    "inset 0 0 0 1px rgba(255,255,255,1)",
                    "inset 0 0 4px rgba(200,200,200,0.55)",
                    // tight outer light
                    "0 0 3px rgba(255,255,255,1)",
                    "0 0 9px rgba(255,255,255,0.95)",
                    "0 0 26px rgba(255,255,255,0.8)",
                    "0 0 70px rgba(255,255,255,0.6)",
                    "0 0 150px rgba(255,255,255,0.4)",
                    // downward bloom that lights the page
                    "0 18px 130px rgba(255,255,255,0.55)",
                  ].join(",")
                : "inset 0 0 0 1px rgba(120,120,120,0.3), inset 0 0 3px rgba(0,0,0,0.15)",
              border: on ? "1px solid rgba(220,220,220,0.4)" : "1px solid rgba(160,160,160,0.25)",
            }}
          />
        </div>
      </div>

      {/* Soft warm-white wash below the tube — actually lights the page */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-[58px] z-20 transition-opacity duration-700",
          on ? "opacity-100" : "opacity-0"
        )}
        style={{ height: "85vh" }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-[75vw] h-[55vh]"
          style={{
            background:
              "radial-gradient(ellipse 55% 100% at 50% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0.18) 35%, transparent 75%)",
            mixBlendMode: "screen",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-full"
          style={{
            background:
              "radial-gradient(ellipse 85% 80% at 50% -5%, rgba(255,255,255,0.32), rgba(255,255,255,0.1) 40%, transparent 75%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </>
  );
}
