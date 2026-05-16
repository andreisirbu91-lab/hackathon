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
  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="border-b border-border px-4 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-success" />
        <h2 className="text-sm font-medium text-text">Chat — Anthropic API</h2>
        <span className="ml-auto text-xs text-muted font-mono">claude-sonnet-4-6</span>
      </div>
      <ScrollArea className="flex-1">
        <MessageList turns={turns} />
      </ScrollArea>
      <Composer onSend={onSend} onStop={onStop} busy={busy} />
    </div>
  );
}
