"use client";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatTurn } from "@/lib/chat-store";
import { ToolCallBubble } from "./ToolCallBubble";
import { cn } from "@/lib/utils";

export function MessageList({ turns }: { turns: ChatTurn[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  if (turns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        <div className="max-w-sm text-center space-y-2">
          <div className="text-text font-medium">Ready.</div>
          <div>Ask the agent to do something visible — search the web, navigate a site, build a chart.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {turns.map((t, i) => (
        <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
          {t.role === "user" ? (
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-accent text-white whitespace-pre-wrap">
              {t.content}
            </div>
          ) : (
            <div className="max-w-[85%] w-full space-y-2">
              {t.toolCalls.map((tc) => <ToolCallBubble key={tc.id} tc={tc} />)}
              {t.content && (
                <div className="prose-chat text-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
