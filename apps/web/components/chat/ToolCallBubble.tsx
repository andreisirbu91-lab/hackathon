"use client";
import { useState } from "react";
import { ChevronRight, Wrench, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { ToolCallView } from "@/lib/chat-store";
import { cn } from "@/lib/utils";

export function ToolCallBubble({ tc }: { tc: ToolCallView }) {
  const [open, setOpen] = useState(false);
  const Icon =
    tc.status === "running" ? Loader2 :
    tc.status === "ok" ? CheckCircle2 : XCircle;
  const tone =
    tc.status === "running" ? "text-accent" :
    tc.status === "ok" ? "text-success" : "text-danger";

  return (
    <div className="rounded-md border border-border bg-panel/50 text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-panel/80 transition-colors"
      >
        <ChevronRight className={cn("w-3.5 h-3.5 text-muted transition-transform", open && "rotate-90")} />
        <Wrench className="w-3.5 h-3.5 text-muted" />
        <span className="font-mono text-xs text-text">{tc.name}</span>
        <Icon className={cn("w-3.5 h-3.5 ml-auto", tone, tc.status === "running" && "animate-spin")} />
        {tc.durationMs !== undefined && (
          <span className="text-xs text-muted tabular-nums">{(tc.durationMs / 1000).toFixed(1)}s</span>
        )}
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 space-y-2 text-xs font-mono">
          <div>
            <div className="text-muted mb-1">input</div>
            <pre className="bg-bg p-2 rounded overflow-x-auto">{JSON.stringify(tc.input, null, 2)}</pre>
          </div>
          {(tc.output !== undefined || tc.error) && (
            <div>
              <div className="text-muted mb-1">{tc.error ? "error" : "output"}</div>
              <pre className="bg-bg p-2 rounded overflow-x-auto">
                {tc.error ?? JSON.stringify(tc.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
