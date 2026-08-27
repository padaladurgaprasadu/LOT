"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Mic, MicOff, ArrowUp, Square, Paperclip, Sparkles, X, FileCode, ImageIcon, Music } from "lucide-react";
import { Attachment } from "@/lib/types";

interface ChatInputProps {
  onSendMessage: (message: string, attachment?: Attachment) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
  onOpenScheduleTasks?: () => void;
  externalInput?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onStopGeneration,
  onOpenScheduleTasks,
  externalInput,
}) => {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const baseInputRef = useRef<string>("");
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

  // Clean auto-resize without layout repaint flashing
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "24px";
      const scrollH = el.scrollHeight;
      el.style.height = `${Math.min(Math.max(scrollH, 24), 160)}px`;
    }
  }, [input]);

  // Click outside to close plus menu
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

    // 1. Web Speech API (Continuous 100% full phrase streaming)
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript + " ";
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const liveSpeech = (finalTranscript + interimTranscript).trim();
        const base = baseInputRef.current.trim();
        setInput(base ? `${base} ${liveSpeech}` : liveSpeech);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          console.warn("Speech recognition notice:", event.error);
        }
      };

      recognition.onend = () => {
        // Auto-restart if user has not explicitly clicked stop
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch {}
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        isListeningRef.current = true;
        setIsListening(true);
        return;
      } catch (err) {
        console.warn("Direct speech recognition start failed, falling back to Whisper recorder:", err);
      }
    }

    // 2. Continuous MediaRecorder + OpenAI Whisper fallback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice_input.webm");

        try {
          const res = await fetch("/api/whisper", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              const base = baseInputRef.current.trim();
              setInput(base ? `${base} ${data.text}` : data.text);
            }
          }
        } catch (err) {
          console.error("Whisper transcription error:", err);
        } finally {
          setIsTranscribing(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
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
      onSendMessage(input.trim(), attachment || undefined);
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
      <div className="relative flex items-end bg-[#111114] border border-[#27272a] focus-within:border-zinc-500 rounded-2xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 shadow-xl transition-colors duration-150">
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
            <div className="absolute bottom-12 left-0 w-48 sm:w-52 bg-[#141418] border border-[#27272a] rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in duration-100">
              <label className="flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-[#1c1c21] cursor-pointer transition-colors">
                <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                <span>Upload File / Image</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.js,.ts,.tsx,.jsx,.py,.html,.css,.json,.md,.mp3,.wav,.m4a,.ogg,.webm"
                />
              </label>
              <label className="flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-[#1c1c21] cursor-pointer transition-colors">
                <Music className="w-3.5 h-3.5 text-blue-400" />
                <span>Whisper Audio Transcribe</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".mp3,.wav,.m4a,.ogg,.webm"
                />
              </label>
              {/* Agentic Coding Modes (Cursor / Claude Code style) */}
              <button
                type="button"
                onClick={() => {
                  setInput((prev) => `[Coder Mode]: Generate a clean Unified Diff patch to refactor and implement: \n${prev}`);
                  setPlusMenuOpen(false);
                  textareaRef.current?.focus();
                }}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-[#1c1c21] text-left transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>Code Refactor & Diff</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput((prev) => `[Debug & Self-Heal]: Diagnose the error, pinpoint the root cause, and output the fix:\n${prev}`);
                  setPlusMenuOpen(false);
                  textareaRef.current?.focus();
                }}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-[#1c1c21] text-left transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Debug & Self-Heal</span>
              </button>

              {onOpenScheduleTasks && (
                <button
                  onClick={() => {
                    onOpenScheduleTasks();
                    setPlusMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-[#1c1c21] text-left transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Schedule Task</span>
                </button>
              )}
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
                ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/40"
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

      <div className="text-center mt-2">
        <span className="text-[11px] text-zinc-600 font-sans tracking-tight select-none">
          LOT can make mistakes. Verify important information.
        </span>
      </div>
    </div>
  );
};
