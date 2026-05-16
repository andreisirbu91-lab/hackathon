"use client";
import { useState } from "react";
import { ChatPane } from "@/components/chat/ChatPane";
import { StagePane } from "@/components/stage/StagePane";
import { useChat } from "@/lib/chat-store";
import { useStageEvents } from "@/lib/stage-store";

export default function Page() {
  const { turns, sessionId, busy, send, stop } = useChat();
  const stageEvents = useStageEvents(sessionId);
  const [tabOverride, setTabOverride] = useState<typeof stageEvents.activeTab | null>(null);

  const activeTab = tabOverride ?? stageEvents.activeTab;
  const state = { ...stageEvents, activeTab };

  return (
    <div className="h-screen w-screen flex">
      <header className="absolute top-0 left-0 right-0 h-10 px-4 flex items-center bg-panel/40 backdrop-blur border-b border-border z-10 pointer-events-none">
        <div className="text-xs text-muted font-mono">{process.env.NEXT_PUBLIC_APP_NAME ?? "Hack A Ton 2026"}</div>
      </header>
      <div className="flex w-full pt-10">
        <div className="w-[42%] min-w-[380px] border-r border-border">
          <ChatPane turns={turns} busy={busy} onSend={send} onStop={stop} />
        </div>
        <div className="flex-1">
          <StagePane state={state} onTabChange={(t) => setTabOverride(t)} />
        </div>
      </div>
    </div>
  );
}
