'use client';

import React, { useState, useRef } from 'react';
import { diarizeMeetingTranscript, formatDiarizedMinutesMarkdown } from '@/lib/meeting/speakerDiarizer';

interface MeetilyProps {
  onVoicePrompt: (transcribedText: string) => void;
  onMeetingDocGenerated?: (markdownDoc: string) => void;
}

export function LotMeetilyAndVoice({
  onVoicePrompt,
  onMeetingDocGenerated,
}: MeetilyProps) {
  const [isDictating, setIsDictating] = useState(false);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [meetingTranscript, setMeetingTranscript] = useState<string>('');
  const [meetingMinutes, setMeetingMinutes] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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

  return (
    <div className="w-full max-w-3xl mx-auto mb-3">
      {/* Compact Voice & Meetily Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          {/* Whisper Voice Assistant Button */}
          <button
            type="button"
            onClick={toggleVoiceDictation}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
              isDictating
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-neutral-900 text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            <span>🎤</span>
            <span>{isDictating ? 'Listening (Speak now)...' : 'Voice Input'}</span>
          </button>

          {/* Meetily Google Meet / Zoom Recorder Button */}
          {!isMeetingActive ? (
            <button
              type="button"
              onClick={startMeetingCapture}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 font-medium text-neutral-200 hover:bg-neutral-800 transition"
            >
              <span>📹</span>
              <span>Meetily: Record Meet / Zoom</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopMeetingAndGenerateDoc}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-black hover:bg-emerald-400 transition"
            >
              <span>⏹</span>
              <span>Finish Meeting & Generate Doc</span>
            </button>
          )}
        </div>

        {isSummarizing && (
          <span className="text-amber-400 animate-pulse">
            Generating Employee Meeting Minutes...
          </span>
        )}

        {meetingMinutes && (
          <button
            type="button"
            onClick={downloadMeetingDoc}
            className="rounded-lg bg-white px-3 py-1.5 font-semibold text-black hover:bg-neutral-200"
          >
            ⬇ Download Meeting Doc (.md)
          </button>
        )}
      </div>

      {/* Live Meeting Transcript Drawer */}
      {isMeetingActive && (
        <div className="mt-2 rounded-xl border border-emerald-800/60 bg-black p-3 font-mono text-xs text-neutral-300 max-h-36 overflow-y-auto">
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
