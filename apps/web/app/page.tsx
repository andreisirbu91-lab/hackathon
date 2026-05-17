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
const BUILD_SHA = (process.env.NEXT_PUBLIC_BUILD_SHA ?? "local").slice(0, 7);

export default function Page() {
  const { turns, sessionId, busy, send, stop } = useChat();
  const stageEvents = useStageEvents(sessionId);
  const [tabOverride, setTabOverride] = useState<TabKey | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "stage">("chat");

  const activeTab = tabOverride ?? stageEvents.activeTab;
  const state = { ...stageEvents, activeTab };

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="shrink-0 h-11 px-4 border-b border-border flex items-center gap-3 bg-bg">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-accent animate-ping opacity-75" />
          </div>
          <h1 className="text-[13px] font-medium text-text tracking-tight">
            {APP_NAME}
          </h1>
        </div>
        <span className="text-[11px] text-muted/60 font-mono hidden sm:inline">
          · agent workstation
        </span>
        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted/60 font-mono">
          <span className={cn("px-1.5 py-0.5 rounded border", busy ? "border-accent/40 text-accent" : "border-border")}>
            {busy ? "thinking" : "idle"}
          </span>
          <span className="hidden md:inline">build {BUILD_SHA}</span>
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
