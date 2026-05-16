"use client";
import { Globe } from "lucide-react";

const VNC_URL = process.env.NEXT_PUBLIC_BROWSER_VNC_URL ?? "http://localhost:6080/vnc.html";

export function BrowserView({ activeUrl }: { activeUrl?: string }) {
  const src = `${VNC_URL}?autoconnect=1&resize=remote&view_only=1`;
  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="border-b border-border px-3 py-2 flex items-center gap-2 text-xs text-muted">
        <Globe className="w-3.5 h-3.5" />
        <span className="font-mono truncate">{activeUrl ?? "about:blank"}</span>
        <span className="ml-auto px-1.5 py-0.5 rounded bg-success/20 text-success text-[10px] uppercase tracking-wider">live</span>
      </div>
      <iframe
        src={src}
        className="flex-1 w-full border-0"
        title="Agent browser (noVNC)"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
