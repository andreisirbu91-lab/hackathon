"use client";
import { useCallback, useRef, useState } from "react";

export type ToolCallView = {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  status: "running" | "ok" | "error";
  durationMs?: number;
};

export type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCallView[] };

export function useChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;

    const userTurn: ChatTurn = { role: "user", content: text };
    const assistantTurn: ChatTurn = { role: "assistant", content: "", toolCalls: [] };
    setTurns((t) => [...t, userTurn, assistantTurn]);
    setBusy(true);

    const history = [...turns, userTurn].map((t) => ({
      role: t.role,
      content: t.content,
    }));

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages: history }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let evt: any;
          try { evt = JSON.parse(raw); } catch { continue; }
          handleEvent(evt);
        }
      }
    } catch (e) {
      handleEvent({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }

    function handleEvent(evt: any) {
      if (evt.kind === "session") {
        setSessionId(evt.sessionId);
        return;
      }
      setTurns((curr) => {
        const last = curr[curr.length - 1];
        if (!last || last.role !== "assistant") return curr;
        const updated = { ...last };
        if (evt.kind === "text") {
          updated.content += evt.delta;
        } else if (evt.kind === "tool_call_start") {
          updated.toolCalls = [
            ...updated.toolCalls,
            { id: evt.id, name: evt.name, input: evt.input, status: "running" },
          ];
        } else if (evt.kind === "tool_call_end") {
          updated.toolCalls = updated.toolCalls.map((tc) =>
            tc.id === evt.id
              ? {
                  ...tc,
                  output: evt.output,
                  error: evt.error,
                  status: evt.error ? "error" : "ok",
                  durationMs: evt.durationMs,
                }
              : tc
          );
        } else if (evt.kind === "error") {
          updated.content += `\n\n_Error: ${evt.message}_`;
        }
        return [...curr.slice(0, -1), updated];
      });
    }
  }, [busy, turns, sessionId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { turns, sessionId, busy, send, stop };
}
