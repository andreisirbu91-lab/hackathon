"use client";
import { useMemo } from "react";
import Plan, { type Task } from "@/components/ui/agent-plan";
import type { ToolCallState, AgentPlan } from "@/lib/stage-store";

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
    const k = ["url", "query", "selector", "type", "sql"].find((k) => k in o);
    if (k && typeof o[k] === "string") return `${k}: ${o[k]}`;
    return JSON.stringify(o);
  } catch {
    return String(input);
  }
}

export function PlanView({
  toolCalls,
  plan,
}: {
  toolCalls: ToolCallState[];
  plan: AgentPlan | null;
}) {
  const tasks: Task[] = useMemo(() => {
    // Prefer the agent's declared plan if present — that's the "narrative".
    if (plan) {
      // Sub-task for each declared step.
      const subtasks = plan.steps.map((step) => ({
        id: step.id,
        title: step.title,
        description: step.description ?? "",
        status: step.status,
        priority: "high",
        tools: step.tools,
      }));

      // Map to a separate "evidence" task with all tool calls for full detail.
      const evidence = toolCalls.map((tc, i) => ({
        id: `ev-${i}`,
        title: tc.name,
        description: describeInput(tc.input),
        status: statusOf(tc),
        priority: "medium",
        tools: [tc.name],
      }));

      const allOk = subtasks.every((s) => s.status === "completed");
      const anyFailed = subtasks.some((s) => s.status === "failed");
      const anyRunning = subtasks.some((s) => s.status === "in-progress") || toolCalls.some((t) => t.status === "running");
      const planStatus = anyFailed ? "failed" : anyRunning ? "in-progress" : allOk ? "completed" : "pending";

      const items: Task[] = [
        {
          id: "plan",
          title: plan.goal,
          description: "Agent's stated plan",
          status: planStatus,
          priority: "high",
          level: 0,
          dependencies: [],
          subtasks,
        },
      ];
      if (evidence.length > 0) {
        items.push({
          id: "evidence",
          title: "Tool activity",
          description: `${evidence.length} tool call${evidence.length === 1 ? "" : "s"}`,
          status: toolCalls.some((t) => t.status === "running") ? "in-progress" : "completed",
          priority: "medium",
          level: 1,
          dependencies: ["plan"],
          subtasks: evidence,
        });
      }
      return items;
    }

    // Fallback: no plan yet — show flat tool calls.
    if (toolCalls.length === 0) return [];
    const subtasks = toolCalls.map((tc, i) => ({
      id: `s-${i}`,
      title: tc.name,
      description: describeInput(tc.input),
      status: statusOf(tc),
      priority: "high",
      tools: [tc.name],
    }));
    return [
      {
        id: "run",
        title: "Current agent run",
        description: `${subtasks.length} tool call${subtasks.length === 1 ? "" : "s"}`,
        status: subtasks.some((s) => s.status === "in-progress") ? "in-progress" : "pending",
        priority: "high",
        level: 0,
        dependencies: [],
        subtasks,
      },
    ];
  }, [toolCalls, plan]);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        Plan will appear here once the agent declares one.
      </div>
    );
  }

  return <Plan tasks={tasks} />;
}
