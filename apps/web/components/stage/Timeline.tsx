"use client";
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import type { ToolCallState } from "@/lib/stage-store";
import { cn } from "@/lib/utils";

export function Timeline({ toolCalls }: { toolCalls: ToolCallState[] }) {
  if (toolCalls.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        Timeline will fill as the agent calls tools.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-3 space-y-1.5">
      {toolCalls.map((tc) => <Row key={tc.id} tc={tc} />)}
    </div>
  );
}

function Row({ tc }: { tc: ToolCallState }) {
  const [open, setOpen] = useState(false);
  const Icon = tc.status === "running" ? Loader2 : tc.status === "ok" ? CheckCircle2 : XCircle;
  const tone = tc.status === "running" ? "text-accent" : tc.status === "ok" ? "text-success" : "text-danger";
  const duration = tc.endedAt ? ((tc.endedAt - tc.startedAt) / 1000).toFixed(1) : null;

  return (
    <div className="rounded-md border border-border bg-panel/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-panel transition-colors"
      >
        <ChevronRight className={cn("w-3.5 h-3.5 text-muted transition-transform", open && "rotate-90")} />
        <Icon className={cn("w-3.5 h-3.5", tone, tc.status === "running" && "animate-spin")} />
        <span className="font-mono text-xs text-text">{tc.name}</span>
        {duration && <span className="ml-auto text-xs text-muted tabular-nums">{duration}s</span>}
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 space-y-2 text-xs font-mono">
          <details open>
            <summary className="text-muted cursor-pointer">input</summary>
            <pre className="bg-bg p-2 rounded overflow-x-auto mt-1">{JSON.stringify(tc.input, null, 2)}</pre>
          </details>
          {(tc.output !== undefined || tc.error) && (
            <details open>
              <summary className="text-muted cursor-pointer">{tc.error ? "error" : "output"}</summary>
              <pre className="bg-bg p-2 rounded overflow-x-auto mt-1">{tc.error ?? JSON.stringify(tc.output, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
