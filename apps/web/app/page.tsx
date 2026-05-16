"use client";
import { useState } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { StagePane } from "@/components/stage/StagePane";
import { useChat } from "@/lib/chat-store";
import { useStageEvents } from "@/lib/stage-store";
import type { TabKey } from "@/lib/stage-store";
import { MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Page() {
  const { turns, sessionId, busy, send, stop } = useChat();
  const stageEvents = useStageEvents(sessionId);
  const [tabOverride, setTabOverride] = useState<TabKey | null>(null);
  // mobile-only: which top-level view is visible (chat vs stage)
  const [mobileView, setMobileView] = useState<"chat" | "stage">("chat");

  const activeTab = tabOverride ?? stageEvents.activeTab;
  const state = { ...stageEvents, activeTab };

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      {/* ── Top brand bar ─────────────────────────────────────── */}
      <header className="shrink-0 h-12 px-4 border-b border-border flex items-center gap-3 bg-panel/40">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <h1 className="text-sm font-semibold text-text tracking-wide">
          {process.env.NEXT_PUBLIC_APP_NAME ?? "Hack A Ton 2026"}
        </h1>
        <span className="text-xs text-muted font-mono hidden sm:inline">claude-sonnet-4-6</span>

        {/* Mobile-only view toggle */}
        <div className="ml-auto md:hidden flex items-center gap-1 bg-bg rounded-md p-0.5 border border-border">
          <button
            onClick={() => setMobileView("chat")}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium flex items-center gap-1",
              mobileView === "chat" ? "bg-panel text-text" : "text-muted"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </button>
          <button
            onClick={() => setMobileView("stage")}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium flex items-center gap-1",
              mobileView === "stage" ? "bg-panel text-text" : "text-muted"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" /> Stage
          </button>
        </div>
      </header>

      {/* ── Main split ────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div
          className={cn(
            "min-h-0 border-border",
            "md:w-[42%] md:min-w-[380px] md:border-r",
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
          <StagePane
            state={state}
            onTabChange={(t) => setTabOverride(t)}
          />
        </div>
      </main>
    </div>
  );
}
