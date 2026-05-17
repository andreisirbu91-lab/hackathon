"use client";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// A thin "lamp" strip at the top of the viewport. When on=true, two cyan
// conic gradients fan out from the center-top, plus a soft glow bar that
// reads as actual light spilling down over the page. When off, opacity 0.
export function Lamp({ on, className }: { on: boolean; className?: string }) {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed top-0 left-0 right-0 z-30 h-[280px] overflow-hidden transition-opacity duration-700",
        on ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ mixBlendMode: "screen" }}
    >
      <div className="relative w-full h-full">
        {/* Left half of the conic */}
        <motion.div
          initial={{ opacity: 0, width: "12rem" }}
          animate={on ? { opacity: 0.9, width: "28rem" } : { opacity: 0, width: "12rem" }}
          transition={{ duration: reduce ? 0.2 : 1.0, ease: [0.2, 0.65, 0.3, 0.95] }}
          style={{
            backgroundImage:
              "conic-gradient(from 70deg at 50% 100%, hsl(350 95% 65% / 0.55), transparent, transparent)",
          }}
          className="absolute right-1/2 top-0 h-[180px] w-[28rem]"
        />
        {/* Right half of the conic */}
        <motion.div
          initial={{ opacity: 0, width: "12rem" }}
          animate={on ? { opacity: 0.9, width: "28rem" } : { opacity: 0, width: "12rem" }}
          transition={{ duration: reduce ? 0.2 : 1.0, ease: [0.2, 0.65, 0.3, 0.95] }}
          style={{
            backgroundImage:
              "conic-gradient(from 290deg at 50% 100%, transparent, transparent, hsl(350 95% 65% / 0.55))",
          }}
          className="absolute left-1/2 top-0 h-[180px] w-[28rem]"
        />
        {/* Hot core blob */}
        <motion.div
          initial={{ width: "8rem", opacity: 0 }}
          animate={on ? { width: "16rem", opacity: 0.85 } : { width: "8rem", opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 1.0, ease: [0.2, 0.65, 0.3, 0.95] }}
          className="absolute left-1/2 -translate-x-1/2 top-0 h-32 rounded-full blur-3xl"
          style={{ background: "hsl(350 95% 60% / 0.7)" }}
        />
        {/* Sharp filament line just under the bulb */}
        <motion.div
          initial={{ width: "10rem", opacity: 0 }}
          animate={on ? { width: "22rem", opacity: 0.9 } : { width: "10rem", opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 1.0, ease: [0.2, 0.65, 0.3, 0.95] }}
          className="absolute left-1/2 -translate-x-1/2 top-[6px] h-px"
          style={{ background: "hsl(350 95% 75%)", boxShadow: "0 0 8px hsl(350 95% 65%)" }}
        />
        {/* Soft downward light wash so it actually 'lights' content below */}
        <div
          className="absolute inset-x-0 top-[80px] h-[200px]"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, hsl(350 90% 70% / 0.18), transparent 70%)",
          }}
        />
      </div>
    </div>
  );
}
