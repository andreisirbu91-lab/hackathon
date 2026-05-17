"use client";
import { useEffect, useState, KeyboardEvent } from "react";
import { ArrowUp, Square, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput, speak, stopSpeaking } from "@/lib/voice";

const VOICE_ENABLED_KEY = "hackaton:voiceOutput";

export function Composer({
  onSend,
  onStop,
  busy,
  lastAssistantText,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  lastAssistantText?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);

  // Persist voice output preference
  useEffect(() => {
    setVoiceOutput(typeof window !== "undefined" && localStorage.getItem(VOICE_ENABLED_KEY) === "1");
  }, []);
  const toggleVoiceOutput = () => {
    setVoiceOutput((v) => {
      const next = !v;
      try { localStorage.setItem(VOICE_ENABLED_KEY, next ? "1" : "0"); } catch {}
      if (!next) stopSpeaking();
      return next;
    });
  };

  // Speak the final assistant message when it's complete (busy → !busy edge).
  const [prevBusy, setPrevBusy] = useState(busy);
  useEffect(() => {
    if (prevBusy && !busy && voiceOutput && lastAssistantText) {
      speak(lastAssistantText);
    }
    setPrevBusy(busy);
  }, [busy, prevBusy, voiceOutput, lastAssistantText]);

  const voice = useVoiceInput({
    lang: "ro-RO",
    onFinalTranscript: (transcript) => {
      // Send directly so the demo flows fast
      onSend(transcript);
    },
  });

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
          value={voice.listening ? voice.interim || text : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={2}
          placeholder={voice.listening ? "Listening…" : "Ask the agent…"}
          className="w-full resize-none bg-transparent px-4 py-3 pr-28 text-[13.5px] text-text placeholder:text-muted/60 focus:outline-none"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {voice.supported && (
            <button
              onClick={voice.listening ? voice.stop : voice.start}
              aria-label={voice.listening ? "Stop listening" : "Start voice input"}
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center transition border",
                voice.listening
                  ? "bg-accent/20 border-accent text-accent animate-pulse"
                  : "bg-transparent border-border text-muted hover:text-text"
              )}
              title="Voice input (ro-RO)"
            >
              {voice.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={toggleVoiceOutput}
            aria-label={voiceOutput ? "Disable voice replies" : "Enable voice replies"}
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center transition border",
              voiceOutput
                ? "bg-accent/20 border-accent text-accent"
                : "bg-transparent border-border text-muted hover:text-text"
            )}
            title="Speak agent replies"
          >
            {voiceOutput ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
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
      <div className="mt-1.5 px-1 text-[10px] text-muted/50 font-mono flex items-center gap-3">
        <span>Enter to send · Shift+Enter newline</span>
        {voice.supported && <span>· 🎙 voice in (ro-RO)</span>}
        {voiceOutput && <span className="text-accent/80">· speaking replies</span>}
      </div>
    </div>
  );
}
