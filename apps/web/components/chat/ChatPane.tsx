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
    <div className="flex flex-col h-full w-full min-h-0 bg-bg">
      <ScrollArea className="flex-1 min-h-0">
        <MessageList turns={turns} />
      </ScrollArea>
      <Composer onSend={onSend} onStop={onStop} busy={busy} />
    </div>
  );
}
