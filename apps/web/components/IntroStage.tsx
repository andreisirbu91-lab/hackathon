"use client";
import { useEffect, useRef, useState } from "react";

// One-shot liquid-glass form-up: the entire app appears to coalesce out of
// a turbulent fluid. Uses SVG turbulence + displacementMap with SMIL animate
// to drop scale from 80 -> 0 over 1.4s. Plus a CSS layer that pulls the
// opacity/blur/scale back to crisp.
export function IntroStage({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    // Run only once per session so it doesn't replay on every nav.
    const seen = typeof window !== "undefined" && sessionStorage.getItem("hk:intro") === "1";
    if (seen || reduceMotion.current) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => {
      setDone(true);
      try { sessionStorage.setItem("hk:intro", "1"); } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!done && (
        <svg className="absolute pointer-events-none" width="0" height="0" aria-hidden>
          <defs>
            <filter id="liquid-intro" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="3" result="turb" />
              <feGaussianBlur in="turb" stdDeviation="2" result="blurred" />
              <feDisplacementMap in="SourceGraphic" in2="blurred" xChannelSelector="R" yChannelSelector="G" scale="80">
                <animate attributeName="scale" from="80" to="0" dur="1.35s" fill="freeze" calcMode="spline" keySplines="0.2 0.65 0.3 0.95" />
              </feDisplacementMap>
            </filter>
          </defs>
        </svg>
      )}
      <div
        className={done ? "intro-done" : "intro-running"}
        style={{
          willChange: done ? "auto" : "filter, transform, opacity",
          filter: done ? undefined : "url(#liquid-intro)",
          animation: done ? "none" : "liquid-form 1.4s cubic-bezier(0.2, 0.65, 0.3, 0.95) both",
        }}
      >
        {children}
      </div>
    </>
  );
}
