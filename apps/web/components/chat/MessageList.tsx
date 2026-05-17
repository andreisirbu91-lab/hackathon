"use client";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Wrench } from "lucide-react";
import type { ChatTurn } from "@/lib/chat-store";
import { cn } from "@/lib/utils";

const STARTER_PROMPTS = [
  "Caută top 3 restaurante deschise acum în Mamaia. Verifică pe site că sunt deschise, afișează ca tabel.",
  "Navighează pe ambasada.pro, fă screenshot, apoi rezumă serviciile într-un kanban.",
  "Generează un grafic line cu 12 puncte fictive de revenue trimestrial pentru un SaaS B2B.",
  "Citește hackaton.ambasada.pro și extrage tracks-urile sponsorilor într-un tabel.",
];

export function MessageList({
  turns,
  onPick,
}: {
  turns: ChatTurn[];
  onPick: (text: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  if (turns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-5">
          <div className="space-y-1.5 text-center">
            <h2 className="text-text font-medium tracking-tight">Ready when you are.</h2>
            <p className="text-[13px] text-muted/80 leading-relaxed">
              Ask the agent to do something visible. It can search the web, drive a real browser
              you can watch on the right, render charts and tables, query a database.
            </p>
          </div>
          <div className="space-y-1.5">
            {STARTER_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => onPick(p)}
                className="w-full text-left px-3 py-2 rounded-lg border border-border/70 bg-panel/40 hover:bg-panel hover:border-border transition text-[12.5px] text-text/90 leading-snug"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5">
      {turns.map((t, i) => (
        <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
          {t.role === "user" ? (
            <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 bg-panel border border-border/70 text-[13.5px] text-text whitespace-pre-wrap">
              {t.content}
            </div>
          ) : (
            <div className="max-w-[92%] w-full space-y-1">
              {/* Quiet ticker showing tool activity — full detail lives in the Plan tab */}
              {t.toolCalls.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted/70 font-mono">
                  <Wrench className="w-3 h-3" />
                  {t.toolCalls.slice(-6).map((tc) => {
                    const running = tc.status === "running";
                    return (
                      <span
                        key={tc.id}
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border",
                          running
                            ? "border-accent/40 text-accent"
                            : tc.status === "error"
                            ? "border-danger/40 text-danger"
                            : "border-border text-muted"
                        )}
                      >
                        {running && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        {tc.name}
                      </span>
                    );
                  })}
                  {t.toolCalls.length > 6 && (
                    <span className="opacity-60">+{t.toolCalls.length - 6} more</span>
                  )}
                </div>
              )}
              {t.content && (
                <div className="prose-chat text-[13.5px] text-text leading-relaxed px-1">
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
