"use client";
import { useState, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Composer({
  onSend,
  onStop,
  busy,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-panel/50 px-3 py-3">
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Ask the agent..."
          className="flex-1 resize-none bg-bg border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {busy ? (
          <Button variant="danger" size="icon" onClick={onStop} aria-label="Stop">
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={submit} disabled={!text.trim()} aria-label="Send">
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
