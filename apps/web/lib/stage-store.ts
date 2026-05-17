"use client";
import { useEffect, useRef, useState } from "react";

export type ToolCallState = {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "ok" | "error";
};

export type ArtifactItem = { id: string; type: string; props: unknown; at: number };

export type PlanStep = {
  id: string;
  title: string;
  description?: string;
  tools?: string[];
  status: "pending" | "in-progress" | "completed" | "failed";
};
export type AgentPlan = {
  id: string;
  goal: string;
  steps: PlanStep[];
};

export type TabKey = "browser" | "artifact" | "code" | "timeline";

export type StageState = {
  toolCalls: ToolCallState[];
  artifacts: ArtifactItem[];
  plan: AgentPlan | null;
  activeBrowserUrl?: string;
  activeTab: TabKey;
};

export function useStageEvents(sessionId: string | null) {
  const [state, setState] = useState<StageState>({
    toolCalls: [],
    artifacts: [],
    plan: null,
    activeTab: "timeline",
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/events?sessionId=${encodeURIComponent(sessionId)}`);
    esRef.current = es;
    es.onmessage = (e) => {
      let evt: any;
      try { evt = JSON.parse(e.data); } catch { return; }
      setState((s) => reduce(s, evt));
    };
    es.onerror = () => {};
    return () => { es.close(); esRef.current = null; };
  }, [sessionId]);

  return state;
}

function reduce(s: StageState, evt: any): StageState {
  switch (evt.kind) {
    case "tool_call_start": {
      // Idempotent on id — second emit with full input updates the existing entry.
      const existingIdx = s.toolCalls.findIndex((t) => t.id === evt.id);
      if (existingIdx >= 0) {
        const toolCalls = s.toolCalls.slice();
        toolCalls[existingIdx] = { ...toolCalls[existingIdx], input: evt.input };
        return { ...s, toolCalls };
      }
      const tc: ToolCallState = {
        id: evt.id,
        name: evt.name,
        input: evt.input,
        startedAt: evt.at,
        status: "running",
      };
      const tab = pickTabFromTool(evt.name) ?? "code";
      let plan = s.plan;
      if (plan && evt.name !== "submit_plan") {
        const idx = plan.steps.findIndex(
          (st) => st.status === "pending" && (st.tools?.includes(evt.name) ?? true)
        );
        if (idx >= 0) {
          const steps = plan.steps.slice();
          steps[idx] = { ...steps[idx], status: "in-progress" };
          plan = { ...plan, steps };
        }
      }
      return { ...s, toolCalls: [...s.toolCalls, tc], activeTab: tab, plan };
    }
    case "tool_input_delta": {
      // Accumulate streaming JSON characters into the matching tool call's input.
      const toolCalls = s.toolCalls.map((tc) => {
        if (tc.id !== evt.id) return tc;
        const prev = typeof tc.input === "string" ? tc.input : "";
        return { ...tc, input: prev + evt.partial };
      });
      return { ...s, toolCalls };
    }
    case "tool_call_end": {
      const toolCalls = s.toolCalls.map((tc) =>
        tc.id === evt.id
          ? { ...tc, output: evt.output, error: evt.error, endedAt: evt.at, status: evt.error ? "error" : "ok" }
          : tc
      ) as ToolCallState[];
      let next: StageState = { ...s, toolCalls };
      if (evt.name === "browser_navigate" && evt.output && typeof evt.output === "object") {
        const out = evt.output as { url?: string };
        if (out.url) next.activeBrowserUrl = out.url;
      }
      if (next.plan && evt.name !== "submit_plan") {
        const idx = next.plan.steps.findIndex(
          (st) => st.status === "in-progress" && (st.tools?.includes(evt.name) ?? true)
        );
        if (idx >= 0) {
          const steps = next.plan.steps.slice();
          steps[idx] = { ...steps[idx], status: evt.error ? "failed" : "completed" };
          next.plan = { ...next.plan, steps };
        }
      }
      return next;
    }
    case "plan": {
      const plan: AgentPlan = {
        id: evt.id,
        goal: evt.goal,
        steps: evt.steps.map((s: PlanStep) => ({ ...s, status: s.status ?? "pending" })),
      };
      return { ...s, plan, activeTab: "timeline" };
    }
    case "artifact": {
      const item: ArtifactItem = { id: evt.id, type: evt.type, props: evt.props, at: evt.at };
      return { ...s, artifacts: [...s.artifacts, item], activeTab: "artifact" };
    }
    case "browser": {
      return { ...s, activeBrowserUrl: evt.url ?? s.activeBrowserUrl, activeTab: "browser" };
    }
    default:
      return s;
  }
}

function pickTabFromTool(name: string): TabKey | null {
  if (name.startsWith("browser_")) return "browser";
  if (name === "render_artifact") return "artifact";
  if (name === "web_search" || name === "db_query") return "code";
  return null;
}
