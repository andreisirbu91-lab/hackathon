"use client";
import type { ToolCallState } from "@/lib/stage-store";

export function CodeView({ toolCalls }: { toolCalls: ToolCallState[] }) {
  const last = [...toolCalls].reverse().find((t) => t.output !== undefined);

  if (!last) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        No tool output yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="text-xs text-muted font-mono">
        Last tool: <span className="text-text">{last.name}</span>
      </div>
      <pre className="bg-panel border border-border rounded-md p-3 text-xs font-mono overflow-x-auto text-text">
        {typeof last.output === "string" ? last.output : JSON.stringify(last.output, null, 2)}
      </pre>
    </div>
  );
}
