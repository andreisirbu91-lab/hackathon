"use client";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const VNC_BASE = process.env.NEXT_PUBLIC_BROWSER_VNC_URL ?? "/vnc/vnc.html";

export function BrowserView({ activeUrl, loading }: { activeUrl?: string; loading?: boolean }) {
  const src = `${VNC_BASE}?autoconnect=1&resize=remote&view_only=1&path=vnc`;
  return (
    <div className="h-full flex flex-col bg-bg relative">
      {/* Thin animated progress bar — shown while a navigation is in flight */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px] z-10 overflow-hidden transition-opacity duration-200",
          loading ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className="h-full bg-accent"
          style={{
            backgroundImage: "linear-gradient(90deg, transparent 0%, hsl(190 100% 60%) 30%, hsl(0 0% 100%) 50%, hsl(190 100% 60%) 70%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: loading ? "browser-progress 1.2s linear infinite" : undefined,
          }}
        />
      </div>
      <style>{`
        @keyframes browser-progress {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      <div className="border-b border-border px-3 py-2 flex items-center gap-2 text-xs text-muted">
        <Globe className={cn("w-3.5 h-3.5", loading && "text-accent")} />
        <span className="font-mono truncate">{activeUrl ?? "about:blank"}</span>
        <span
          className={cn(
            "ml-auto px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors",
            loading ? "bg-accent/20 text-accent" : "bg-success/20 text-success"
          )}
        >
          {loading ? "loading…" : "live"}
        </span>
      </div>

      {/*
        key={activeUrl} forces a remount of the iframe on each navigation so the
        noVNC client gets a fresh WS connection — eliminates stale framebuffer
        cache. Trade-off: ~200ms reconnect flicker per navigate, acceptable.
      */}
      <iframe
        key={activeUrl ?? "blank"}
        src={src}
        className="flex-1 w-full border-0"
        title="Agent browser (noVNC)"
      />
    </div>
  );
}
