'use client';

import React, { useState, useRef } from 'react';
import { diarizeMeetingTranscript, formatDiarizedMinutesMarkdown } from '@/lib/meeting/speakerDiarizer';

interface MeetilyProps {
  onVoicePrompt: (transcribedText: string) => void;
  onMeetingDocGenerated?: (markdownDoc: string) => void;
  triggerMeetingCapture?: number;
}

export function LotMeetilyAndVoice({
  onVoicePrompt,
  onMeetingDocGenerated,
  triggerMeetingCapture,
}: MeetilyProps) {
  const [isDictating, setIsDictating] = useState(false);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [meetingTranscript, setMeetingTranscript] = useState<string>('');
  const [meetingMinutes, setMeetingMinutes] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Trigger meeting capture programmatically from internal input tool
  React.useEffect(() => {
    if (triggerMeetingCapture && triggerMeetingCapture > 0 && !isMeetingActive) {
      startMeetingCapture();
    }
  }, [triggerMeetingCapture]);

  // 1. WHISPER-STYLE INSTANT VOICE DICTATION
  const toggleVoiceDictation = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Use Chrome or Edge for real-time voice recognition.');
      return;
    }

    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Supports Indian English + technical terms
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      if (text.trim()) {
        onVoicePrompt(text.trim());
      }
      setIsDictating(false);
    };

    recognition.onerror = () => setIsDictating(false);
    recognition.onend = () => setIsDictating(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
  };

  // 2. MEETILY: CAPTURE GOOGLE MEET / ZOOM TAB + MIC & GENERATE MINUTES DOCUMENT
  const startMeetingCapture = async () => {
    if (typeof window === 'undefined') return;

    try {
      // Captures Google Meet / Zoom browser tab audio + user microphone
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      mediaStreamRef.current = displayStream;

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const meetRec = new SpeechRecognition();
        meetRec.lang = 'en-IN';
        meetRec.continuous = true;
        meetRec.interimResults = false;

        meetRec.onresult = (e: any) => {
          const latest = e.results[e.results.length - 1]?.[0]?.transcript || '';
          if (latest.trim()) {
            const time = new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            setMeetingTranscript((prev) => `${prev}\n[${time}] ${latest.trim()}`);
          }
        };

        recognitionRef.current = meetRec;
        meetRec.start();
      }

      setIsMeetingActive(true);
      setMeetingMinutes(null);
    } catch (err) {
      console.warn('Meeting capture cancelled or unsupported:', err);
    }
  };

  const stopMeetingAndGenerateDoc = async () => {
    recognitionRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    setIsMeetingActive(false);

    if (!meetingTranscript.trim()) return;
    setIsSummarizing(true);

    try {
      // 1. Instant Neural Speaker Diarization
      const diarized = diarizeMeetingTranscript(meetingTranscript);
      const diarizedDoc = formatDiarizedMinutesMarkdown(diarized);
      setMeetingMinutes(diarizedDoc);
      onMeetingDocGenerated?.(diarizedDoc);

      // 2. Also query remote model if available for additional executive insights
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `You are Meetily AI Meeting Intelligence. Refine this diarized meeting record with key executive takeaways:\n\n${diarizedDoc}`,
              },
            ],
          }),
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
          const docText = await res.text();
          if (docText && !docText.includes('LOT-OS Sovereign') && docText.length > 50) {
            setMeetingMinutes(docText);
            onMeetingDocGenerated?.(docText);
          }
        }
      } catch {
        // Kept diarized doc
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const downloadMeetingDoc = () => {
    if (!meetingMinutes) return;
    const blob = new Blob([meetingMinutes], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOT-Meeting-Minutes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Only render when meeting recording is active, summarizing, or minutes doc is ready
  if (!isMeetingActive && !meetingMinutes && !isSummarizing) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto mb-3 animate-in fade-in duration-150">
      {/* Active Meetily Recording HUD */}
      {isMeetingActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/80 bg-neutral-950 px-3.5 py-2 text-xs mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-semibold text-emerald-400">📹 Meetily: Recording Active (Meet / Zoom)</span>
          </div>

          <button
            type="button"
            onClick={stopMeetingAndGenerateDoc}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-black hover:bg-emerald-400 transition active:scale-95"
          >
            <span>⏹</span>
            <span>Finish Meeting & Generate Doc</span>
          </button>
        </div>
      )}

      {isSummarizing && (
        <div className="rounded-xl border border-amber-800/60 bg-neutral-950 px-3.5 py-2 text-xs text-amber-400 animate-pulse mb-2">
          Generating Diarized Employee Meeting Minutes...
        </div>
      )}

      {meetingMinutes && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-neutral-950 px-3.5 py-2 text-xs mb-2">
          <span className="text-zinc-200 font-medium">✓ Meeting Minutes & Action Items Ready</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadMeetingDoc}
              className="rounded-lg bg-white px-3 py-1.5 font-semibold text-black hover:bg-neutral-200 transition"
            >
              ⬇ Download Meeting Doc (.md)
            </button>
            <button
              type="button"
              onClick={() => {
                setMeetingMinutes(null);
                setMeetingTranscript('');
              }}
              className="px-2 py-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition text-xs"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Live Meeting Transcript Drawer */}
      {isMeetingActive && (
        <div className="rounded-xl border border-emerald-800/60 bg-black p-3 font-mono text-xs text-neutral-300 max-h-36 overflow-y-auto">
          <div className="text-[10px] uppercase text-emerald-400 mb-1 font-sans font-semibold">
            ● Meetily Live Transcript (Google Meet / Zoom Active)
          </div>
          <pre className="whitespace-pre-wrap">
            {meetingTranscript || 'Listening to meeting audio...'}
          </pre>
        </div>
      )}
    </div>
  );
}

export default LotMeetilyAndVoice;
