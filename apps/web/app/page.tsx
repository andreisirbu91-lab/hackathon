"use client";
import { useState } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { StagePane } from "@/components/stage/StagePane";
import { useChat } from "@/lib/chat-store";
import { useStageEvents } from "@/lib/stage-store";
import type { TabKey } from "@/lib/stage-store";
import { MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Hack A Ton 2026";
const BUILD_SHA = (process.env.NEXT_PUBLIC_BUILD_SHA || "local").slice(0, 7);

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function Page() {
  const { turns, sessionId, busy, send, stop, usage } = useChat();
  const stageEvents = useStageEvents(sessionId);
  const totalInput = usage.input + usage.cacheCreate + usage.cacheRead;
  const cacheHit = totalInput > 0 ? Math.round((usage.cacheRead / totalInput) * 100) : 0;
  const [tabOverride, setTabOverride] = useState<TabKey | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "stage">("chat");

  const activeTab = tabOverride ?? stageEvents.activeTab;
  const state = { ...stageEvents, activeTab };

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      {/* ── Top bar — Hack A Ton-style ─────────────────────────── */}
      <header className="shrink-0 h-12 px-4 border-b border-border flex items-center gap-3 bg-bg">
        <div className="flex items-center gap-2">
          {/* Hack-A-Ton-ish logo: circle with red dot inside */}
          <div className="relative w-5 h-5 rounded-full border border-text/80 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-accent" />
          </div>
          <h1 className="text-[13px] font-semibold text-text tracking-tight uppercase">
            Hack<span className="text-accent">·</span>A<span className="text-accent">·</span>Ton
          </h1>
          <span className="mono-tag hidden sm:inline">JUNE 5-7, 2026 // MAMAIA</span>
        </div>
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px]">
          {(usage.input > 0 || usage.output > 0) && (
            <span
              className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border text-muted/80"
              title={`${usage.input} in · ${usage.output} out · cache ${usage.cacheRead}/${totalInput} (${cacheHit}%) · ${usage.model}`}
            >
              <span className="text-text/80">{formatTokens(totalInput + usage.output)}</span>
              <span className="opacity-50">tok</span>
              <span className="opacity-40">·</span>
              <span className={cacheHit > 50 ? "text-success" : "text-muted/70"}>{cacheHit}% cache</span>
              <span className="opacity-40">·</span>
              <span className="text-accent">${usage.costUsd.toFixed(4)}</span>
            </span>
          )}
          <span className={cn(
            "px-2 py-0.5 rounded-full border tracking-wider uppercase",
            busy ? "border-accent/50 text-accent bg-accent-soft/30" : "border-border text-muted"
          )}>
            {busy ? "running" : "ready"}
          </span>
          <span className="hidden md:inline text-muted/70">build {BUILD_SHA}</span>
        </span>

        {/* mobile pane toggle */}
        <div className="md:hidden flex items-center gap-0.5 bg-panel rounded-md p-0.5 border border-border">
          <button
            onClick={() => setMobileView("chat")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition",
              mobileView === "chat" ? "bg-bg text-text" : "text-muted"
            )}
          >
            <MessageSquare className="w-3 h-3" /> Chat
          </button>
          <button
            onClick={() => setMobileView("stage")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition",
              mobileView === "stage" ? "bg-bg text-text" : "text-muted"
            )}
          >
            <Sparkles className="w-3 h-3" /> Stage
          </button>
        </div>
      </header>

      {/* ── Main split ───────────────────────────────────────── */}
      <main className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div
          className={cn(
            "min-h-0 border-border",
            "md:w-[40%] md:min-w-[360px] md:border-r",
            "flex-1 md:flex-none",
            mobileView === "chat" ? "flex" : "hidden md:flex"
          )}
        >
          <ChatPane turns={turns} busy={busy} onSend={send} onStop={stop} />
        </div>
        <div
          className={cn(
            "min-h-0 flex-1",
            mobileView === "stage" ? "flex" : "hidden md:flex"
          )}
        >
          <StagePane state={state} onTabChange={(t) => setTabOverride(t)} />
        </div>
      </main>
    </div>
  );
}
