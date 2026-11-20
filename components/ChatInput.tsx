"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Mic,
  MicOff,
  ArrowUp,
  Square,
  Paperclip,
  Sparkles,
  X,
  FileCode,
  ImageIcon,
  Music,
  Globe,
  Code2,
  Cpu,
  Newspaper,
  Check,
  GraduationCap,
  Terminal,
  MessageSquare,
  Video,
  Radio,
} from "lucide-react";
import { Attachment, IndustryFocus } from "@/lib/types";
import { LotOsMode } from "@/lib/lot-os/types";

export interface ChatInputProps {
  onSendMessage: (message: string, attachment?: Attachment, searchFocus?: IndustryFocus) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
  onOpenScheduleTasks?: () => void;
  onOpenLotCode?: () => void;
  onOpenBrowserAgent?: () => void;
  externalInput?: string;
  searchFocus?: IndustryFocus;
  onSearchFocusChange?: (focus: IndustryFocus) => void;
  activeMode?: string;
  onSelectMode?: (mode: string) => void;
  onStartMeetily?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onStopGeneration,
  onOpenScheduleTasks,
  onOpenLotCode,
  onOpenBrowserAgent,
  externalInput,
  searchFocus = "all",
  onSearchFocusChange,
  activeMode = "chat",
  onSelectMode,
  onStartMeetily,
}) => {
  const [input, setInput] = useState("");
  const [internalFocus, setInternalFocus] = useState<IndustryFocus>(searchFocus);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const baseInputRef = useRef<string>("");
  const lastFinalTranscriptRef = useRef<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Sync external input and focus
  useEffect(() => {
    if (externalInput !== undefined && externalInput !== "") {
      setInput(externalInput);
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = externalInput.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }
  }, [externalInput]);

  // Clean auto-resize without layout repaint flashing (24px to 160px)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "24px";
      const scrollH = el.scrollHeight;
      el.style.height = `${Math.min(Math.max(scrollH, 24), 160)}px`;
    }
  }, [input]);

  // Click outside to close popovers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setPlusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Continuous, uninterrupted Voice Input (Web Speech + Whisper fallback)
  const toggleSpeechRecognition = async () => {
    if (isListeningRef.current) {
      // STOP LISTENING
      isListeningRef.current = false;
      setIsListening(false);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      return;
    }

    // START LISTENING
    baseInputRef.current = input;
    lastFinalTranscriptRef.current = "";

    // 1. Web Speech API (Deduplicated against Android Chrome double-emission bug)
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);
        recognition.continuous = !isMobile;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let interimChunk = "";

          // Start strictly at event.resultIndex, NEVER 0 (prevents "hello hello" accumulation)
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const transcript = res[0]?.transcript?.trim() || "";
            const confidence = res[0]?.confidence;

            // Filter out Android Chrome 0-confidence ghost duplicates
            if (res.isFinal && transcript && confidence !== 0) {
              if (transcript !== lastFinalTranscriptRef.current) {
                lastFinalTranscriptRef.current = transcript;
                const base = baseInputRef.current;
                const updated = base ? `${base.trim()} ${transcript}` : transcript;
                baseInputRef.current = updated;
                setInput(updated);
              }
            } else if (!res.isFinal && transcript) {
              interimChunk += " " + transcript;
            }
          }

          if (interimChunk) {
            const base = baseInputRef.current;
            setInput(base ? `${base.trim()} ${interimChunk.trim()}` : interimChunk.trim());
          }
        };

        recognition.onerror = (err: any) => {
          console.warn("Speech recognition error:", err);
          if (err.error === "not-allowed") {
            isListeningRef.current = false;
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          lastFinalTranscriptRef.current = "";
          if (isListeningRef.current && !isMobile) {
            try {
              recognition.start();
            } catch {}
          } else {
            isListeningRef.current = false;
            setIsListening(false);
          }
        };

        recognition.start();
        return;
      } catch (err) {
        console.warn("Native speech init failed, falling back to MediaRecorder Whisper:", err);
      }
    }

    // 2. Whisper Fallback via MediaRecorder (Cross-platform webm / mp4 support)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const selectedMime = mimeTypes.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
      const recorder = selectedMime ? new MediaRecorder(stream, { mimeType: selectedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const finalMime = recorder.mimeType || "audio/webm";
        const ext = finalMime.includes("mp4") ? "mp4" : "webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });

        if (audioBlob.size > 1000) {
          setIsTranscribing(true);
          const formData = new FormData();
          formData.append("audio", audioBlob, `recording.${ext}`);
          try {
            const res = await fetch("/api/whisper", {
              method: "POST",
              body: formData,
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                setInput((prev) => (prev ? `${prev.trim()} ${data.text.trim()}` : data.text.trim()));
              }
            }
          } catch (e) {
            console.error("Whisper fallback transcription failed:", e);
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      recorder.start();
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      console.warn("Microphone access denied or unavailable:", err);
      alert("Please allow microphone permissions to use voice input.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((input.trim() || attachment) && !isLoading) {
      if (isListeningRef.current) {
        toggleSpeechRecognition();
      }
      onSendMessage(input.trim(), attachment || undefined, internalFocus);
      setInput("");
      setAttachment(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "24px";
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    // 1. Audio Files -> Transcribe via Whisper
    if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name)) {
      setIsTranscribing(true);
      const formData = new FormData();
      formData.append("audio", file, file.name);

      try {
        const res = await fetch("/api/whisper", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setInput((prev) => `${prev}\n\n[Transcribed from ${file.name} via Whisper]:\n"${data.text}"\n`);
        }
      } catch (err) {
        console.error("Audio transcription failed:", err);
      } finally {
        setIsTranscribing(false);
        setPlusMenuOpen(false);
      }
      return;
    }

    // 2. Images -> Multi-modal attachment
    if (file.type.startsWith("image/")) {
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachment({
          name: file.name,
          type: file.type,
          dataUrl,
        });
        setPlusMenuOpen(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    // 3. Text/Code Files -> Inlined prompt context
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput((prev) => `${prev}\n\n\`\`\`${file.name}\n${content.slice(0, 4000)}\n\`\`\`\n`);
      setPlusMenuOpen(false);
    };
    reader.readAsText(file);
  };

  const handleSelectFocus = (focus: IndustryFocus) => {
    setInternalFocus(focus);
    if (onSearchFocusChange) {
      onSearchFocusChange(focus);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pb-2 sm:pb-3 pb-safe">
      {/* Attachment Preview Card if image attached */}
      {attachment && (
        <div className="mb-2 flex items-center space-x-2 bg-[#141417] border border-zinc-800 rounded-xl p-2 max-w-xs animate-in fade-in duration-100">
          {attachment.type.startsWith("image/") ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="w-10 h-10 object-cover rounded-lg"
            />
          ) : (
            <FileCode className="w-6 h-6 text-zinc-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white truncate font-medium">{attachment.name}</p>
            <span className="text-[10px] text-zinc-500">Ready for analysis</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Clean Solid Matte Input Container */}
      <div className="relative flex flex-col bg-[#111114] border border-[#27272a] focus-within:border-zinc-500 rounded-2xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 shadow-xl transition-colors duration-150">
        {/* Row 1 (Internal): Live Audio Recording Waveform Visualizer */}
        {isListening && (
          <div className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-red-950/40 border border-red-500/30 rounded-xl mb-1.5 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="text-xs font-medium text-red-300 truncate">
              Listening to voice... speak freely
            </span>
            <div className="flex items-center gap-1 ml-1 shrink-0">
              <span className="w-1 h-2.5 bg-red-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-4 bg-red-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-5 bg-red-400 rounded-full animate-bounce" />
              <span className="w-1 h-3.5 bg-red-400 rounded-full animate-bounce [animation-delay:-0.2s]" />
              <span className="w-1 h-2 bg-red-400 rounded-full animate-bounce [animation-delay:-0.35s]" />
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-red-500/40 hover:bg-red-500/60 text-red-100 border border-red-500/50 transition active:scale-95 shrink-0"
            >
              Finish Speaking
            </button>
          </div>
        )}

        {/* Row 3 (Internal): Transcribing Indicator */}
        {isTranscribing && (
          <div className="w-full flex items-center gap-2 px-2.5 py-1 bg-amber-950/40 border border-amber-500/30 rounded-xl mb-1.5 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-amber-200">
              ✨ Whisper is transcribing your audio...
            </span>
          </div>
        )}

        {/* Main Input Row */}
        <div className="relative flex items-end w-full">
          {/* Plus Action Button */}
          <div className="relative mb-0.5 shrink-0" ref={plusMenuRef}>
            <button
              type="button"
              onClick={() => setPlusMenuOpen(!plusMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors active:scale-95"
              title="Options & Tools"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Plus Menu Popover */}
            {plusMenuOpen && (
              <div className="absolute bottom-12 left-0 w-56 bg-[#141418] border border-[#27272a] rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in duration-100 divide-y divide-zinc-800/60">
                <div className="py-1">
                  <label className="flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] cursor-pointer transition-colors">
                    <Paperclip className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Upload File / Image</span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.js,.ts,.tsx,.jsx,.py,.html,.css,.json,.md,.mp3,.wav,.m4a,.ogg,.webm"
                    />
                  </label>
                  <label className="flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] cursor-pointer transition-colors">
                    <Music className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Whisper Audio Transcribe</span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".mp3,.wav,.m4a,.ogg,.webm"
                    />
                  </label>
                </div>

              {/* Vertical Search Grounding Presets */}
              <div className="py-1">
                <div className="px-3.5 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                  Search Grounding Focus
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectFocus("all");
                    setPlusMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-left transition-colors ${
                    internalFocus === "all" ? "text-white bg-[#1c1c21] font-medium" : "text-zinc-400 hover:text-white hover:bg-[#18181c]"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                    <span>All Web Grounding</span>
                  </div>
                  {internalFocus === "all" && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSelectFocus("dev");
                    setPlusMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-left transition-colors ${
                    internalFocus === "dev" ? "text-white bg-[#1c1c21] font-medium" : "text-zinc-400 hover:text-white hover:bg-[#18181c]"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Dev & Code Specs</span>
                  </div>
                  {internalFocus === "dev" && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSelectFocus("hardware");
                    setPlusMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-left transition-colors ${
                    internalFocus === "hardware" ? "text-white bg-[#1c1c21] font-medium" : "text-zinc-400 hover:text-white hover:bg-[#18181c]"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Hardware & Silicon</span>
                  </div>
                  {internalFocus === "hardware" && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSelectFocus("news");
                    setPlusMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-left transition-colors ${
                    internalFocus === "news" ? "text-white bg-[#1c1c21] font-medium" : "text-zinc-400 hover:text-white hover:bg-[#18181c]"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Newspaper className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Live News 2026</span>
                  </div>
                  {internalFocus === "news" && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>

              {/* Agentic Tools */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setInput((prev) => `[Coder Mode]: Generate a clean Unified Diff patch to refactor and implement: \n${prev}`);
                    setPlusMenuOpen(false);
                    textareaRef.current?.focus();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] text-left transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Code Refactor & Diff</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInput((prev) => `[Debug & Self-Heal]: Diagnose the error, pinpoint the root cause, and output the fix:\n${prev}`);
                    setPlusMenuOpen(false);
                    textareaRef.current?.focus();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] text-left transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Debug & Self-Heal</span>
                </button>

                {onOpenLotCode && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenLotCode();
                      setPlusMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] text-left transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                    <span>LOT CODE Agent</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (onOpenBrowserAgent) {
                      onOpenBrowserAgent();
                    } else {
                      setInput("Navigate and execute browser-use task on: ");
                      textareaRef.current?.focus();
                    }
                    setPlusMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] text-left transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Browser Agent (browser-use)</span>
                </button>

                {onOpenScheduleTasks && (
                  <button
                    onClick={() => {
                      onOpenScheduleTasks();
                      setPlusMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] text-left transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Schedule Task</span>
                  </button>
                )}

                {onStartMeetily && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartMeetily();
                      setPlusMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#1c1c21] text-left transition-colors"
                  >
                    <Video className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Meetily: Record Meet / Zoom</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!(window as any).__lot_prewarmed) {
              (window as any).__lot_prewarmed = true;
              fetch("/api/prewarm").catch(() => {});
            }
          }}
          placeholder={
            isTranscribing
              ? "Whisper is transcribing audio..."
              : isListening
              ? "Listening continuously... speak freely"
              : "Ask LOT anything..."
          }
          rows={1}
          className="flex-1 bg-transparent border-0 resize-none text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 text-sm leading-relaxed px-2 py-1 max-h-[160px] custom-scrollbar font-sans"
        />

        {/* Right Action Icons: Microphone (Whisper) & Send/Stop */}
        <div className="flex items-center space-x-1 mb-0.5 shrink-0 ml-1">
          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 ${
              isListening
                ? "bg-red-600 text-white shadow-lg shadow-red-600/40 animate-pulse ring-2 ring-red-400/50 scale-105"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
            title={isListening ? "Stop listening" : "Voice Input (Continuous)"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Send / Stop Generation Button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-1.5 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-lg transition-colors active:scale-95"
              title="Stop generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() && !attachment}
              className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 ${
                input.trim() || attachment
                  ? "bg-white text-black hover:bg-zinc-200 shadow-md"
                  : "text-zinc-600 cursor-not-allowed bg-transparent"
              }`}
              title="Send prompt"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>

      <div className="text-center mt-2">
        <span className="text-[11px] text-zinc-600 font-sans tracking-tight select-none">
          LOT can make mistakes. Verify important information.
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
