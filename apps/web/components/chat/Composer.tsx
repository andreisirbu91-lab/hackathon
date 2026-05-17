"use client";
import { useEffect, useState, useCallback, useRef, KeyboardEvent, DragEvent } from "react";
import { ArrowUp, Square, Mic, MicOff, Volume2, VolumeX, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput, speak, stopSpeaking } from "@/lib/voice";
import { fileToAttachment, MAX_ATTACHMENTS, type Attachment } from "@/lib/attachments";

const VOICE_ENABLED_KEY = "hackaton:voiceOutput";

export function Composer({
  onSend,
  onStop,
  busy,
  lastAssistantText,
}: {
  onSend: (text: string, attachments?: Attachment[]) => void;
  onStop: () => void;
  busy: boolean;
  lastAssistantText?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [prevBusy, setPrevBusy] = useState(busy);
  useEffect(() => {
    if (prevBusy && !busy && voiceOutput && lastAssistantText) speak(lastAssistantText);
    setPrevBusy(busy);
  }, [busy, prevBusy, voiceOutput, lastAssistantText]);

  const voice = useVoiceInput({
    lang: "ro-RO",
    onFinalTranscript: (transcript) => onSend(transcript, attachments),
  });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setAttachError(null);
    const list = Array.from(files);
    const next: Attachment[] = [...attachments];
    for (const f of list) {
      if (next.length >= MAX_ATTACHMENTS) {
        setAttachError(`Maximum ${MAX_ATTACHMENTS} attachments`);
        break;
      }
      const res = await fileToAttachment(f);
      if ("error" in res) setAttachError(res.error);
      else next.push(res);
    }
    setAttachments(next);
  }, [attachments]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
  };

  const submit = () => {
    if ((!text.trim() && attachments.length === 0) || busy) return;
    onSend(text, attachments.length ? attachments : undefined);
    setText("");
    setAttachments([]);
    setAttachError(null);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-4 pt-2 pb-4 bg-bg"
         onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
         onDragLeave={() => setDragOver(false)}
         onDrop={onDrop}>
      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((a) => (
            <div key={a.id} className="relative group rounded-md border border-border bg-panel/60 p-1.5 flex items-center gap-2 text-[11px]">
              <img src={a.dataUrl} alt={a.name} className="w-8 h-8 rounded object-cover" />
              <div className="leading-tight">
                <div className="text-text truncate max-w-[140px]">{a.name}</div>
                <div className="text-muted/70 font-mono">{(a.size / 1024).toFixed(0)}KB</div>
              </div>
              <button
                onClick={() => setAttachments((arr) => arr.filter((x) => x.id !== a.id))}
                aria-label="Remove"
                className="ml-1 text-muted hover:text-danger transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachError && <div className="text-[11px] text-danger mb-1.5">{attachError}</div>}

      <div
        className={cn(
          "relative rounded-2xl bg-panel/60 border transition-colors",
          dragOver ? "border-accent border-dashed bg-accent-soft/40" : focused ? "border-accent/50" : "border-border"
        )}
      >
        {dragOver && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none text-accent text-sm font-medium">
            <ImageIcon className="w-4 h-4 mr-2" /> Drop images to attach
          </div>
        )}
        <textarea
          value={voice.listening ? voice.interim || text : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={2}
          placeholder={voice.listening ? "Listening…" : attachments.length ? "Add a question about these images…" : "Ask the agent…"}
          className="w-full resize-none bg-transparent px-4 py-3 pr-40 text-[13.5px] text-text placeholder:text-muted/60 focus:outline-none"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image"
            className="h-7 w-7 rounded-full flex items-center justify-center transition border bg-transparent border-border text-muted hover:text-text"
            title="Attach images (PNG/JPEG/GIF/WebP, ≤5MB each)"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
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
              disabled={!text.trim() && attachments.length === 0}
              aria-label="Send"
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center transition",
                (text.trim() || attachments.length > 0)
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
        <span>Enter to send · Shift+Enter newline · drop images here</span>
        {voice.supported && <span>· 🎙 voice in (ro-RO)</span>}
        {voiceOutput && <span className="text-accent/80">· speaking replies</span>}
      </div>
    </div>
  );
}
