"use client";
import { useState, KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [focused, setFocused] = useState(false);

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
    <div className="px-4 pt-2 pb-4 bg-bg">
      <div
        className={cn(
          "relative rounded-2xl bg-panel/60 border transition-colors",
          focused ? "border-accent/50" : "border-border"
        )}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={2}
          placeholder="Ask the agent…"
          className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-[13.5px] text-text placeholder:text-muted/60 focus:outline-none"
        />
        <div className="absolute bottom-2 right-2">
          {busy ? (
            <button
              onClick={onStop}
              aria-label="Stop"
              className="h-7 w-7 rounded-full bg-danger/90 hover:bg-danger text-white flex items-center justify-center transition"
            >
              <Square className="w-3 h-3" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim()}
              aria-label="Send"
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center transition",
                text.trim()
                  ? "bg-text text-bg hover:bg-text/90"
                  : "bg-border text-muted cursor-not-allowed"
              )}
            >
              <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 px-1 text-[10px] text-muted/50 font-mono">
        Enter to send · Shift+Enter for newline
      </div>
    </div>
  );
}
