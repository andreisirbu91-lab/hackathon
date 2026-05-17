"use client";
import { useMemo } from "react";
import Plan, { type Task } from "@/components/ui/agent-plan";
import type { ToolCallState } from "@/lib/stage-store";

function statusOf(tc: ToolCallState): string {
  if (tc.status === "running") return "in-progress";
  if (tc.status === "ok") return "completed";
  if (tc.status === "error") return "failed";
  return "pending";
}

function describeInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  try {
    const o = input as Record<string, unknown>;
    // pick the most descriptive single field
    const k = ["url", "query", "selector", "type", "sql"].find((k) => k in o);
    if (k && typeof o[k] === "string") return `${k}: ${o[k]}`;
    return JSON.stringify(o);
  } catch {
    return String(input);
  }
}

export function PlanView({ toolCalls }: { toolCalls: ToolCallState[] }) {
  const tasks: Task[] = useMemo(() => {
    if (toolCalls.length === 0) return [];

    const subtasks = toolCalls.map((tc, i) => ({
      id: `s-${i}`,
      title: tc.name,
      description: describeInput(tc.input),
      status: statusOf(tc),
      priority: "high",
      tools: [tc.name],
    }));

    const allOk = subtasks.every((s) => s.status === "completed");
    const anyFailed = subtasks.some((s) => s.status === "failed");
    const anyRunning = subtasks.some((s) => s.status === "in-progress");
    const status = anyFailed ? "failed" : anyRunning ? "in-progress" : allOk ? "completed" : "pending";

    return [
      {
        id: "run",
        title: "Current agent run",
        description: `${subtasks.length} tool call${subtasks.length === 1 ? "" : "s"}`,
        status,
        priority: "high",
        level: 0,
        dependencies: [],
        subtasks,
      },
    ];
  }, [toolCalls]);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        Plan will appear here as the agent calls tools.
      </div>
    );
  }

  return <Plan tasks={tasks} />;
}
