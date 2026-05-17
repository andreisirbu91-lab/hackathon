"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Browser Web Speech API types are not in Node's lib.dom by default in some setups.
// We declare the bits we need.
type SR = {
  start(): void;
  stop(): void;
  abort(): void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(options: {
  onFinalTranscript: (text: string) => void;
  lang?: string;
}) {
  const { onFinalTranscript, lang = "ro-RO" } = options;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const ref = useRef<SR | null>(null);

  useEffect(() => {
    setSupported(!!getSRCtor());
  }, []);

  const start = useCallback(() => {
    const Ctor = getSRCtor();
    if (!Ctor) return;
    if (ref.current) ref.current.abort();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    let finalChunk = "";
    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t;
        else partial += t;
      }
      setInterim(partial);
    };
    rec.onerror = () => {};
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalChunk.trim();
      if (text) onFinalTranscript(text);
    };
    ref.current = rec;
    rec.start();
    setListening(true);
  }, [lang, onFinalTranscript]);

  const stop = useCallback(() => {
    ref.current?.stop();
  }, []);

  return { supported, listening, interim, start, stop };
}

// Speech synthesis: simple wrapper around browser TTS. Romanian voices are
// hit-or-miss across OSes — we try ro-RO first and fall back to default.
export function speak(text: string, lang: string = "ro-RO"): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  // Strip code blocks & URLs to keep speech clean.
  const clean = text
    .replace(/```[\s\S]*?```/g, " (code) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\n+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang;
  u.rate = 1.05;
  u.pitch = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
