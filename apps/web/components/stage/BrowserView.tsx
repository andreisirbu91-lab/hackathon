"use client";
import { Globe } from "lucide-react";

// Same-origin path: Traefik routes /vnc/* on hack.rzs-it.ro to the internal
// browser worker. The browser worker isn't reachable from outside the docker
// network on its own subdomain anymore — single front door, single auth surface.
const VNC_BASE = process.env.NEXT_PUBLIC_BROWSER_VNC_URL ?? "/vnc/vnc.html";

export function BrowserView({ activeUrl }: { activeUrl?: string }) {
  // path=vnc tells noVNC to upgrade WS at "/vnc" (which Traefik strips and
  // proxies to websockify's "/").
  const src = `${VNC_BASE}?autoconnect=1&resize=remote&view_only=1&path=vnc`;
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
      />
    </div>
  );
}
