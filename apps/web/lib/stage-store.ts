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

export type TabKey = "browser" | "artifact" | "code" | "timeline";

export type StageState = {
  toolCalls: ToolCallState[];
  artifacts: ArtifactItem[];
  activeBrowserUrl?: string;
  activeTab: TabKey;
};

export function useStageEvents(sessionId: string | null) {
  const [state, setState] = useState<StageState>({
    toolCalls: [],
    artifacts: [],
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
      const tc: ToolCallState = {
        id: evt.id,
        name: evt.name,
        input: evt.input,
        startedAt: evt.at,
        status: "running",
      };
      // Always auto-switch on tool start so the audience sees the action live.
      const tab = pickTabFromTool(evt.name) ?? "code";
      return { ...s, toolCalls: [...s.toolCalls, tc], activeTab: tab };
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
      return next;
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
