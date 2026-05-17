"use client";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatTurn } from "@/lib/chat-store";

export function ChatPane({
  turns,
  busy,
  onSend,
  onStop,
}: {
  turns: ChatTurn[];
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  // Most recent assistant text — for voice-output to read aloud when busy flips off
  const lastAssistantText = (() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      if (t.role === "assistant" && t.content) return t.content;
    }
    return undefined;
  })();
  return (
    <div className="flex flex-col h-full w-full min-w-0 min-h-0 bg-bg overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 min-w-0">
        <MessageList turns={turns} onPick={onSend} />
      </ScrollArea>
      <Composer onSend={onSend} onStop={onStop} busy={busy} lastAssistantText={lastAssistantText} />
    </div>
  );
}
